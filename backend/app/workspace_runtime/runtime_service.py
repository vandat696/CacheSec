"""Explicit human approval of immutable test evidence and one local activation."""

from uuid import UUID

from app.artifacts.blob_models import content_digest
from app.artifacts.metadata_encoding import encode_metadata
from app.change_workflow.proposal_service import request_identity
from app.change_workflow.workflow_repository import WorkflowError
from app.identity.control_authority import ControlCapability as Cap
from app.workspace_runtime.source_operations import TARGET_ID, public_operation


class LocalRuntimeService:
    def __init__(self, operations):
        self.operations = operations
        self.proposals = operations.proposals

    def config(self, token):
        with self.proposals.transactions.open() as session:
            caller, _ = self.proposals.authorize(session, token)
            caps = session.snapshot.authority.capabilities(caller.scope, caller.principal_id)
            target = session.workspace.get(caller.scope, TARGET_ID)
            result = {
                "can_write": Cap.REPOSITORY_WRITE in caps,
                "can_review": Cap.CHANGE_REVIEW in caps,
                "can_activate": Cap.DEPLOYMENT_ACTIVATE in caps,
                "can_read": Cap.DEPLOYMENT_READ in caps,
                "configured": target is not None,
                "target_version": target["version"]
                if target and Cap.DEPLOYMENT_READ in caps
                else None,
                "active_artifact": target.get("active_artifact")
                if target and Cap.DEPLOYMENT_READ in caps
                else None,
                "pending_id": target.get("pending_id")
                if target and Cap.DEPLOYMENT_READ in caps
                else None,
            }
        return result

    def evidence(self, session, scope, record, job_id):
        job = session.workflow.get_job(scope, UUID(str(job_id)))
        if (
            job is None
            or job["status"] != "passed"
            or not job["evidence_digest"]
            or any(
                job[k] != record[k]
                for k in ("proposal_id", "revision", "artifact_digest", "profile_digest")
            )
        ):
            raise WorkflowError("PASSED_EVIDENCE_REQUIRED")
        expected = encode_metadata(
            {
                "kind": "technical-test-evidence",
                "schema_version": 1,
                "job_id": str(job["job_id"]),
                "proposal_id": str(job["proposal_id"]),
                "revision": job["revision"],
                "artifact_digest": job["artifact_digest"],
                "profile_digest": job["profile_digest"],
                "worker_id": str(job["worker_id"]),
                "purpose": "technical-smoke",
                "result": job["result"],
            }
        )
        if (
            content_digest(expected) != job["evidence_digest"]
            or len(expected) != job["evidence_size"]
            or self.proposals.blobs.get(job["evidence_digest"]) != expected
        ):
            raise WorkflowError("EVIDENCE_INTEGRITY_UNVERIFIED", 503)
        return job

    def approve(self, token, proposal_id, revision, artifact_digest, job_id, key):
        with self.proposals.transactions.open() as session:
            caller, _ = self.proposals.authorize(
                session, token, Cap.CHANGE_REVIEW, Cap.DEPLOYMENT_READ
            )
            target = self.operations.resource(session, caller.scope, TARGET_ID, "target")
            record, base, candidate = self.operations.revision(
                session, caller.scope, proposal_id, revision, artifact_digest
            )
            self.operations.current_source(base, candidate)
            job = self.evidence(session, caller.scope, record, job_id)
            approval = self.operations.create(
                session,
                caller,
                "approval",
                {
                    "proposal_id": str(proposal_id),
                    "revision": revision,
                    "artifact_digest": artifact_digest,
                    "profile_digest": record["profile_digest"],
                    "job_id": str(job_id),
                    "evidence_digest": job["evidence_digest"],
                    "target_config_digest": target["config_digest"],
                },
                key,
            )
            if approval["status"] == "queued":
                approval.update(
                    status="approved", expires_at=session.workspace.now() + 1800, consumed_by=None
                )
                session.workspace.update(caller.scope, approval)
            result = public_operation(approval)
        return result

    def validate_approval(self, session, approval, record, target, operation_id=None):
        self.operations.actor(session, approval, Cap.CHANGE_REVIEW, Cap.DEPLOYMENT_READ)
        if (
            approval["status"] != "approved"
            or approval["expires_at"] <= session.workspace.now()
            or approval["consumed_by"] not in (None, operation_id)
            or approval["target_config_digest"] != target["config_digest"]
            or target["profile_digest"] != record["profile_digest"]
            or any(
                approval[k] != (str(record[k]) if k == "proposal_id" else record[k])
                for k in ("proposal_id", "revision", "artifact_digest", "profile_digest")
            )
        ):
            raise WorkflowError("APPROVAL_INVALID")
        job = self.evidence(session, self.operations.scope, record, approval["job_id"])
        if job["evidence_digest"] != approval["evidence_digest"]:
            raise WorkflowError("APPROVAL_INVALID")

    def activate(self, token, approval_id, expected_version, key):
        with self.proposals.transactions.open() as session:
            caller, _ = self.proposals.authorize(
                session, token, Cap.DEPLOYMENT_ACTIVATE, Cap.DEPLOYMENT_READ
            )
            approval = self.operations.resource(session, caller.scope, approval_id, "approval")
            target = self.operations.resource(session, caller.scope, TARGET_ID, "target")
            # Replay is resolved before reservation/version checks; it never dispatches again.
            payload = {
                "approval_id": str(approval_id),
                "target_version": expected_version,
                **{
                    k: approval[k]
                    for k in (
                        "proposal_id",
                        "revision",
                        "artifact_digest",
                        "profile_digest",
                        "job_id",
                        "evidence_digest",
                    )
                },
            }
            key_hash, payload_digest = request_identity(
                key, {"operation": "workspace_activation", **payload}
            )
            replay = session.workflow.get_request(caller.scope, caller.principal_id, key_hash)
            if replay:
                if replay[0] != payload_digest:
                    raise WorkflowError("IDEMPOTENCY_CONFLICT")
                return public_operation(
                    self.operations.resource(session, caller.scope, replay[1]["id"], "activation")
                )
            if target.get("pending_id") or target["version"] != expected_version:
                raise WorkflowError("TARGET_BUSY_OR_CHANGED")
            operation = self.operations.create(session, caller, "activation", payload, key)
            if (
                target.get("pending_id") != operation["id"]
                and approval.get("consumed_by") != operation["id"]
            ):
                if target.get("pending_id") or target["version"] != expected_version:
                    raise WorkflowError("TARGET_BUSY_OR_CHANGED")
                record, base, candidate = self.operations.revision(
                    session,
                    caller.scope,
                    approval["proposal_id"],
                    approval["revision"],
                    approval["artifact_digest"],
                )
                self.operations.current_source(base, candidate)
                self.validate_approval(session, approval, record, target)
                approval["consumed_by"] = operation["id"]
                target["pending_id"] = operation["id"]
                session.workspace.update(caller.scope, approval)
                session.workspace.update(caller.scope, target)
            result = public_operation(operation)
        return result
