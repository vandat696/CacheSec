"""Worker protocol: claim, verified bundle, fresh dispatch permit, immutable result."""

from base64 import b64encode
from uuid import UUID, uuid4

from app.artifacts.metadata_encoding import encode_metadata
from app.change_workflow.proposal_service import ProposalService
from app.change_workflow.test_profiles import CHECK_NAMES
from app.change_workflow.workflow_models import TERMINAL_STATUSES, job_view
from app.change_workflow.workflow_repository import WorkflowError
from app.identity.control_authority import (
    ControlAccessDenied,
    ControlIdentityRequired,
    ControlResourceUnavailable,
)

RESULT_REASONS = frozenset(
    {
        "COMPLETED",
        "CHECK_FAILED",
        "APP_START_FAILED",
        "APP_START_TIMEOUT",
        "HTTP_TIMEOUT",
        "TEST_DEADLINE",
        "OUTPUT_LIMIT",
        "SANDBOX_UNAVAILABLE",
        "PROFILE_MISMATCH",
        "WORKER_INTERRUPTED",
        "EXECUTOR_ERROR",
        "CLEANUP_UNCERTAIN",
    }
)


class TestJobService:
    def __init__(self, proposals: ProposalService, scope):
        self.proposals, self.scope = proposals, scope

    def _scope(self, session):
        repository = session.snapshot.authority.lock_scope(self.scope)
        if repository is None:
            raise ControlResourceUnavailable()
        return repository

    def _job(self, session, job_id, worker_id, ticket):
        self._scope(session)
        job = session.workflow.get_job(self.scope, job_id)
        if job is None:
            raise ControlResourceUnavailable()
        if job["worker_id"] != worker_id or job["ticket"] != ticket:
            raise WorkflowError("WORKER_CLAIM_MISMATCH", 403)
        return job

    def _blocked(self, session, job, reason):
        job.update(
            status="blocked",
            result={"outcome": "blocked", "reason": reason, "checks": [], "elapsed_ms": 0},
        )
        session.workflow.update_job(self.scope, job)

    def claim(self, worker_id: UUID):
        with self.proposals.transactions.open() as session:
            self._scope(session)
            job = session.workflow.next_job(self.scope)
            if job is None:
                return None
            try:
                self.proposals.validate_job_actor(session, self.scope, job)
            except (ControlAccessDenied, ControlIdentityRequired, WorkflowError):
                self._blocked(session, job, "REQUESTER_ACCESS_DENIED")
                result = None
            else:
                job.update(status="preparing", worker_id=worker_id, ticket=uuid4())
                session.workflow.update_job(self.scope, job)
                result = {
                    **job_view(job),
                    "ticket": job["ticket"],
                    "profile": self.proposals.profile.metadata(),
                }
        return result

    def owned(self, worker_id):
        with self.proposals.transactions.open() as session:
            self._scope(session)
            result = [
                {**job_view(j), "ticket": j["ticket"]}
                for j in session.workflow.owned_jobs(self.scope, worker_id)
            ]
        return result

    def bundle(self, job_id, worker_id, ticket):
        with self.proposals.transactions.open() as session:
            job = self._job(session, job_id, worker_id, ticket)
            if job["status"] != "preparing":
                raise WorkflowError("INVALID_TRANSITION")
            self.proposals.validate_job_actor(session, self.scope, job)
            repository = self._scope(session)
            record = session.workflow.get_revision(self.scope, job["proposal_id"], job["revision"])
            if record is None or record["artifact_digest"] != job["artifact_digest"]:
                raise WorkflowError("BINDING_MISMATCH")
            base = self.proposals.snapshots.read_in_transaction(
                session.snapshot, self.scope, record["base_snapshot_id"], repository.identity
            )
            candidate = self.proposals.snapshots.read_in_transaction(
                session.snapshot, self.scope, record["candidate_snapshot_id"], repository.identity
            )
            self.proposals.verify_revision(session, self.scope, record, base, candidate)
            s = candidate.snapshot
            result = {
                "tenant_id": str(self.scope.tenant_id),
                "repo_id": str(self.scope.repo_id),
                "snapshot_id": str(s.snapshot_id),
                "repository_identity": s.repository_identity,
                "created_by": str(s.created_by),
                "authority_epoch": s.authority_epoch,
                "profile_content": b64encode(candidate.profile_content).decode("ascii"),
                "profile_digest": s.profile_blob.digest,
                "profile_size": s.profile_blob.byte_size,
                "manifest_digest": s.manifest_blob.digest,
                "manifest_size": s.manifest_blob.byte_size,
                "files": [
                    {
                        "file_id": str(ref.file_id),
                        "path": ref.path,
                        "digest": ref.blob.digest,
                        "byte_size": ref.blob.byte_size,
                        "content": b64encode(item.content).decode("ascii"),
                    }
                    for ref, item in zip(s.files, candidate.files, strict=True)
                ],
            }
        return result

    def permit(self, job_id, worker_id, ticket):
        blocked = False
        with self.proposals.transactions.open() as session:
            job = self._job(session, job_id, worker_id, ticket)
            if job["status"] != "preparing":
                raise WorkflowError("INVALID_TRANSITION")
            try:
                self.proposals.validate_job_actor(session, self.scope, job)
                repository = self._scope(session)
                record = session.workflow.get_revision(
                    self.scope, job["proposal_id"], job["revision"]
                )
                if record is None or record["artifact_digest"] != job["artifact_digest"]:
                    raise WorkflowError("BINDING_MISMATCH")
                base = self.proposals.snapshots.read_in_transaction(
                    session.snapshot, self.scope, record["base_snapshot_id"], repository.identity
                )
                candidate = self.proposals.snapshots.read_in_transaction(
                    session.snapshot,
                    self.scope,
                    record["candidate_snapshot_id"],
                    repository.identity,
                )
                self.proposals.verify_revision(session, self.scope, record, base, candidate)
                if not self.proposals.snapshots.matches_working_tree(base):
                    raise WorkflowError("STALE_SNAPSHOT")
            except (ControlAccessDenied, ControlIdentityRequired, WorkflowError):
                self._blocked(session, job, "REQUESTER_OR_SOURCE_CHANGED")
                blocked = True
            else:
                job["status"] = "running"
                session.workflow.update_job(self.scope, job)
        if blocked:
            raise WorkflowError("TEST_DISPATCH_BLOCKED", 403)
        return {
            "job_id": job["job_id"],
            "artifact_digest": job["artifact_digest"],
            "profile_digest": job["profile_digest"],
        }

    def report(self, job_id, worker_id, ticket, result):
        if (
            type(result) is not dict
            or set(result) != {"outcome", "reason", "elapsed_ms", "checks"}
            or result["outcome"] not in {"passed", "failed", "error", "timed_out", "unknown"}
            or result["reason"] not in RESULT_REASONS
            or type(result["elapsed_ms"]) is not int
            or not 0 <= result["elapsed_ms"] <= 3600000
            or type(result["checks"]) is not list
            or len(result["checks"]) > len(CHECK_NAMES)
        ):
            raise WorkflowError("INVALID_TEST_RESULT", 400)
        names = []
        for check in result["checks"]:
            if (
                type(check) is not dict
                or set(check) != {"name", "passed"}
                or check["name"] not in CHECK_NAMES
                or type(check["passed"]) is not bool
                or check["name"] in names
            ):
                raise WorkflowError("INVALID_TEST_RESULT", 400)
            names.append(check["name"])
        if result["outcome"] == "passed" and (
            tuple(names) != CHECK_NAMES
            or not all(c["passed"] for c in result["checks"])
            or result["reason"] != "COMPLETED"
        ):
            raise WorkflowError("INVALID_TEST_RESULT", 400)
        with self.proposals.transactions.open() as session:
            job = self._job(session, job_id, worker_id, ticket)
            if job["status"] in TERMINAL_STATUSES:
                if job["status"] == "blocked":
                    return job_view(job)
                if job["result"] != result:
                    raise WorkflowError("RESULT_CONFLICT")
            else:
                if job["status"] not in {"preparing", "running"} or (
                    job["status"] == "preparing" and result["outcome"] in {"passed", "failed"}
                ):
                    raise WorkflowError("INVALID_TRANSITION")
                evidence = {
                    "kind": "technical-test-evidence",
                    "schema_version": 1,
                    "job_id": str(job_id),
                    "proposal_id": str(job["proposal_id"]),
                    "revision": job["revision"],
                    "artifact_digest": job["artifact_digest"],
                    "profile_digest": job["profile_digest"],
                    "worker_id": str(worker_id),
                    "purpose": "technical-smoke",
                    "result": result,
                }
                ref = self.proposals.publish(session, encode_metadata(evidence))
                job.update(
                    status=result["outcome"],
                    result=result,
                    evidence_digest=ref.digest,
                    evidence_size=ref.byte_size,
                )
                session.workflow.update_job(self.scope, job)
            view = job_view(job)
        return view
