"""Queue real source writes without executing code or accepting client-selected paths."""

from uuid import UUID, uuid4

from app.artifacts.blob_models import content_digest
from app.change_workflow.proposal_service import request_identity
from app.change_workflow.test_profiles import EDITABLE_PATH
from app.change_workflow.workflow_repository import WorkflowError
from app.identity.control_authority import ControlCapability as Cap
from app.identity.control_authority import ControlResourceUnavailable

TARGET_ID = UUID("00000000-0000-0000-0000-000000000001")
TERMINAL = frozenset({"succeeded", "failed", "blocked", "unknown"})


def public_operation(record):
    return {
        key: record.get(key)
        for key in (
            "id",
            "kind",
            "status",
            "proposal_id",
            "revision",
            "artifact_digest",
            "profile_digest",
            "job_id",
            "evidence_digest",
            "created_at",
            "reason",
            "source_digest",
            "container_name",
            "target_version",
            "approval_id",
        )
    }


class SourceOperationsService:
    def __init__(self, proposals, scope):
        self.proposals, self.scope = proposals, scope

    def revision(self, session, scope, proposal_id, revision, artifact):
        record = session.workflow.get_proposal(scope, UUID(str(proposal_id)))
        if record is None:
            raise ControlResourceUnavailable()
        if record["revision"] != revision or record["artifact_digest"] != artifact:
            raise WorkflowError("STALE_REVISION")
        repository = session.snapshot.authority.lock_scope(scope)
        base = self.proposals.snapshots.read_in_transaction(
            session.snapshot, scope, record["base_snapshot_id"], repository.identity
        )
        candidate = self.proposals.snapshots.read_in_transaction(
            session.snapshot, scope, record["candidate_snapshot_id"], repository.identity
        )
        self.proposals.verify_revision(session, scope, record, base, candidate)
        return record, base, candidate

    def current_source(self, base, candidate):
        if not (
            self.proposals.snapshots.matches_working_tree(base)
            or self.proposals.snapshots.matches_working_tree(candidate)
        ):
            raise WorkflowError("STALE_SNAPSHOT")

    def resource(self, session, scope, identifier, kind=None):
        record = session.workspace.get(scope, UUID(str(identifier)))
        if record is None or (kind is not None and record["kind"] != kind):
            raise ControlResourceUnavailable()
        return record

    def create(self, session, caller, kind, payload, key):
        key_hash, digest = request_identity(key, {"operation": "workspace_" + kind, **payload})
        previous = session.workflow.get_request(caller.scope, caller.principal_id, key_hash)
        if previous:
            if previous[0] != digest:
                raise WorkflowError("IDEMPOTENCY_CONFLICT")
            return self.resource(session, caller.scope, previous[1]["id"], kind)
        record = {
            **payload,
            "id": str(uuid4()),
            "kind": kind,
            "status": "queued",
            "actor_id": str(caller.principal_id),
            "credential_version": caller.credential_version,
            "credential_digest": caller.token_digest.hex(),
            "created_at": session.workspace.now(),
            "reason": None,
        }
        session.workspace.add(caller.scope, record)
        session.workflow.save_request(
            caller.scope, caller.principal_id, key_hash, digest, {"id": record["id"]}
        )
        return record

    def save(self, token, proposal_id, revision, artifact_digest, expected_snapshot_id, key):
        with self.proposals.transactions.open() as session:
            caller, _ = self.proposals.authorize(session, token, Cap.REPOSITORY_WRITE)
            record, base, candidate = self.revision(
                session, caller.scope, proposal_id, revision, artifact_digest
            )
            expected = self.proposals.snapshots.read_in_transaction(
                session.snapshot,
                caller.scope,
                expected_snapshot_id,
                base.snapshot.repository_identity,
            )
            if tuple(f.path for f in expected.files) != tuple(f.path for f in base.files) or any(
                a != b
                for a, b in zip(expected.files, base.files, strict=True)
                if a.path != EDITABLE_PATH
            ):
                raise WorkflowError("SOURCE_SCOPE_MISMATCH")
            self.current_source(expected, candidate)
            payload = {
                "proposal_id": str(proposal_id),
                "revision": revision,
                "artifact_digest": artifact_digest,
                "profile_digest": record["profile_digest"],
                "expected_snapshot_id": str(expected_snapshot_id),
                "source_digest": content_digest(
                    next(f.content for f in candidate.files if f.path == EDITABLE_PATH)
                ),
            }
            result = public_operation(self.create(session, caller, "write", payload, key))
        return result

    def get(self, token, identifier):
        with self.proposals.transactions.open() as session:
            caller, _ = self.proposals.authorize(session, token)
            record = self.resource(session, caller.scope, identifier)
            if record["kind"] in {"approval", "activation", "target"}:
                self.proposals.authorizer.require(
                    session.snapshot.authority,
                    caller,
                    caller.scope,
                    frozenset({Cap.DEPLOYMENT_READ}),
                )
            elif record["actor_id"] != str(caller.principal_id):
                raise ControlResourceUnavailable()
            result = public_operation(record)
        return result

    def actor(self, session, record, *caps):
        principal = session.snapshot.authority.get_principal(self.scope, UUID(record["actor_id"]))
        if (
            principal is None
            or not principal.active
            or principal.credential_version != record["credential_version"]
            or principal.token_digest.hex() != record["credential_digest"]
        ):
            raise WorkflowError("REQUESTER_IDENTITY_CHANGED", 403)
        self.proposals.authorizer.require(
            session.snapshot.authority,
            principal,
            self.scope,
            frozenset({Cap.REPOSITORY_READ, *caps}),
        )
        self.proposals.require_profile(session, self.scope)
        return principal
