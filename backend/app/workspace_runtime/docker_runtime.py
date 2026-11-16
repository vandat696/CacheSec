"""Trusted local launcher. The client cannot supply commands, mounts, images or a port."""

import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from uuid import UUID

from app.artifacts.blob_models import content_digest
from app.artifacts.metadata_encoding import metadata_digest
from app.change_workflow.test_profiles import OVERLAY_PATHS
from app.repositories.filesystem_snapshot_workspace import FileSystemSnapshotWorkspace
from app.testing.docker_commands import DockerFailure, docker
from app.testing.docker_test_executor import ISOLATION_PROBE, DockerTestExecutor
from app.testing.image_inventory import verify_images
from app.testing.worker_client import NoRedirect


def runtime_configuration(configuration, profile):
    port = configuration.get("port", 8001)
    network = configuration["network"]
    environment = Path(configuration["environment_file"])
    baseline_image = configuration.get("baseline_image", profile.runtime_image)
    if (
        type(port) is not int
        or not 1024 <= port <= 65535
        or not environment.is_absolute()
        or not network
        or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for c in network)
        or not isinstance(baseline_image, str)
        or not re.fullmatch(r"sha256:[0-9a-f]{64}", baseline_image)
    ):
        raise ValueError("Invalid trusted runtime configuration")
    return {
        "kind": "local-quotation-runtime-v1",
        "schema_version": 1,
        "profile_digest": profile.digest,
        "baseline_image": baseline_image,
        "environment_digest": content_digest(environment.read_bytes()),
        "network": network,
        "port": port,
        "ingress_digest": content_digest(
            Path(__file__).with_name("quotation_gateway.py").read_bytes()
        ),
    }


class DockerLocalRuntime:
    def __init__(self, root, worker_id, configuration):
        self.root, self.worker_id, self.configuration = root, worker_id, configuration
        self.workspace = FileSystemSnapshotWorkspace(root)
        self.network = configuration["network"]
        self.port = configuration.get("port", 8001)

    def name(self, operation):
        return "cachesec-local-" + UUID(operation["id"]).hex

    def inspect(self, name):
        listing = docker(
            [
                "container",
                "ls",
                "--all",
                "--filter",
                "name=^/" + name + "$",
                "--format",
                "{{.Names}}",
            ]
        )
        if name not in listing.decode().splitlines():
            return None
        return json.loads(docker(["inspect", name]))[0]

    def previous(self, target, profile):
        name = target.get("container_name")
        if name:
            info = self.inspect(name)
            if info is None:
                raise DockerFailure("TARGET_MISMATCH")
            if (
                info["Config"]["Labels"].get("cachesec.local-artifact") != target["active_artifact"]
                or info["Config"]["Labels"].get("cachesec.local-target") != "quotations"
            ):
                raise DockerFailure("TARGET_MISMATCH")
            return name
        if target["version"] != 0:
            return None  # A known unavailable target has no process to stop.
        if self.port != 8001:
            return None  # Isolated test targets never inspect/stop the dev baseline.
        listing = docker(
            [
                "ps",
                "-a",
                "--filter",
                "label=com.docker.compose.project=cachesec-quotation-dev",
                "--filter",
                "label=com.docker.compose.service=quotation",
                "--format",
                "{{.Names}}",
            ]
        )
        names = listing.decode().splitlines()
        if len(names) > 1:
            raise DockerFailure("TARGET_MISMATCH")
        if names:
            info = self.inspect(names[0])
            baseline_image = self.configuration.get("baseline_image", profile.runtime_image)
            if info["Image"] != baseline_image or info["Mounts"]:
                raise DockerFailure("TARGET_MISMATCH")
            return names[0]
        return None

    def verify(self, info, operation, profile, prepared):
        host, config = info["HostConfig"], info["Config"]
        expected_labels = {
            "cachesec.local-operation": operation["id"],
            "cachesec.local-target": "quotations",
            "cachesec.local-artifact": operation["artifact_digest"],
            "cachesec.local-profile": profile.digest,
        }
        image = json.loads(docker(["image", "inspect", profile.runtime_image]))[0]
        if (
            info["Image"] != profile.runtime_image
            or config["User"] != "10001:10001"
            or config["Cmd"] != image["Config"]["Cmd"]
            or config["Entrypoint"] != image["Config"].get("Entrypoint")
            or any(config["Labels"].get(k) != v for k, v in expected_labels.items())
            or not host["ReadonlyRootfs"]
            or host["Privileged"]
            or host["Memory"] != 512 * 1024**2
            or host["NanoCpus"] != 10**9
            or host["PidsLimit"] != 128
            or host["CapDrop"] != ["ALL"]
            or "no-new-privileges" not in host["SecurityOpt"]
            or set(info["NetworkSettings"]["Networks"]) != {self.network}
            or host["PortBindings"]
        ):
            raise DockerFailure("TARGET_MISMATCH")
        expected = {
            "/opt/quotation/" + p.removeprefix("backend/"): prepared.source_root / p
            for p in OVERLAY_PATHS
        }
        mounts = {m["Destination"]: m for m in info["Mounts"]}
        if set(mounts) != set(expected):
            raise DockerFailure("TARGET_MISMATCH")
        for destination, source in expected.items():
            accepted = {str(source).replace("\\", "/")}
            path = next(iter(accepted))
            if len(path) > 2 and path[1:3] == ":/":
                accepted.add("/run/desktop/mnt/host/" + path[0].lower() + path[2:])
            mount = mounts[destination]
            if (
                mount["RW"]
                or mount["Type"] != "bind"
                or mount["Source"].replace("\\", "/") not in accepted
            ):
                raise DockerFailure("TARGET_MISMATCH")
        self.workspace.verify(prepared)

    def start(self, client, operation, profile, candidate, receipt):
        verify_images(profile)
        prepared = self.workspace.prepare(candidate)
        receipt["prepared_directory"] = str(prepared.directory)
        name = self.name(operation)
        mounts = [
            arg
            for path in OVERLAY_PATHS
            for arg in (
                "--mount",
                f"type=bind,source={prepared.source_root / path},"
                f"target=/opt/quotation/{path.removeprefix('backend/')},readonly",
            )
        ]
        labels = {
            "cachesec.local-operation": operation["id"],
            "cachesec.local-target": "quotations",
            "cachesec.local-artifact": operation["artifact_digest"],
            "cachesec.local-profile": profile.digest,
        }
        network = json.loads(docker(["network", "inspect", self.network]))[0]
        if not network["Internal"]:
            raise DockerFailure("TARGET_MISMATCH")
        # Execute only trusted image code to check isolation before candidate dispatch.
        docker(
            [
                "run",
                "--rm",
                "--network",
                self.network,
                *DockerTestExecutor(self.root, self.worker_id).limits(),
                "--entrypoint",
                "python",
                profile.runtime_image,
                "-c",
                ISOLATION_PROBE,
            ]
        )
        docker(
            [
                "create",
                "--name",
                name,
                *[arg for k, v in labels.items() for arg in ("--label", k + "=" + v)],
                "--network",
                self.network,
                *DockerTestExecutor(self.root, self.worker_id).limits(),
                "--user",
                "10001:10001",
                "--env-file",
                self.configuration["environment_file"],
                *mounts,
                profile.runtime_image,
            ]
        )
        self.verify(self.inspect(name), operation, profile, prepared)
        self.create_ingress(operation, profile)
        # A registered bootstrap image can differ from the candidate's test runtime image.
        # Validate the old process before obtaining permission to stop/start anything.
        baseline = (
            self.previous({"version": 0}, profile) if operation["target_version"] == 0 else None
        )
        permit = client.post(operation["id"] + "/permit", ticket=operation["ticket"])
        if (
            permit["artifact_digest"] != operation["artifact_digest"]
            or permit["profile_digest"] != profile.digest
            or metadata_digest(runtime_configuration(self.configuration, profile))
            != permit["target"]["config_digest"]
        ):
            raise DockerFailure("TARGET_MISMATCH")
        receipt.update(permit=permit, prepared_directory=str(prepared.directory))
        self.save_receipt(operation, receipt)
        previous = self.previous(permit["target"], profile)
        if operation["target_version"] == 0 and previous != baseline:
            raise DockerFailure("TARGET_MISMATCH")
        self.workspace.verify(prepared)
        if time.time() >= permit["permit_expires_at"]:
            raise DockerFailure("PERMIT_EXPIRED")
        if previous:
            old_ingress = self.inspect(previous + "-gateway")
            if old_ingress:
                labels = old_ingress["Config"]["Labels"]
                old_app = self.inspect(previous)
                if labels.get("cachesec.local-operation") != old_app["Config"]["Labels"].get(
                    "cachesec.local-operation"
                ):
                    raise DockerFailure("TARGET_MISMATCH")
                docker(["stop", "--time", "5", previous + "-gateway"])
            docker(["stop", "--time", "5", previous])
        docker(["start", name])
        self.verify(self.inspect(name), operation, profile, prepared)
        docker(["start", name + "-gateway"])
        self.verify_ingress(operation, profile)
        self.health()
        return {
            "status": "succeeded",
            "reason": "COMPLETED",
            "container_name": name,
            "observed_artifact": operation["artifact_digest"],
        }

    def create_ingress(self, operation, profile):
        name = self.name(operation)
        script = Path(__file__).with_name("quotation_gateway.py").read_text(encoding="utf-8")
        docker(
            [
                "create",
                "--name",
                name + "-gateway",
                "--network",
                "bridge",
                "--publish",
                f"127.0.0.1:{self.port}:8001",
                "--label",
                "cachesec.local-operation=" + operation["id"],
                "--label",
                "cachesec.local-role=gateway",
                *DockerTestExecutor(self.root, self.worker_id).limits(),
                "--user",
                "10001:10001",
                "--env",
                "QUOTATION_GATEWAY_TARGET=" + name,
                "--entrypoint",
                "python",
                profile.runtime_image,
                "-c",
                script,
            ]
        )
        docker(["network", "connect", self.network, name + "-gateway"])
        self.verify_ingress(operation, profile)

    def verify_ingress(self, operation, profile):
        name = self.name(operation)
        info = self.inspect(name + "-gateway")
        if info is None:
            raise DockerFailure("TARGET_MISMATCH")
        host, config = info["HostConfig"], info["Config"]
        script = Path(__file__).with_name("quotation_gateway.py").read_text(encoding="utf-8")
        if (
            info["Image"] != profile.runtime_image
            or config["User"] != "10001:10001"
            or config["Entrypoint"] != ["python"]
            or config["Cmd"] != ["-c", script]
            or config["Labels"].get("cachesec.local-operation") != operation["id"]
            or config["Labels"].get("cachesec.local-role") != "gateway"
            or info["Mounts"]
            or not host["ReadonlyRootfs"]
            or host["Privileged"]
            or host["CapDrop"] != ["ALL"]
            or "no-new-privileges" not in host["SecurityOpt"]
            or host["Memory"] != 512 * 1024**2
            or host["NanoCpus"] != 10**9
            or host["PidsLimit"] != 128
            or set(info["NetworkSettings"]["Networks"]) != {"bridge", self.network}
            or host["PortBindings"]
            != {"8001/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(self.port)}]}
            or "QUOTATION_GATEWAY_TARGET=" + name not in config["Env"]
        ):
            raise DockerFailure("TARGET_MISMATCH")

    def health(self):
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        for _ in range(40):
            try:
                with opener.open(f"http://127.0.0.1:{self.port}/api/v1/quotations", timeout=2):
                    pass
            except urllib.error.HTTPError as error:
                if error.code == 401:
                    return
            except OSError:
                pass
            time.sleep(0.25)
        raise DockerFailure("RUNTIME_UNAVAILABLE")

    def save_receipt(self, operation, receipt):
        # The private receipt records intention before side effects, never credentials/source.
        destination = self.root / ("operation-" + UUID(operation["id"]).hex + ".json")
        temporary = destination.with_suffix(".tmp")
        with temporary.open("w", encoding="utf-8") as stream:
            json.dump(receipt, stream)
            stream.flush()
            import os

            os.fsync(stream.fileno())
        temporary.replace(destination)
