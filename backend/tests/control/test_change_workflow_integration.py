from contextlib import contextmanager
from dataclasses import replace
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.artifacts.blob_models import content_digest
from app.artifacts.filesystem_blob_store import FileSystemBlobStore
from app.change_workflow.postgres_test_profile_administration import (
    PostgresTestProfileAdministration,
)
from app.change_workflow.postgres_workflow_transactions import PostgresWorkflowTransactions
from app.change_workflow.proposal_service import ProposalService
from app.change_workflow.test_job_service import TestJobService as TechnicalJobs
from app.change_workflow.test_profiles import (
    CHECK_NAMES,
    EDITABLE_PATH,
    OVERLAY_PATHS,
    TechnicalTestProfile,
)
from app.change_workflow.workflow_http import configure_workflow_http
from app.change_workflow.workflow_repository import WorkflowError, WorkflowStorageUnavailable
from app.control.api.repository_http_app import configure_repository_http
from app.control.database.control_migrations import apply_migrations
from app.identity.control_authority import (
    ControlAccessDenied,
    ControlIdentityRequired,
    ControlPrincipal,
    ControlResourceUnavailable,
    RepositoryAccessService,
    RepositoryScope,
    control_token_digest,
)
from app.identity.control_authority import (
    ControlCapability as Cap,
)
from app.identity.postgres_authority_administration import PostgresAuthorityAdministration
from app.identity.postgres_control_authority import PostgresControlAuthorityTransactions
from app.repositories.filesystem_repository_source import (
    FileSystemRepositorySource,
    RepositorySourceBinding,
)
from app.repositories.postgres_repository_snapshots import PostgresSnapshotTransactions
from app.repositories.postgres_source_profiles import PostgresSourceProfileAdministration
from app.repositories.repository_snapshots import RepositorySnapshotService
from app.repositories.snapshot_models import SnapshotIntegrityError
from app.repositories.source_profiles import SourceProfile

TOKEN = "workflow-test-only-" + "a" * 40
CAPS = frozenset({Cap.REPOSITORY_READ, Cap.PROPOSAL_CREATE, Cap.TEST_RUN})


@pytest.fixture
def workflow(control_database, tmp_path):
    scope = RepositoryScope(uuid4(), uuid4())
    principal = ControlPrincipal(scope, uuid4(), 1, control_token_digest(TOKEN))
    source_profile = SourceProfile(scope, "test-workflow", OVERLAY_PATHS)
    root = tmp_path / "source"
    for path in OVERLAY_PATHS:
        file = root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(b"original\r\n")
    profile = TechnicalTestProfile(
        *("sha256:" + "0" * 64 for _ in range(6)),
        protected_files=tuple((p, content_digest(b"original\r\n")) for p in OVERLAY_PATHS[:2]),
    )
    store = FileSystemBlobStore(tmp_path / "store")
    with control_database.connection() as c:
        apply_migrations(c)
        admin = PostgresAuthorityAdministration(c)
        admin.register_repository(scope, "test-workflow")
        admin.configure_principal(principal, CAPS, expected_epoch=1)
        PostgresSourceProfileAdministration(c).set_profile(source_profile, expected_epoch=2)
        PostgresTestProfileAdministration(c, store).set_profile(scope, profile, expected_epoch=3)
    snapshots = RepositorySnapshotService(
        PostgresSnapshotTransactions(control_database),
        FileSystemRepositorySource((RepositorySourceBinding(source_profile, root),)),
        store,
    )
    snapshot = snapshots.capture(TOKEN, scope)
    proposals = ProposalService(
        PostgresWorkflowTransactions(control_database), snapshots, store, profile
    )
    return SimpleNamespace(
        database=control_database,
        scope=scope,
        principal=principal,
        root=root,
        store=store,
        snapshots=snapshots,
        snapshot=snapshot,
        profile=profile,
        proposals=proposals,
        jobs=TechnicalJobs(proposals, scope),
        worker=uuid4(),
    )


def save(env, content="candidate\r\n"):
    return env.proposals.save(TOKEN, env.snapshot.snapshot_id, content, str(uuid4()))


def queue(env):
    revision = save(env)
    return env.proposals.request_test(TOKEN, revision["proposal_id"], 1, str(uuid4()))


def grants(env, caps):
    with env.database.connection() as c:
        epoch = c.execute("SELECT epoch FROM control.scope_authorities").fetchone()[0]
        PostgresAuthorityAdministration(c).configure_principal(
            env.principal, caps, expected_epoch=epoch
        )


def test_revision_bytes_diff_idempotency_and_immutable_history(workflow):
    e = workflow
    key = str(uuid4())
    first = e.proposals.save(TOKEN, e.snapshot.snapshot_id, "candidate\r\n", key)
    assert first == e.proposals.save(TOKEN, e.snapshot.snapshot_id, "candidate\r\n", key)
    assert first["content"] == "candidate\r\n" and "-original\r\n+candidate\r\n" in first["diff"]
    assert (e.root / EDITABLE_PATH).read_bytes() == b"original\r\n"
    with pytest.raises(WorkflowError, match="IDEMPOTENCY_CONFLICT"):
        e.proposals.save(TOKEN, e.snapshot.snapshot_id, "other", key)
    second = e.proposals.save(TOKEN, None, "second", str(uuid4()), first["proposal_id"], 1)
    assert second["revision"] == 2 and second["artifact_digest"] != first["artifact_digest"]
    assert e.proposals.get(TOKEN, first["proposal_id"], 1)["content"] == first["content"]
    with pytest.raises(WorkflowError, match="STALE_REVISION"):
        e.proposals.save(TOKEN, None, "third", str(uuid4()), first["proposal_id"], 1)
    with pytest.raises(WorkflowError, match="STALE_REVISION"):
        e.proposals.request_test(TOKEN, first["proposal_id"], 1, str(uuid4()))


def test_read_only_cannot_save_or_queue_and_denial_precedes_publication(workflow):
    e = workflow
    revision = save(e)
    grants(e, frozenset({Cap.REPOSITORY_READ}))
    before = e.proposals.get(TOKEN, revision["proposal_id"])
    for action in (
        lambda: save(e),
        lambda: e.proposals.request_test(TOKEN, revision["proposal_id"], 1, str(uuid4())),
    ):
        with pytest.raises(ControlAccessDenied):
            action()
    assert e.proposals.get(TOKEN, revision["proposal_id"]) == before
    assert not e.proposals.config(TOKEN)["can_test"]


@pytest.mark.parametrize("stage", ["claim", "permit"])
def test_revoke_before_dispatch_blocks_execution(workflow, stage):
    e = workflow
    queued = queue(e)
    claimed = e.jobs.claim(e.worker) if stage == "permit" else None
    grants(e, frozenset({Cap.REPOSITORY_READ, Cap.PROPOSAL_CREATE}))
    if stage == "claim":
        assert e.jobs.claim(e.worker) is None
    else:
        with pytest.raises(WorkflowError, match="TEST_DISPATCH_BLOCKED"):
            e.jobs.permit(queued["job_id"], e.worker, claimed["ticket"])
    assert e.proposals.job(TOKEN, queued["job_id"])["status"] == "blocked"


def test_source_drift_or_profile_change_blocks_dispatch(workflow):
    e = workflow
    queued = queue(e)
    claimed = e.jobs.claim(e.worker)
    (e.root / EDITABLE_PATH).write_bytes(b"external change")
    with pytest.raises(WorkflowError, match="TEST_DISPATCH_BLOCKED"):
        e.jobs.permit(queued["job_id"], e.worker, claimed["ticket"])
    with pytest.raises(WorkflowError, match="STALE_SNAPSHOT"):
        save(e)


def test_profile_rotation_blocks_old_jobs_and_old_revision_reuse(workflow):
    e = workflow
    queued = queue(e)
    with e.database.connection() as c:
        PostgresTestProfileAdministration(c, e.store).set_profile(
            e.scope, replace(e.profile, deadline_seconds=30), expected_epoch=4
        )
    assert e.jobs.claim(e.worker) is None
    with pytest.raises(WorkflowError, match="TEST_PROFILE_UNAVAILABLE"):
        e.proposals.get(TOKEN, queued["proposal_id"])


def test_worker_ticket_bundle_binding_and_immutable_result(workflow):
    e = workflow
    queued = queue(e)
    claimed = e.jobs.claim(e.worker)
    ticket, jid = claimed["ticket"], queued["job_id"]
    with pytest.raises(WorkflowError, match="WORKER_CLAIM_MISMATCH"):
        e.jobs.bundle(jid, uuid4(), ticket)
    bundle = e.jobs.bundle(jid, e.worker, ticket)
    assert [f["path"] for f in bundle["files"]] == list(OVERLAY_PATHS)
    passed = {
        "outcome": "passed",
        "reason": "COMPLETED",
        "elapsed_ms": 100,
        "checks": [{"name": n, "passed": True} for n in CHECK_NAMES],
    }
    with pytest.raises(WorkflowError, match="INVALID_TRANSITION"):
        e.jobs.report(jid, e.worker, ticket, passed)
    e.jobs.permit(jid, e.worker, ticket)
    with pytest.raises(WorkflowError, match="INVALID_TEST_RESULT"):
        e.jobs.report(jid, e.worker, ticket, passed | {"checks": []})
    first = e.jobs.report(jid, e.worker, ticket, passed)
    assert first["status"] == "passed" and first["evidence_digest"]
    assert (
        e.jobs.report(jid, e.worker, ticket, passed)["evidence_digest"] == first["evidence_digest"]
    )
    with pytest.raises(WorkflowError, match="RESULT_CONFLICT"):
        e.jobs.report(jid, e.worker, ticket, passed | {"elapsed_ms": 101})
    assert "ticket" not in e.proposals.job(TOKEN, jid)
    assert "credential_digest" not in e.proposals.job(TOKEN, jid)


def test_tampered_metadata_prevents_view_and_dispatch(workflow, monkeypatch):
    e = workflow
    revision = save(e)
    original = e.store.get
    monkeypatch.setattr(
        e.store,
        "get",
        lambda digest: b"tampered" if digest == revision["artifact_digest"] else original(digest),
    )
    with pytest.raises(SnapshotIntegrityError):
        e.proposals.get(TOKEN, revision["proposal_id"])


def test_another_tenant_cannot_read_revision_job_or_use_its_base(workflow):
    e = workflow
    queued = queue(e)
    other_scope = RepositoryScope(uuid4(), uuid4())
    other_token = "other-tenant-test-only-" + "b" * 40
    other = ControlPrincipal(other_scope, uuid4(), 1, control_token_digest(other_token))
    with e.database.connection() as c:
        admin = PostgresAuthorityAdministration(c)
        admin.register_repository(other_scope, "other-repository")
        admin.configure_principal(other, CAPS, expected_epoch=1)
        PostgresTestProfileAdministration(c, e.store).set_profile(
            other_scope, e.profile, expected_epoch=2
        )
    for action in (
        lambda: e.proposals.get(other_token, queued["proposal_id"]),
        lambda: e.proposals.job(other_token, queued["job_id"]),
        lambda: e.proposals.save(other_token, e.snapshot.snapshot_id, "candidate", str(uuid4())),
    ):
        with pytest.raises(ControlResourceUnavailable):
            action()


def test_rotation_invalidates_old_retry_and_queued_identity(workflow):
    e = workflow
    queued = queue(e)
    replacement = replace(
        e.principal,
        credential_version=2,
        token_digest=control_token_digest("replacement-test-" + "c" * 40),
    )
    with e.database.connection() as c:
        PostgresAuthorityAdministration(c).configure_principal(replacement, CAPS, expected_epoch=4)
    with pytest.raises(ControlIdentityRequired):
        e.proposals.get(TOKEN, queued["proposal_id"])
    assert e.jobs.claim(e.worker) is None
    with e.database.connection() as c:
        assert c.execute("SELECT status FROM control.technical_test_jobs").fetchone() == (
            "blocked",
        )


def test_failed_commit_does_not_return_revision_or_persist_records(workflow):
    e = workflow

    class FailingDatabase:
        @contextmanager
        def connection(self):
            with e.database.connection() as c:
                c.execute(
                    "CREATE FUNCTION pg_temp.reject_commit() RETURNS trigger LANGUAGE plpgsql "
                    "AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$"
                )
                c.execute(
                    "CREATE CONSTRAINT TRIGGER reject_commit AFTER INSERT "
                    "ON control.proposal_revisions "
                    "DEFERRABLE INITIALLY DEFERRED FOR EACH ROW "
                    "EXECUTE FUNCTION pg_temp.reject_commit()"
                )
                yield c

    e.proposals.transactions = PostgresWorkflowTransactions(FailingDatabase())
    with pytest.raises(WorkflowStorageUnavailable):
        save(e)
    with e.database.connection() as c:
        assert c.execute("SELECT count(*) FROM control.change_proposals").fetchone() == (0,)


def test_http_scope_limits_private_worker_auth_and_no_store(workflow):
    e = workflow
    app = FastAPI()
    configure_repository_http(
        app, RepositoryAccessService(PostgresControlAuthorityTransactions(e.database)), e.snapshots
    )
    configure_workflow_http(app, e.proposals, e.jobs, SecretStr("worker-test-" + "b" * 40))
    with TestClient(app, raise_server_exceptions=False) as client:
        headers = {"Authorization": "Bearer " + TOKEN, "Idempotency-Key": str(uuid4())}
        response = client.post(
            "/api/v1/changes/proposals",
            headers=headers,
            json={
                "base_snapshot_id": str(e.snapshot.snapshot_id),
                "content": "candidate",
                "path": "other.py",
            },
        )
        assert response.status_code == 400
        response = client.post(
            "/api/v1/changes/proposals",
            headers=headers,
            json={"base_snapshot_id": str(e.snapshot.snapshot_id), "content": "candidate"},
        )
        assert response.status_code == 201, response.text
        assert response.headers["cache-control"] == "no-store"
        assert client.get("/api/v1/changes/config").status_code == 401
        assert (
            client.post(
                "/_internal/test-worker/claim", headers=headers, json={"worker_id": str(e.worker)}
            ).status_code
            == 401
        )
        assert (
            client.post(
                "/api/v1/changes/proposals", headers=headers, content=b"x" * 65537
            ).status_code
            == 413
        )
