"""Trusted worker channel: authorize immediately before a real host side effect."""

from base64 import b64encode
from uuid import UUID, uuid4

from app.change_workflow.workflow_repository import WorkflowError
from app.identity.control_authority import ControlAccessDenied, ControlIdentityRequired
from app.identity.control_authority import ControlCapability as Cap
from app.workspace_runtime.source_operations import TARGET_ID, public_operation


def encode_bundle(bundle):
    snapshot = bundle.snapshot
    return {
        "tenant_id": str(snapshot.scope.tenant_id),
        "repo_id": str(snapshot.scope.repo_id),
        "snapshot_id": str(snapshot.snapshot_id),
        "repository_identity": snapshot.repository_identity,
        "created_by": str(snapshot.created_by),
        "authority_epoch": snapshot.authority_epoch,
        "profile_content": b64encode(bundle.profile_content).decode("ascii"),
        "profile_digest": snapshot.profile_blob.digest,
        "profile_size": snapshot.profile_blob.byte_size,
        "manifest_digest": snapshot.manifest_blob.digest,
        "manifest_size": snapshot.manifest_blob.byte_size,
        "files": [
            {
                "file_id": str(ref.file_id),
                "path": ref.path,
                "digest": ref.blob.digest,
                "byte_size": ref.blob.byte_size,
                "content": b64encode(item.content).decode("ascii"),
            }
            for ref, item in zip(snapshot.files, bundle.files, strict=True)
        ],
    }


class WorkspaceWorkerService:
    def __init__(self, operations, runtime):
        self.operations, self.runtime = operations, runtime
        self.proposals, self.scope = operations.proposals, operations.scope

    def owned(self, worker_id):
        with self.proposals.transactions.open() as session:
            session.snapshot.authority.lock_scope(self.scope)
            result = [
                r
                for r in session.workspace.pending(self.scope, str(worker_id))
                if r["status"] in {"preparing", "running", "unknown"}
            ]
        return result

    def claim(self, worker_id):
        with self.proposals.transactions.open() as session:
            session.snapshot.authority.lock_scope(self.scope)
            records = session.workspace.pending(self.scope)
            record = next((r for r in records if r["status"] == "queued"), None)
            if record:
                record.update(status="preparing", worker_id=str(worker_id), ticket=str(uuid4()))
                session.workspace.update(self.scope, record)
        return record

    def claimed(self, session, identifier, worker_id, ticket):
        session.snapshot.authority.lock_scope(self.scope)
        record = self.operations.resource(session, self.scope, identifier)
        if (
            record["kind"] not in {"write", "activation"}
            or record.get("worker_id") != str(worker_id)
            or record.get("ticket") != str(ticket)
        ):
            raise WorkflowError("WORKER_CLAIM_MISMATCH", 403)
        return record

    def binding(self, session, record):
        cap = Cap.REPOSITORY_WRITE if record["kind"] == "write" else Cap.DEPLOYMENT_ACTIVATE
        self.operations.actor(session, record, cap)
        revision, base, candidate = self.operations.revision(
            session,
            self.scope,
            record["proposal_id"],
            record["revision"],
            record["artifact_digest"],
        )
        if record["kind"] == "write":
            base = self.proposals.snapshots.read_in_transaction(
                session.snapshot,
                self.scope,
                UUID(record["expected_snapshot_id"]),
                base.snapshot.repository_identity,
            )
        return revision, base, candidate

    def bundle(self, identifier, worker_id, ticket):
        with self.proposals.transactions.open() as session:
            record = self.claimed(session, identifier, worker_id, ticket)
            if record["status"] not in {"preparing", "running", "unknown"}:
                raise WorkflowError("INVALID_TRANSITION")
            _, base, candidate = self.binding(session, record)
            result = {
                "base": encode_bundle(base),
                "candidate": encode_bundle(candidate),
                "profile": self.proposals.profile.metadata(),
            }
        return result

    def permit(self, identifier, worker_id, ticket):
        denied = False
        with self.proposals.transactions.open() as session:
            operation = self.claimed(session, identifier, worker_id, ticket)
            if operation["status"] != "preparing":
                raise WorkflowError("INVALID_TRANSITION")
            try:
                revision, base, candidate = self.binding(session, operation)
                self.operations.current_source(base, candidate)
                if operation["kind"] == "activation":
                    target = self.operations.resource(session, self.scope, TARGET_ID, "target")
                    approval = self.operations.resource(
                        session, self.scope, operation["approval_id"], "approval"
                    )
                    if (
                        target.get("pending_id") != operation["id"]
                        or target["version"] != operation["target_version"]
                    ):
                        raise WorkflowError("TARGET_BUSY_OR_CHANGED")
                    self.runtime.validate_approval(
                        session, approval, revision, target, operation["id"]
                    )
                    operation["target"] = target
            except (ControlAccessDenied, ControlIdentityRequired, WorkflowError):
                operation.update(status="blocked", reason="DISPATCH_DENIED")
                self._release(session, operation)
                denied = True
            else:
                operation.update(
                    status="running",
                    permit_id=str(uuid4()),
                    permit_expires_at=session.workspace.now() + 30,
                )
            session.workspace.update(self.scope, operation)
        if denied:
            raise WorkflowError("DISPATCH_DENIED", 403)
        return operation

    def _release(self, session, operation):
        if operation["kind"] != "activation":
            return
        target = self.operations.resource(session, self.scope, TARGET_ID, "target")
        if target.get("pending_id") == operation["id"]:
            target["pending_id"] = None
            session.workspace.update(self.scope, target)

    def report(self, identifier, worker_id, ticket, result):
        allowed = {"status", "reason", "source_digest", "container_name", "observed_artifact"}
        if (
            set(result) - allowed
            or result.get("status") not in {"succeeded", "failed", "unknown"}
            or result.get("reason")
            not in {
                "COMPLETED",
                "SOURCE_CONFLICT",
                "WORKER_INTERRUPTED",
                "EXECUTOR_ERROR",
                "SOURCE_UNAVAILABLE",
                "RUNTIME_UNAVAILABLE",
                "TARGET_MISMATCH",
                "PERMIT_EXPIRED",
            }
        ):
            raise WorkflowError("INVALID_OPERATION_RESULT", 400)
        with self.proposals.transactions.open() as session:
            operation = self.claimed(session, identifier, worker_id, ticket)
            if operation["status"] in {"succeeded", "failed", "blocked"}:
                if operation.get("report") != result:
                    raise WorkflowError("RESULT_CONFLICT")
                return public_operation(operation)
            if operation["status"] not in {"preparing", "running", "unknown"}:
                raise WorkflowError("INVALID_TRANSITION")
            if result["status"] == "succeeded":
                if operation["status"] == "preparing" or result["reason"] != "COMPLETED":
                    raise WorkflowError("INVALID_OPERATION_RESULT", 400)
                if operation["kind"] == "write":
                    if result.get("source_digest") != operation["source_digest"]:
                        raise WorkflowError("BINDING_MISMATCH")
                elif (
                    result.get("observed_artifact") != operation["artifact_digest"]
                    or result.get("container_name") != "cachesec-local-" + UUID(operation["id"]).hex
                ):
                    raise WorkflowError("BINDING_MISMATCH")
            if operation["kind"] == "activation":
                target = self.operations.resource(session, self.scope, TARGET_ID, "target")
                if target.get("pending_id") != operation["id"]:
                    raise WorkflowError("TARGET_BUSY_OR_CHANGED")
                if result["status"] == "succeeded":
                    target.update(
                        version=target["version"] + 1,
                        active_artifact=operation["artifact_digest"],
                        container_name=result["container_name"],
                        pending_id=None,
                        status="running",
                    )
                elif result["status"] == "failed":
                    # A failed dispatch may already have stopped the previous process.
                    target.update(
                        version=target["version"] + 1,
                        active_artifact=None,
                        container_name=None,
                        pending_id=None,
                        status="unavailable",
                    )
                session.workspace.update(self.scope, target)
            operation.update(status=result["status"], reason=result["reason"], report=result)
            if result.get("container_name"):
                operation["container_name"] = result["container_name"]
            session.workspace.update(self.scope, operation)
            view = public_operation(operation)
        return view
