"""Single trusted host worker executes fixed source-write and runtime operations."""

import json
import time
import traceback
from pathlib import Path
from uuid import UUID

from app.change_workflow.test_profiles import TechnicalTestProfile
from app.repositories.filesystem_snapshot_workspace import PreparedSnapshot
from app.testing.docker_commands import DockerFailure
from app.testing.worker_client import WorkerApiError, decode_bundle
from app.workspace_runtime.docker_runtime import DockerLocalRuntime
from app.workspace_runtime.filesystem_source_writer import (
    FileSystemSourceWriter,
    SourceWriteConflict,
)


class HostWorkspaceOperations:
    def __init__(self, client, root, worker_id, source_root, runtime_configuration):
        self.client, self.root = client, root
        self.writer = FileSystemSourceWriter(Path(source_root))
        self.runtime = DockerLocalRuntime(root, worker_id, runtime_configuration)
        self.recovered = set()

    def diagnostic(self, operation, error):
        """Private operational diagnostics contain types/locations, never exception text/payload."""
        try:
            record = {
                "error_type": type(error).__name__,
                "errno": getattr(error, "errno", None),
                "winerror": getattr(error, "winerror", None),
                "http_status": getattr(error, "status", None),
                "locations": [
                    (f.name, f.lineno) for f in traceback.extract_tb(error.__traceback__)
                ],
            }
            path = self.root / ("diagnostic-" + UUID(operation["id"]).hex + ".json")
            path.write_text(json.dumps(record), encoding="utf-8")
        except OSError:
            pass

    def record(self, operation, value):
        # Keep the exact report until acknowledged; never redo the source write or start.
        while True:
            try:
                self.client.post(
                    operation["id"] + "/result", ticket=operation["ticket"], result=value
                )
                return
            except WorkerApiError as error:
                if error.status < 500:
                    raise
            except OSError:
                pass
            time.sleep(1)

    def recover(self):
        for operation in self.client.post("owned")["items"]:
            if operation["id"] in self.recovered:
                continue
            report = {"status": "unknown", "reason": "WORKER_INTERRUPTED"}
            try:
                data = self.client.post(operation["id"] + "/bundle", ticket=operation["ticket"])
                base, candidate = decode_bundle(data["base"]), decode_bundle(data["candidate"])
                path = self.root / ("operation-" + UUID(operation["id"]).hex + ".json")
                receipt = json.loads(path.read_text(encoding="utf-8"))
                if operation["status"] in {"running", "unknown"}:
                    if operation["kind"] == "write":
                        _, _, current = self.writer.observe(base, candidate)
                        if current == candidate.files:
                            report = {
                                "status": "succeeded",
                                "reason": "COMPLETED",
                                "source_digest": operation["source_digest"],
                            }
                    else:
                        profile = TechnicalTestProfile.from_metadata(data["profile"])
                        prepared = PreparedSnapshot(
                            Path(receipt["prepared_directory"]), candidate.snapshot
                        )
                        info = self.runtime.inspect(self.runtime.name(operation))
                        self.runtime.verify(info, operation, profile, prepared)
                        self.runtime.verify_ingress(operation, profile)
                        ingress = self.runtime.inspect(self.runtime.name(operation) + "-gateway")
                        if info["State"]["Running"] and ingress["State"]["Running"]:
                            self.runtime.health()
                            report = {
                                "status": "succeeded",
                                "reason": "COMPLETED",
                                "container_name": self.runtime.name(operation),
                                "observed_artifact": operation["artifact_digest"],
                            }
            except Exception:
                pass  # Unknown remains reserved. No retry/overwrite/start from recovery.
            self.record(operation, report)
            self.recovered.add(operation["id"])

    def execute_one(self):
        operation = self.client.post("claim")
        if operation is None:
            return False
        report = {"status": "unknown", "reason": "EXECUTOR_ERROR"}
        try:
            data = self.client.post(operation["id"] + "/bundle", ticket=operation["ticket"])
            base, candidate = decode_bundle(data["base"]), decode_bundle(data["candidate"])
            receipt = {"id": operation["id"], "kind": operation["kind"]}
            self.runtime.save_receipt(operation, receipt)
            if operation["kind"] == "write":
                self.writer.observe(base, candidate)
                permit = self.client.post(operation["id"] + "/permit", ticket=operation["ticket"])
                receipt["permit"] = permit
                self.runtime.save_receipt(operation, receipt)
                if (
                    permit["artifact_digest"] != operation["artifact_digest"]
                    or time.time() >= permit["permit_expires_at"]
                ):
                    raise DockerFailure("PERMIT_EXPIRED")
                digest = self.writer.write(base, candidate)
                report = {"status": "succeeded", "reason": "COMPLETED", "source_digest": digest}
            else:
                profile = TechnicalTestProfile.from_metadata(data["profile"])
                report = self.runtime.start(self.client, operation, profile, candidate, receipt)
        except SourceWriteConflict:
            report = {"status": "failed", "reason": "SOURCE_CONFLICT"}
        except WorkerApiError as error:
            self.diagnostic(operation, error)
            if error.status in {401, 403, 404, 409}:
                # Dispatch denial may already be terminal in the control transaction.
                return True
        except DockerFailure as error:
            report = {
                "status": "unknown",
                "reason": error.reason
                if error.reason in {"TARGET_MISMATCH", "PERMIT_EXPIRED", "RUNTIME_UNAVAILABLE"}
                else "EXECUTOR_ERROR",
            }
        except Exception as error:
            self.diagnostic(operation, error)
        self.record(operation, report)
        self.recovered.add(operation["id"])
        print(f"Workspace {operation['kind']} {operation['id']}: {report['status']}", flush=True)
        return True
