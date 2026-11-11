"""Trusted host launcher for one isolated, disposable technical-smoke job."""

import json
import secrets
import tempfile
import time
from pathlib import Path
from uuid import UUID

from app.change_workflow.test_profiles import OVERLAY_PATHS, TechnicalTestProfile
from app.repositories.filesystem_snapshot_workspace import FileSystemSnapshotWorkspace
from app.testing.docker_commands import BoundedProcess, DockerFailure, docker
from app.testing.image_inventory import verify_images
from app.testing.worker_client import decode_bundle

ISOLATION_PROBE = """
import socket
for host,port in [('1.1.1.1',443),('host.docker.internal',8000),
                  ('host.docker.internal',5432)]:
 try:
  connection=socket.create_connection((host,port),timeout=1)
 except OSError:
  continue
 connection.close()
 raise SystemExit(1)
"""


def result(outcome, reason):
    return {"outcome": outcome, "reason": reason, "checks": [], "elapsed_ms": 0}


class DockerTestExecutor:
    def __init__(self, root: Path, worker_id: UUID):
        self.root, self.worker_id = root, worker_id
        self.workspace = FileSystemSnapshotWorkspace(root)

    def names(self, job_id):
        stem = f"cachesec-test-{self.worker_id.hex[:12]}-{UUID(str(job_id)).hex}"
        return {role: stem + "-" + role for role in ("network", "probe", "db", "app", "harness")}

    def labels(self, job_id):
        return [
            "--label",
            "cachesec.test-worker=" + str(self.worker_id),
            "--label",
            "cachesec.test-job=" + str(UUID(str(job_id))),
        ]

    def cleanup(self, job_id):
        """Only resources with both exact owner labels can be removed."""
        names = self.names(job_id)
        for kind, roles in (
            ("container", ("harness", "app", "db", "probe")),
            ("network", ("network",)),
        ):
            existing = docker([kind, "ls", "--all"] if kind == "container" else [kind, "ls"])
            # A successful list distinguishes an absent resource from an unavailable daemon.
            del existing
            for role in roles:
                listing = docker(
                    [
                        kind,
                        "ls",
                        *(["--all"] if kind == "container" else []),
                        "--filter",
                        "label=cachesec.test-worker=" + str(self.worker_id),
                        "--filter",
                        "label=cachesec.test-job=" + str(UUID(str(job_id))),
                        "--format",
                        "{{.Name}}" if kind == "network" else "{{.Names}}",
                    ]
                )
                if names[role] not in listing.decode().splitlines():
                    continue
                docker([kind, "rm", *(["--force"] if kind == "container" else []), names[role]])
        # Verify that cleanup really completed before returning a verdict or accepting another job.
        for kind in ("container", "network"):
            remaining = docker(
                [
                    kind,
                    "ls",
                    *(["--all"] if kind == "container" else []),
                    "--filter",
                    "label=cachesec.test-worker=" + str(self.worker_id),
                    "--filter",
                    "label=cachesec.test-job=" + str(UUID(str(job_id))),
                    "--format",
                    "{{.ID}}",
                ]
            )
            if remaining.strip():
                raise DockerFailure("CLEANUP_UNCERTAIN")

    def limits(self):
        return [
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--cpus",
            "1",
            "--memory",
            "512m",
            "--pids-limit",
            "128",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=64m",
            "--log-driver",
            "local",
            "--log-opt",
            "max-size=1m",
            "--log-opt",
            "max-file=2",
        ]

    def verify_app(self, name, profile, paths, network):
        info = json.loads(docker(["inspect", name]))[0]
        config, host = info["Config"], info["HostConfig"]
        mounts = {m["Destination"]: m for m in info["Mounts"]}
        if (
            info["Image"] != profile.runtime_image
            or config["User"] != "10001:10001"
            or not host["ReadonlyRootfs"]
            or host["Privileged"]
            or host["Memory"] != 512 * 1024**2
            or host["NanoCpus"] != 10**9
            or host["PidsLimit"] != 128
            or host["CapDrop"] != ["ALL"]
            or "no-new-privileges" not in host["SecurityOpt"]
            or host["PortBindings"]
            or set(info["NetworkSettings"]["Networks"]) != {network}
            or set(mounts) != set(paths)
            or any(m["RW"] for m in mounts.values())
        ):
            raise DockerFailure("SANDBOX_UNAVAILABLE")
        for target, source in paths.items():
            expected = str(source).replace("\\", "/")
            accepted = {expected}
            if len(expected) > 2 and expected[1:3] == ":/":
                accepted.add("/run/desktop/mnt/host/" + expected[0].lower() + expected[2:])
            if (
                mounts[target]["Type"] != "bind"
                or not source.is_file()
                or mounts[target]["Source"].replace("\\", "/") not in accepted
            ):
                raise DockerFailure("SANDBOX_UNAVAILABLE")

    def execute(self, client, job):
        job_id, ticket = str(UUID(job["job_id"])), job["ticket"]
        profile = TechnicalTestProfile.from_metadata(job["profile"])
        if profile.digest != job["profile_digest"]:
            return result("error", "PROFILE_MISMATCH")
        started = time.monotonic()
        deadline = started + profile.deadline_seconds
        names, labels = self.names(job_id), self.labels(job_id)
        processes = []
        verdict = result("error", "EXECUTOR_ERROR")
        try:
            migrations = verify_images(profile)
            bundle = decode_bundle(client.post(job_id + "/bundle", ticket=ticket))
            if tuple(f.path for f in bundle.files) != OVERLAY_PATHS:
                raise DockerFailure("PROFILE_MISMATCH")
            prepared = self.workspace.prepare(bundle)
            private = Path(tempfile.mkdtemp(prefix="job-" + job_id + "-", dir=self.root))
            # Only test credentials enter this private directory.
            admin, password, operator, reader = (secrets.token_hex(24) for _ in range(4))
            env = private / "app.env"
            env.write_text(
                f"QUOTATION_DATABASE_URL=postgresql://test_runtime:{password}@database:5432/cachesec_test\n"
                f"QUOTATION_FIXTURE_OPERATOR_TOKEN={operator}\n"
                f"QUOTATION_FIXTURE_READER_TOKEN={reader}\n",
                encoding="utf-8",
            )
            db_env = private / "db.env"
            db_env.write_text(
                f"POSTGRES_PASSWORD={admin}\nPOSTGRES_DB=cachesec_test\n", encoding="utf-8"
            )
            harness_env = private / "harness.env"
            harness_env.write_text(
                f"TEST_OPERATOR_TOKEN={operator}\nTEST_READER_TOKEN={reader}\n", encoding="utf-8"
            )
            docker(
                ["network", "create", "--internal", *labels, names["network"]], deadline=deadline
            )
            network = json.loads(docker(["network", "inspect", names["network"]]))[0]
            if not network["Internal"]:
                raise DockerFailure("SANDBOX_UNAVAILABLE")
            # A trusted probe has no candidate mounts; fail before executing candidate code.
            docker(
                [
                    "run",
                    "--name",
                    names["probe"],
                    *labels,
                    "--network",
                    names["network"],
                    *self.limits(),
                    "--entrypoint",
                    "python",
                    profile.runtime_image,
                    "-c",
                    ISOLATION_PROBE,
                ],
                deadline=deadline,
            )
            docker(
                [
                    "run",
                    "-d",
                    "--name",
                    names["db"],
                    *labels,
                    "--network",
                    names["network"],
                    "--network-alias",
                    "database",
                    "--env-file",
                    str(db_env),
                    "--cpus",
                    "1",
                    "--memory",
                    "512m",
                    "--pids-limit",
                    "128",
                    "--tmpfs",
                    "/var/lib/postgresql/data:rw,size=256m",
                    profile.database_image,
                ],
                deadline=deadline,
            )
            for attempt in range(60):
                try:
                    docker(
                        [
                            "exec",
                            names["db"],
                            "pg_isready",
                            "-h",
                            "127.0.0.1",
                            "-U",
                            "postgres",
                            "-d",
                            "cachesec_test",
                        ],
                        deadline=deadline,
                    )
                    break
                except DockerFailure:
                    if attempt == 59 or time.monotonic() >= deadline:
                        raise
                    time.sleep(0.2)
            sql = (
                (
                    f"CREATE ROLE test_runtime LOGIN PASSWORD '{password}' "
                    "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;\n"
                    "REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;\n"
                    "REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;\n"
                    "REVOKE CREATE ON DATABASE cachesec_test FROM PUBLIC;\n"
                    "REVOKE CREATE ON SCHEMA public FROM PUBLIC;\n"
                    "CREATE SCHEMA quotation_demo;\n"
                ).encode()
                + b"\n".join(migrations)
                + (
                    b"\nGRANT USAGE ON SCHEMA quotation_demo TO test_runtime;\n"
                    b"GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA quotation_demo "
                    b"TO test_runtime;\n"
                )
            )
            docker(
                [
                    "exec",
                    "-i",
                    names["db"],
                    "psql",
                    "-U",
                    "postgres",
                    "-d",
                    "cachesec_test",
                    "-v",
                    "ON_ERROR_STOP=1",
                ],
                deadline=deadline,
                stdin=sql,
            )
            mounts, paths = [], {}
            for path in OVERLAY_PATHS:
                target, source = (
                    "/opt/quotation/" + path.removeprefix("backend/"),
                    prepared.source_root / path,
                )
                mounts += ["--mount", f"type=bind,source={source},target={target},readonly"]
                paths[target] = source
            docker(
                [
                    "create",
                    "--name",
                    names["app"],
                    *labels,
                    "--network",
                    names["network"],
                    "--network-alias",
                    "candidate",
                    *self.limits(),
                    "--user",
                    "10001:10001",
                    "--env-file",
                    str(env),
                    *mounts,
                    profile.runtime_image,
                ],
                deadline=deadline,
            )
            docker(
                [
                    "create",
                    "--name",
                    names["harness"],
                    *labels,
                    "--network",
                    names["network"],
                    *self.limits(),
                    "--user",
                    "10001:10001",
                    "--env-file",
                    str(harness_env),
                    profile.harness_image,
                ],
                deadline=deadline,
            )
            self.verify_app(names["app"], profile, paths, names["network"])
            self.workspace.verify(prepared)
            permit = client.post(job_id + "/permit", ticket=ticket)
            if (
                permit["artifact_digest"] != job["artifact_digest"]
                or permit["profile_digest"] != profile.digest
            ):
                raise DockerFailure("PROFILE_MISMATCH")
            if time.monotonic() >= deadline:
                raise DockerFailure("TEST_DEADLINE")
            app = BoundedProcess.start(["start", "--attach", names["app"]])
            processes.append(app)
            harness = BoundedProcess.start(["start", "--attach", names["harness"]])
            processes.append(harness)
            raw = harness.wait(deadline, peers=(app,))
            verdict = json.loads(raw)
            if app.overflow.is_set():
                raise DockerFailure("OUTPUT_LIMIT")
            if app.process.poll() is not None:
                verdict = result("failed", "APP_START_FAILED")
        except DockerFailure as error:
            verdict = result(
                "timed_out" if error.reason == "TEST_DEADLINE" else "error", error.reason
            )
        except Exception:
            # Neither candidate text nor private configuration is included in diagnostics.
            verdict = result("error", "EXECUTOR_ERROR")
        finally:
            try:
                self.cleanup(job_id)
            except Exception:
                verdict = result("unknown", "CLEANUP_UNCERTAIN")
            for process in processes:
                if process.process.poll() is None:
                    process.process.kill()
                process.process.wait(timeout=5)
                for thread in process.threads:
                    thread.join(timeout=1)
        verdict["elapsed_ms"] = int((time.monotonic() - started) * 1000)
        return verdict
