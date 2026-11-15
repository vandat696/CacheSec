"""Real PostgreSQL authority/journal and filesystem writes; runtime uses a worker double here."""

from contextlib import contextmanager
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.artifacts.metadata_encoding import metadata_digest
from app.change_workflow.workflow_http import configure_workflow_http
from app.change_workflow.workflow_repository import WorkflowError, WorkflowStorageUnavailable
from app.control.api.repository_http_app import configure_repository_http
from app.identity.control_authority import (
    ControlAccessDenied,
    ControlResourceUnavailable,
    RepositoryAccessService,
)
from app.identity.control_authority import ControlCapability as Cap
from app.identity.postgres_control_authority import PostgresControlAuthorityTransactions
from app.workspace_runtime.filesystem_source_writer import (
    FileSystemSourceWriter,
    SourceWriteConflict,
)
from app.workspace_runtime.runtime_service import LocalRuntimeService
from app.workspace_runtime.source_operations import TARGET_ID, SourceOperationsService
from app.workspace_runtime.worker_service import WorkspaceWorkerService
from app.workspace_runtime.workspace_http import configure_workspace_http
from tests.control.test_change_workflow_integration import CAPS, TOKEN, grants, save
from tests.control.test_change_workflow_integration import workflow as workflow

ALL = CAPS | {Cap.REPOSITORY_WRITE, Cap.CHANGE_REVIEW, Cap.DEPLOYMENT_ACTIVATE, Cap.DEPLOYMENT_READ}


@pytest.fixture
def local(workflow):
    e = workflow
    grants(e, ALL)
    e.operations = SourceOperationsService(e.proposals, e.scope)
    e.runtime = LocalRuntimeService(e.operations)
    e.workspace_worker = WorkspaceWorkerService(e.operations, e.runtime)
    with e.proposals.transactions.open() as session:
        session.snapshot.authority.lock_scope(e.scope)
        session.workspace.add(
            e.scope,
            {
                "id": str(TARGET_ID),
                "kind": "target",
                "status": "baseline",
                "version": 0,
                "pending_id": None,
                "config_digest": metadata_digest({"kind": "test-runtime", "schema_version": 1}),
                "profile_digest": e.profile.digest,
                "active_artifact": None,
                "container_name": None,
            },
        )
    return e


def passed(e, revision):
    from app.change_workflow.test_profiles import CHECK_NAMES

    job = e.proposals.request_test(
        TOKEN, revision["proposal_id"], revision["revision"], str(uuid4())
    )
    claim = e.jobs.claim(e.worker)
    e.jobs.permit(job["job_id"], e.worker, claim["ticket"])
    return e.jobs.report(
        job["job_id"],
        e.worker,
        claim["ticket"],
        {
            "outcome": "passed",
            "reason": "COMPLETED",
            "elapsed_ms": 1,
            "checks": [{"name": name, "passed": True} for name in CHECK_NAMES],
        },
    )  # Explicit worker double; no claim that this runs Docker.


def approve(e, revision, job):
    return e.runtime.approve(
        TOKEN,
        revision["proposal_id"],
        revision["revision"],
        revision["artifact_digest"],
        job["job_id"],
        str(uuid4()),
    )


def write_request(e, revision, key=None, expected=None):
    return e.operations.save(
        TOKEN,
        revision["proposal_id"],
        revision["revision"],
        revision["artifact_digest"],
        expected or e.snapshot.snapshot_id,
        key or str(uuid4()),
    )


def test_real_file_write_journal_replay_and_protected_files(local):
    e = local
    revision = save(e)
    key = str(uuid4())
    operation = write_request(e, revision, key)
    assert (e.root / revision["path"]).read_bytes() == b"original\r\n"
    claim = e.workspace_worker.claim(e.worker)
    assert claim["id"] == operation["id"]
    from app.testing.worker_client import decode_bundle

    wire = e.workspace_worker.bundle(UUID(claim["id"]), e.worker, claim["ticket"])
    base, candidate = decode_bundle(wire["base"]), decode_bundle(wire["candidate"])
    e.workspace_worker.permit(UUID(claim["id"]), e.worker, claim["ticket"])
    digest = FileSystemSourceWriter(e.root).write(base, candidate)
    report = {"status": "succeeded", "reason": "COMPLETED", "source_digest": digest}
    e.workspace_worker.report(UUID(claim["id"]), e.worker, claim["ticket"], report)
    assert (e.root / revision["path"]).read_bytes() == b"candidate\r\n"
    assert write_request(e, revision, key)["status"] == "succeeded"
    assert FileSystemSourceWriter(e.root).write(base, candidate) == digest
    for path in e.profile.protected_files:
        assert (e.root / path[0]).read_bytes() == b"original\r\n"
    # A second edit uses the observed candidate as its expected source snapshot.
    second = e.proposals.save(TOKEN, None, "next\n", str(uuid4()), revision["proposal_id"], 1)
    assert (
        write_request(e, second, expected=revision["candidate_snapshot_id"])["status"] == "queued"
    )


def test_external_edit_is_not_overwritten(local):
    e = local
    revision = save(e)
    operation = write_request(e, revision)
    claim = e.workspace_worker.claim(e.worker)
    from app.testing.worker_client import decode_bundle

    wire = e.workspace_worker.bundle(UUID(operation["id"]), e.worker, claim["ticket"])
    (e.root / revision["path"]).write_bytes(b"external developer change\n")
    with pytest.raises(SourceWriteConflict):
        FileSystemSourceWriter(e.root).write(
            decode_bundle(wire["base"]), decode_bundle(wire["candidate"])
        )
    assert (e.root / revision["path"]).read_bytes() == b"external developer change\n"
    with pytest.raises(WorkflowError, match="DISPATCH_DENIED"):
        e.workspace_worker.permit(UUID(operation["id"]), e.worker, claim["ticket"])
    assert e.operations.get(TOKEN, UUID(operation["id"]))["status"] == "blocked"


@pytest.mark.parametrize("cap", [Cap.REPOSITORY_WRITE, Cap.CHANGE_REVIEW, Cap.DEPLOYMENT_ACTIVATE])
def test_separate_permissions_and_revoke_before_dispatch(local, cap):
    e = local
    revision = save(e)
    job = passed(e, revision)
    approval = approve(e, revision, job)
    if cap == Cap.REPOSITORY_WRITE:
        operation = write_request(e, revision)
    else:
        operation = e.runtime.activate(TOKEN, UUID(approval["id"]), 0, str(uuid4()))
    claim = e.workspace_worker.claim(e.worker)
    grants(e, ALL - {cap})
    with pytest.raises(WorkflowError, match="DISPATCH_DENIED"):
        e.workspace_worker.permit(UUID(operation["id"]), e.worker, claim["ticket"])
    assert e.operations.get(TOKEN, UUID(operation["id"]))["status"] == "blocked"
    if cap == Cap.REPOSITORY_WRITE:
        with pytest.raises(ControlAccessDenied):
            write_request(e, revision)


def test_exact_approval_test_binding_single_use_and_activation_replay(local):
    e = local
    revision = save(e)
    job = passed(e, revision)
    with pytest.raises(WorkflowError, match="STALE_REVISION"):
        e.runtime.approve(
            TOKEN, revision["proposal_id"], 1, "sha256:" + "f" * 64, job["job_id"], str(uuid4())
        )
    approval = approve(e, revision, job)
    key = str(uuid4())
    operation = e.runtime.activate(TOKEN, UUID(approval["id"]), 0, key)
    assert e.runtime.activate(TOKEN, UUID(approval["id"]), 0, key)["id"] == operation["id"]
    claim = e.workspace_worker.claim(e.worker)
    permit = e.workspace_worker.permit(UUID(operation["id"]), e.worker, claim["ticket"])
    assert permit["artifact_digest"] == revision["artifact_digest"]
    with pytest.raises(WorkflowError, match="INVALID_TRANSITION"):
        e.workspace_worker.permit(UUID(operation["id"]), e.worker, claim["ticket"])
    report = {
        "status": "succeeded",
        "reason": "COMPLETED",
        "container_name": "cachesec-local-" + UUID(operation["id"]).hex,
        "observed_artifact": revision["artifact_digest"],
    }
    e.workspace_worker.report(UUID(operation["id"]), e.worker, claim["ticket"], report)
    assert e.runtime.config(TOKEN)["active_artifact"] == revision["artifact_digest"]
    assert e.runtime.config(TOKEN)["target_version"] == 1
    assert e.runtime.activate(TOKEN, UUID(approval["id"]), 0, key)["status"] == "succeeded"
    with pytest.raises(WorkflowError, match="APPROVAL_INVALID"):
        e.runtime.activate(TOKEN, UUID(approval["id"]), 1, str(uuid4()))


def test_expired_approval_or_revision_changed_cannot_dispatch(local):
    e = local
    revision = save(e)
    approval = approve(e, revision, passed(e, revision))
    operation = e.runtime.activate(TOKEN, UUID(approval["id"]), 0, str(uuid4()))
    claim = e.workspace_worker.claim(e.worker)
    with e.proposals.transactions.open() as session:
        row = e.operations.resource(session, e.scope, approval["id"])
        row["expires_at"] = 0
        session.workspace.update(e.scope, row)
    with pytest.raises(WorkflowError, match="DISPATCH_DENIED"):
        e.workspace_worker.permit(UUID(operation["id"]), e.worker, claim["ticket"])
    assert e.runtime.config(TOKEN)["pending_id"] is None


def test_unknown_activation_keeps_target_reserved(local):
    e = local
    revision = save(e)
    approval = approve(e, revision, passed(e, revision))
    operation = e.runtime.activate(TOKEN, UUID(approval["id"]), 0, str(uuid4()))
    claim = e.workspace_worker.claim(e.worker)
    e.workspace_worker.permit(UUID(operation["id"]), e.worker, claim["ticket"])
    e.workspace_worker.report(
        UUID(operation["id"]),
        e.worker,
        claim["ticket"],
        {"status": "unknown", "reason": "WORKER_INTERRUPTED"},
    )
    assert e.runtime.config(TOKEN)["pending_id"] == operation["id"]
    with pytest.raises(WorkflowError):
        e.runtime.activate(TOKEN, UUID(approval["id"]), 0, str(uuid4()))


def test_no_side_effect_if_intent_commit_fails(local):
    e = local
    revision = save(e)
    original = e.proposals.transactions

    class FailCommit:
        @contextmanager
        def open(self):
            with original.open() as session:
                yield session
                raise WorkflowStorageUnavailable()

    e.proposals.transactions = FailCommit()
    with pytest.raises(WorkflowStorageUnavailable):
        write_request(e, revision)
    e.proposals.transactions = original
    assert e.workspace_worker.claim(e.worker) is None
    assert (e.root / revision["path"]).read_bytes() == b"original\r\n"


def test_http_strict_bodies_authorization_and_worker_channel(local):
    e = local
    app = FastAPI()
    access = RepositoryAccessService(PostgresControlAuthorityTransactions(e.database))
    configure_repository_http(app, access, e.snapshots)
    configure_workflow_http(app, e.proposals, e.jobs, SecretStr("worker-test"))
    configure_workspace_http(
        app, e.operations, e.runtime, e.workspace_worker, SecretStr("worker-test")
    )
    revision = save(e)
    with TestClient(app) as client:
        path = "/api/v1/changes/workspace/source"
        headers = {"Authorization": "Bearer " + TOKEN, "Idempotency-Key": str(uuid4())}
        body = {
            "proposal_id": str(revision["proposal_id"]),
            "revision": 1,
            "artifact_digest": revision["artifact_digest"],
            "expected_snapshot_id": str(e.snapshot.snapshot_id),
        }
        assert client.post(path, json=body).status_code == 401
        assert (
            client.post(path, headers=headers, json=body | {"path": "../secret"}).status_code == 400
        )
        assert client.post(path, headers=headers, json=body | {"revision": True}).status_code == 400
        response = client.post(path, headers=headers, json=body)
        assert response.status_code == 202, response.text
        assert response.json()["data"]["kind"] == "write"
        assert (
            client.post(
                "/_internal/workspace-worker/claim", json={"worker_id": str(e.worker)}
            ).status_code
            == 401
        )


def test_two_activations_reserve_only_one_target(local):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    e = local
    revision = save(e)
    job = passed(e, revision)
    approvals = [approve(e, revision, job), approve(e, revision, job)]
    barrier = Barrier(2)

    def activate(approval):
        barrier.wait(timeout=5)
        try:
            return e.runtime.activate(TOKEN, UUID(approval["id"]), 0, str(uuid4()))["status"]
        except WorkflowError as error:
            return error.code

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(activate, approvals))
    assert sorted(results) == ["TARGET_BUSY_OR_CHANGED", "queued"]


def test_permit_commit_failure_does_not_produce_a_dispatch(local):
    e = local
    revision = save(e)
    approval = approve(e, revision, passed(e, revision))
    operation = e.runtime.activate(TOKEN, UUID(approval["id"]), 0, str(uuid4()))
    claim = e.workspace_worker.claim(e.worker)
    original = e.proposals.transactions

    class FailCommit:
        @contextmanager
        def open(self):
            with original.open() as session:
                yield session
                raise WorkflowStorageUnavailable()

    e.proposals.transactions = FailCommit()
    with pytest.raises(WorkflowStorageUnavailable):
        e.workspace_worker.permit(UUID(operation["id"]), e.worker, claim["ticket"])
    e.proposals.transactions = original
    assert e.operations.get(TOKEN, UUID(operation["id"]))["status"] == "preparing"


def test_evidence_tamper_is_rejected_before_human_approval(local):
    from psycopg.types.json import Jsonb

    e = local
    revision = save(e)
    job = passed(e, revision)
    with e.database.connection() as connection:
        connection.execute(
            "UPDATE control.technical_test_jobs SET result=%s WHERE job_id=%s",
            (Jsonb({"invented": True}), job["job_id"]),
        )
    with pytest.raises(WorkflowError, match="EVIDENCE_INTEGRITY_UNVERIFIED"):
        approve(e, revision, job)


def test_no_approval_means_no_activation_or_worker_dispatch(local):
    e = local
    with pytest.raises(ControlResourceUnavailable):
        e.runtime.activate(TOKEN, uuid4(), 0, str(uuid4()))
    assert e.workspace_worker.claim(e.worker) is None
    assert e.runtime.config(TOKEN)["pending_id"] is None
