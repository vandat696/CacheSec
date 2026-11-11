"""Scoped immutable revisions. Saving a proposal never modifies the working tree."""

import difflib
import hmac
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.artifacts.blob_models import BlobReference, content_digest
from app.artifacts.blob_storage_service import BlobBytesStore
from app.artifacts.metadata_encoding import encode_metadata, metadata_digest
from app.change_workflow.test_profiles import EDITABLE_PATH, OVERLAY_PATHS, TechnicalTestProfile
from app.change_workflow.workflow_models import JobRecord, RevisionRecord, job_view
from app.change_workflow.workflow_repository import (
    WorkflowError,
    WorkflowSession,
    WorkflowSnapshots,
    WorkflowTransactions,
)
from app.identity.control_authority import (
    ControlAuthorizer,
    ControlCapability,
    ControlResourceUnavailable,
)
from app.repositories.snapshot_models import CapturedSourceFile, SnapshotIntegrityError


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def request_identity(key: str | None, payload: dict) -> tuple[str, str]:
    if (
        not key
        or len(key) > 128
        or not key.isascii()
        or any(ord(c) < 33 or ord(c) > 126 for c in key)
    ):
        raise WorkflowError("INVALID_IDEMPOTENCY_KEY", 400)
    return content_digest(key.encode("ascii")), metadata_digest(
        {"kind": "workflow-request", "schema_version": 1, **payload}
    )


class ProposalService:
    def __init__(
        self,
        transactions: WorkflowTransactions,
        snapshots: WorkflowSnapshots,
        blobs: BlobBytesStore,
        profile: TechnicalTestProfile,
    ):
        self.transactions, self.snapshots, self.blobs, self.profile = (
            transactions,
            snapshots,
            blobs,
            profile,
        )
        self.authorizer = ControlAuthorizer()

    def authorize(
        self, session: WorkflowSession, token: str | None, *capabilities: ControlCapability
    ):
        caller = self.authorizer.authenticate(session.snapshot.authority, token)
        repository = self.authorizer.require(
            session.snapshot.authority,
            caller,
            caller.scope,
            frozenset({ControlCapability.REPOSITORY_READ, *capabilities}),
        )
        self.require_profile(session, caller.scope)
        return caller, repository

    def require_profile(self, session, scope):
        if session.workflow.active_profile(scope) != self.profile.digest:
            raise WorkflowError("TEST_PROFILE_UNAVAILABLE", 503)
        raw = encode_metadata(self.profile.metadata())
        ref = BlobReference(self.profile.digest, len(raw))
        if session.snapshot.blobs.get(ref.digest) != ref or self.blobs.get(ref.digest) != raw:
            raise SnapshotIntegrityError("Registered test profile bytes differ.")

    def publish(self, session, content: bytes) -> BlobReference:
        expected = BlobReference(content_digest(content), len(content))
        if self.blobs.put(content) != expected or self.blobs.get(expected.digest) != content:
            raise SnapshotIntegrityError("Workflow publication does not preserve bytes.")
        session.snapshot.blobs.register(expected)
        return expected

    def config(self, token):
        with self.transactions.open() as session:
            caller, repository = self.authorize(session, token)
            caps = session.snapshot.authority.capabilities(caller.scope, caller.principal_id)
            result = {
                "editable_path": EDITABLE_PATH,
                "profile_digest": self.profile.digest,
                "purpose": "technical-smoke",
                "can_propose": ControlCapability.PROPOSAL_CREATE in caps,
                "can_test": ControlCapability.TEST_RUN in caps,
                "repository_identity": repository.identity,
            }
        return result

    def revision_view(self, session, scope, identity: str, record: RevisionRecord):
        if record["profile_digest"] != self.profile.digest:
            raise WorkflowError("TEST_PROFILE_CHANGED")
        base = self.snapshots.read_in_transaction(
            session.snapshot, scope, record["base_snapshot_id"], identity
        )
        candidate = self.snapshots.read_in_transaction(
            session.snapshot, scope, record["candidate_snapshot_id"], identity
        )
        self.verify_revision(session, scope, record, base, candidate)
        base_text = next(f.content for f in base.files if f.path == EDITABLE_PATH).decode("utf-8")
        candidate_text = next(f.content for f in candidate.files if f.path == EDITABLE_PATH).decode(
            "utf-8"
        )
        diff = "".join(
            difflib.unified_diff(
                base_text.splitlines(keepends=True),
                candidate_text.splitlines(keepends=True),
                fromfile="base/" + EDITABLE_PATH,
                tofile="candidate/" + EDITABLE_PATH,
            )
        )
        return {
            key: record[key]
            for key in (
                "proposal_id",
                "revision",
                "base_snapshot_id",
                "candidate_snapshot_id",
                "artifact_digest",
                "patch_digest",
                "profile_digest",
                "created_at",
            )
        } | {
            "path": EDITABLE_PATH,
            "base_text": base_text,
            "content": candidate_text,
            "diff": diff,
            "tests": [
                job_view(job) for job in session.workflow.list_jobs(scope, record["proposal_id"])
            ],
        }

    def artifact_metadata(self, scope, base, candidate, patch_digest):
        return {
            "kind": "technical-source-artifact",
            "schema_version": 1,
            "tenant_id": str(scope.tenant_id),
            "repo_id": str(scope.repo_id),
            "base_manifest": base.snapshot.manifest_blob.digest,
            "candidate_manifest": candidate.snapshot.manifest_blob.digest,
            "profile_digest": self.profile.digest,
            "runtime_image": self.profile.runtime_image,
            "harness_image": self.profile.harness_image,
            "platform": self.profile.platform,
            "lockfile_digest": self.profile.lockfile_digest,
            "inventory_digest": self.profile.inventory_digest,
            "purpose": "technical-smoke",
            "patch_digest": patch_digest,
        }

    def verify_revision(self, session, scope, record, base, candidate):
        if (
            tuple(f.path for f in base.files) != OVERLAY_PATHS
            or tuple(f.path for f in candidate.files) != OVERLAY_PATHS
        ):
            raise SnapshotIntegrityError("Revision source scope differs.")
        for before, after in zip(base.files, candidate.files, strict=True):
            protected_digest = dict(self.profile.protected_files).get(before.path)
            if protected_digest and content_digest(before.content) != protected_digest:
                raise WorkflowError("RUNTIME_SOURCE_MISMATCH")
            if before.path != EDITABLE_PATH and before != after:
                raise SnapshotIntegrityError("Revision changes a protected file.")
        original = next(f.content for f in base.files if f.path == EDITABLE_PATH)
        changed = next(f.content for f in candidate.files if f.path == EDITABLE_PATH)
        patch = encode_metadata(
            {
                "kind": "patch-manifest",
                "schema_version": 1,
                "files": [
                    {
                        "path": EDITABLE_PATH,
                        "operation": "modify",
                        "base_blob_digest": content_digest(original),
                        "candidate_blob_digest": content_digest(changed),
                    }
                ],
            }
        )
        artifact = encode_metadata(
            self.artifact_metadata(scope, base, candidate, content_digest(patch))
        )
        for name, expected in (("patch", patch), ("artifact", artifact)):
            ref = BlobReference(record[name + "_digest"], record[name + "_size"])
            if (
                session.snapshot.blobs.get(ref.digest) != ref
                or ref.digest != content_digest(expected)
                or ref.byte_size != len(expected)
                or self.blobs.get(ref.digest) != expected
            ):
                raise SnapshotIntegrityError("Revision metadata bytes differ from its binding.")

    def save(
        self,
        token,
        base_snapshot_id: UUID | None,
        content: str,
        key: str | None,
        proposal_id: UUID | None = None,
        expected_revision: int = 0,
    ):
        try:
            raw = content.encode("utf-8")
        except UnicodeError:
            raise WorkflowError("INVALID_SOURCE", 400) from None
        if len(raw) > 65536:
            raise WorkflowError("PAYLOAD_TOO_LARGE", 413)
        key_hash, payload = request_identity(
            key,
            {
                "operation": "save",
                "base_snapshot_id": str(base_snapshot_id),
                "proposal_id": str(proposal_id),
                "expected_revision": expected_revision,
                "content_digest": content_digest(raw),
            },
        )
        with self.transactions.open() as session:
            caller, repository = self.authorize(session, token, ControlCapability.PROPOSAL_CREATE)
            replay = session.workflow.get_request(caller.scope, caller.principal_id, key_hash)
            if replay:
                if replay[0] != payload:
                    raise WorkflowError("IDEMPOTENCY_CONFLICT")
                record = session.workflow.get_revision(
                    caller.scope, UUID(replay[1]["proposal_id"]), replay[1]["revision"]
                )
                if record is None:
                    raise ControlResourceUnavailable()
            else:
                if proposal_id is not None:
                    previous = session.workflow.get_proposal(caller.scope, proposal_id)
                    if previous is None:
                        raise ControlResourceUnavailable()
                    if (
                        previous["revision"] != expected_revision
                        or previous["profile_digest"] != self.profile.digest
                    ):
                        raise WorkflowError("STALE_REVISION")
                    base_snapshot_id = previous["base_snapshot_id"]
                elif expected_revision != 0 or base_snapshot_id is None:
                    raise WorkflowError("INVALID_REQUEST", 400)
                base = self.snapshots.read_in_transaction(
                    session.snapshot, caller.scope, base_snapshot_id, repository.identity
                )
                if tuple(f.path for f in base.files) != OVERLAY_PATHS:
                    raise WorkflowError("SOURCE_SCOPE_MISMATCH")
                if not self.snapshots.matches_working_tree(base):
                    raise WorkflowError("STALE_SNAPSHOT")
                original = next(f.content for f in base.files if f.path == EDITABLE_PATH)
                if original == raw:
                    raise WorkflowError("NO_CHANGE", 400)
                captured = tuple(
                    CapturedSourceFile(f.path, raw if f.path == EDITABLE_PATH else f.content)
                    for f in base.files
                )
                candidate = self.snapshots.store_in_transaction(
                    session.snapshot,
                    base,
                    captured,
                    caller.principal_id,
                    repository.authority_epoch,
                )
                patch = {
                    "kind": "patch-manifest",
                    "schema_version": 1,
                    "files": [
                        {
                            "path": EDITABLE_PATH,
                            "operation": "modify",
                            "base_blob_digest": content_digest(original),
                            "candidate_blob_digest": content_digest(raw),
                        }
                    ],
                }
                patch_ref = self.publish(session, encode_metadata(patch))
                candidate_bundle = self.snapshots.read_in_transaction(
                    session.snapshot, caller.scope, candidate.snapshot_id, repository.identity
                )
                artifact = self.artifact_metadata(
                    caller.scope, base, candidate_bundle, patch_ref.digest
                )
                artifact_ref = self.publish(session, encode_metadata(artifact))
                record = {
                    "proposal_id": proposal_id or uuid4(),
                    "revision": expected_revision + 1,
                    "base_snapshot_id": base_snapshot_id,
                    "candidate_snapshot_id": candidate.snapshot_id,
                    "created_by": caller.principal_id,
                    "patch_digest": patch_ref.digest,
                    "patch_size": patch_ref.byte_size,
                    "artifact_digest": artifact_ref.digest,
                    "artifact_size": artifact_ref.byte_size,
                    "profile_digest": self.profile.digest,
                    "created_at": now(),
                }
                session.workflow.add_revision(caller.scope, record, expected_revision)
                record = session.workflow.get_revision(
                    caller.scope, record["proposal_id"], record["revision"]
                )
                session.workflow.save_request(
                    caller.scope,
                    caller.principal_id,
                    key_hash,
                    payload,
                    {"proposal_id": str(record["proposal_id"]), "revision": record["revision"]},
                )
            view = self.revision_view(session, caller.scope, repository.identity, record)
        return view

    def get(self, token, proposal_id: UUID, revision: int | None = None):
        with self.transactions.open() as session:
            caller, repository = self.authorize(session, token)
            record = (
                session.workflow.get_revision(caller.scope, proposal_id, revision)
                if revision
                else session.workflow.get_proposal(caller.scope, proposal_id)
            )
            if record is None:
                raise ControlResourceUnavailable()
            result = self.revision_view(session, caller.scope, repository.identity, record)
        return result

    def request_test(self, token, proposal_id: UUID, revision: int, key: str | None):
        key_hash, payload = request_identity(
            key, {"operation": "test", "proposal_id": str(proposal_id), "revision": revision}
        )
        with self.transactions.open() as session:
            caller, _ = self.authorize(session, token, ControlCapability.TEST_RUN)
            replay = session.workflow.get_request(caller.scope, caller.principal_id, key_hash)
            if replay:
                if replay[0] != payload:
                    raise WorkflowError("IDEMPOTENCY_CONFLICT")
                job = session.workflow.get_job(caller.scope, UUID(replay[1]["job_id"]))
            else:
                record = session.workflow.get_proposal(caller.scope, proposal_id)
                if record is None:
                    raise ControlResourceUnavailable()
                if (
                    record["revision"] != revision
                    or record["profile_digest"] != self.profile.digest
                ):
                    raise WorkflowError("STALE_REVISION")
                job: JobRecord = {
                    "job_id": uuid4(),
                    "proposal_id": proposal_id,
                    "revision": revision,
                    "actor_id": caller.principal_id,
                    "credential_version": caller.credential_version,
                    "credential_digest": caller.token_digest,
                    "artifact_digest": record["artifact_digest"],
                    "profile_digest": record["profile_digest"],
                    "status": "queued",
                    "worker_id": None,
                    "ticket": None,
                    "result": None,
                    "evidence_digest": None,
                    "evidence_size": None,
                    "created_at": now(),
                    "updated_at": now(),
                }
                session.workflow.add_job(caller.scope, job)
                job = session.workflow.get_job(caller.scope, job["job_id"])
                session.workflow.save_request(
                    caller.scope,
                    caller.principal_id,
                    key_hash,
                    payload,
                    {"job_id": str(job["job_id"])},
                )
            if job is None:
                raise ControlResourceUnavailable()
            result = job_view(job)
        return result

    def job(self, token, job_id: UUID):
        with self.transactions.open() as session:
            caller, _ = self.authorize(session, token)
            job = session.workflow.get_job(caller.scope, job_id)
            if job is None:
                raise ControlResourceUnavailable()
            result = job_view(job)
        return result

    def validate_job_actor(self, session, scope, job: JobRecord):
        if job["profile_digest"] != self.profile.digest:
            raise WorkflowError("TEST_PROFILE_CHANGED")
        caller = session.snapshot.authority.get_principal(scope, job["actor_id"])
        if (
            caller is None
            or not caller.active
            or caller.credential_version != job["credential_version"]
            or not hmac.compare_digest(caller.token_digest, job["credential_digest"])
        ):
            raise WorkflowError("REQUESTER_IDENTITY_CHANGED")
        self.authorizer.require(
            session.snapshot.authority,
            caller,
            scope,
            frozenset({ControlCapability.REPOSITORY_READ, ControlCapability.TEST_RUN}),
        )
        self.require_profile(session, scope)
        return caller
