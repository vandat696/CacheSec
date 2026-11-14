"""Agent loop against real PostgreSQL authority/revisions/evidence; marked model/worker doubles."""

from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agent_assistance.assistance_http import configure_assistance_http
from app.agent_assistance.assistance_service import AgentAssistanceService
from app.agent_assistance.generation import GenerationResult
from app.agent_assistance.run_http import configure_run_http
from app.agent_assistance.run_service import AgentRunService
from app.agent_assistance.run_store import LocalAgentRunStore
from app.agent_assistance.workflow_run_tools import WorkflowRunAccess, WorkflowRunTools
from app.change_workflow.test_profiles import CHECK_NAMES, EDITABLE_PATH
from app.change_workflow.workflow_http import configure_workflow_http
from app.control.api.repository_http_app import configure_repository_http
from app.identity.control_authority import (
    ControlAccessDenied,
    RepositoryAccessService,
)
from app.identity.control_authority import (
    ControlCapability as Cap,
)
from app.identity.postgres_control_authority import PostgresControlAuthorityTransactions
from tests.control.test_agent_run_loop import ManualExecutor
from tests.control.test_change_workflow_integration import CAPS, TOKEN, grants
from tests.control.test_change_workflow_integration import workflow as workflow

RUN_CAPS = CAPS | {Cap.WORKFLOW_RUN, Cap.WORKFLOW_READ}


@pytest.fixture
def agent(workflow):
    e = workflow

    class Model:
        model_id = "gemini-3.5-flash-lite"

        def __init__(self):
            self.calls = []
            self.action = lambda: None

        def configured(self):
            return True

        def generate(self, prompt, files, history):
            self.calls.append((files, history))
            self.action()
            return GenerationResult(
                "test-only model", f"candidate-{len(self.calls)}\r\n", self.model_id, None
            )

    model = Model()
    access = RepositoryAccessService(PostgresControlAuthorityTransactions(e.database))
    assistance = AgentAssistanceService(access, e.snapshots, model)
    executor = ManualExecutor()
    tools = WorkflowRunTools(e.proposals)
    state = SimpleNamespace(outcomes=["passed"])
    request = tools.request_test

    def test_with_worker_double(token, revision, key):
        queued = request(token, revision, key)
        claimed = e.jobs.claim(e.worker)
        assert claimed["job_id"] == queued["job_id"]
        e.jobs.permit(queued["job_id"], e.worker, claimed["ticket"])
        outcome = state.outcomes[min(len(model.calls) - 1, len(state.outcomes) - 1)]
        return e.jobs.report(
            queued["job_id"],
            e.worker,
            claimed["ticket"],
            {
                "outcome": outcome,
                "reason": "COMPLETED" if outcome == "passed" else "CHECK_FAILED",
                "elapsed_ms": 0,
                "checks": [{"name": name, "passed": outcome == "passed"} for name in CHECK_NAMES],
            },
        )

    tools.request_test = test_with_worker_double
    runs = AgentRunService(
        WorkflowRunAccess(e.proposals), assistance, tools, LocalAgentRunStore(), executor
    )
    app = FastAPI()
    configure_repository_http(app, access, e.snapshots)
    configure_workflow_http(app, e.proposals, e.jobs, None)
    configure_assistance_http(app, assistance, runs)
    configure_run_http(app, runs)
    return SimpleNamespace(
        env=e,
        model=model,
        runs=runs,
        tools=tools,
        executor=executor,
        state=state,
        client=TestClient(app),
    )


def start(agent):
    return agent.runs.start(TOKEN, agent.env.snapshot.snapshot_id, "test-only task", "agent-test")


def test_existing_manual_grants_cannot_start_agent_or_call_its_write_tools(agent):
    a = agent
    assert a.runs.config(TOKEN)["can_start"] is False
    with pytest.raises(ControlAccessDenied):
        start(a)
    with pytest.raises(ControlAccessDenied):
        a.tools.save(TOKEN, a.env.snapshot.snapshot_id, "candidate", "save", None)
    assert a.model.calls == []
    revision = a.env.proposals.save(TOKEN, a.env.snapshot.snapshot_id, "manual", "manual-save")
    with pytest.raises(ControlAccessDenied):
        a.tools.request_test(TOKEN, revision, "agent-test-denied")


def test_loop_persists_two_real_revisions_and_bound_test_evidence_without_touching_source(agent):
    a = agent
    grants(a.env, RUN_CAPS)
    a.state.outcomes = ["failed", "passed"]
    original = (a.env.root / EDITABLE_PATH).read_bytes()
    run = start(a)
    a.executor.drain()
    result = a.runs.get(TOKEN, UUID(run["run_id"]))
    assert result["status"] == "passed" and result["revision"] == 2
    revision = a.env.proposals.get(TOKEN, UUID(result["proposal_id"]))
    assert revision["artifact_digest"] == result["artifact_digest"]
    assert len(revision["tests"]) == 2 and all(t["evidence_digest"] for t in revision["tests"])
    assert (
        next(text for path, text in a.model.calls[1][0] if path == EDITABLE_PATH)
        == "candidate-1\r\n"
    )
    assert (a.env.root / EDITABLE_PATH).read_bytes() == original


def test_source_change_before_run_stops_before_provider_or_mutation(agent):
    a = agent
    grants(a.env, RUN_CAPS)
    run = start(a)
    (a.env.root / EDITABLE_PATH).write_text("changed")
    a.executor.drain()
    result = a.runs.get(TOKEN, UUID(run["run_id"]))
    assert result["status"] == "error" and result["error_code"] == "STALE_SNAPSHOT"
    assert a.model.calls == [] and result["proposal_id"] is None


def test_revoking_only_run_capability_during_generation_blocks_subsequent_revision(agent):
    a = agent
    grants(a.env, RUN_CAPS)
    a.model.action = lambda: grants(a.env, CAPS | {Cap.WORKFLOW_READ})
    run = start(a)
    a.executor.drain()
    result = a.runs.get(TOKEN, UUID(run["run_id"]))
    assert result["error_code"] == "AGENT_ACCESS_REVOKED" and result["proposal_id"] is None


def test_http_requires_auth_consent_key_and_rejects_arbitrary_tools_and_bounds(agent):
    a = agent
    grants(a.env, RUN_CAPS)
    headers = {"Authorization": "Bearer " + TOKEN, "Idempotency-Key": "run-http"}
    payload = {
        "snapshot_id": str(a.env.snapshot.snapshot_id),
        "prompt": "test-only task",
        "provider_consent": True,
    }
    assert a.client.post("/api/v1/agent/runs", json=payload).status_code == 401
    for change in (
        {"provider_consent": False},
        {"provider_consent": 1},
        {"path": "../secret"},
        {"command": "deploy"},
        {"max_turns": 100},
    ):
        response = a.client.post("/api/v1/agent/runs", json={**payload, **change}, headers=headers)
        assert response.status_code == 400 and "../secret" not in response.text
    response = a.client.post("/api/v1/agent/runs", json=payload, headers=headers)
    assert response.status_code == 202 and response.headers["cache-control"] == "no-store"
    run_id = response.json()["data"]["run_id"]
    assert (
        a.client.post("/api/v1/agent/runs", json=payload, headers=headers).json()["data"]["run_id"]
        == run_id
    )
    assert (
        a.client.post(f"/api/v1/agent/runs/{run_id}/cancel", headers=headers, json=None).status_code
        == 200
    )
    a.executor.drain()
    assert (
        a.client.get(f"/api/v1/agent/runs/{run_id}", headers=headers).json()["data"]["status"]
        == "cancelled"
    )
    assert a.client.get(f"/api/v1/agent/runs/{uuid4()}", headers=headers).status_code == 404
    assert a.model.calls == []
