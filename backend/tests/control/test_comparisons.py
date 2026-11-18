"""Real PostgreSQL comparisons with explicitly labeled model, embedding and worker doubles."""

import json
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agent_assistance.assistance_http import configure_assistance_http
from app.agent_assistance.assistance_prompt import ASSISTANCE_PROMPT_VERSION
from app.agent_assistance.assistance_service import AgentAssistanceService
from app.agent_assistance.cached_assistance import CachedAgentAssistance
from app.agent_assistance.generation import GenerationResult, GenerationTransportError
from app.agent_assistance.workflow_run_tools import WorkflowRunTools
from app.change_workflow.test_profiles import CHECK_NAMES, EDITABLE_PATH
from app.change_workflow.workflow_http import configure_workflow_http
from app.comparisons.comparison_http import configure_comparison_http
from app.comparisons.comparison_service import ComparisonService
from app.comparisons.postgres_comparisons import PostgresComparisonTransactions
from app.context_cache.context_contract import ContextError
from app.context_cache.context_http import configure_context_http
from app.context_cache.context_service import ContextService
from app.context_cache.postgres_contexts import PostgresContextTransactions
from app.control.api.repository_http_app import configure_repository_http
from app.identity.control_authority import ControlAccessDenied, RepositoryAccessService
from app.identity.control_authority import ControlCapability as Cap
from app.identity.postgres_control_authority import PostgresControlAuthorityTransactions
from tests.control.test_agent_run_loop import ManualExecutor
from tests.control.test_change_workflow_integration import CAPS, TOKEN, grants
from tests.control.test_change_workflow_integration import workflow as workflow

RUN_CAPS = CAPS | {Cap.WORKFLOW_READ, Cap.WORKFLOW_RUN}


@pytest.fixture
def comparison(workflow, monkeypatch):
    env = workflow
    grants(env, RUN_CAPS)
    state = SimpleNamespace(
        calls=[], models=[], embeddings=[], outcomes=["passed"], action=lambda: None
    )

    class Model:
        def __init__(self, model_id="gemini-3.5-flash-lite"):
            self.model_id = model_id

        def configured(self):
            return True

        def generate(self, prompt, files, history):
            state.calls.append((prompt, files, history))
            state.models.append(self.model_id)
            state.action()
            return GenerationResult(
                "test-only answer",
                f"candidate-{len(state.calls)}\r\n",
                self.model_id,
                {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
            )

    class Embedding:
        def embed(self, prompt):
            state.embeddings.append(prompt)
            return [1.0] + [0.0] * 767

    access = RepositoryAccessService(PostgresControlAuthorityTransactions(env.database))
    assistance = AgentAssistanceService(
        access, env.snapshots, Model(), (Model("gemini-4-hydrogen"),)
    )
    contexts = ContextService(
        PostgresContextTransactions(env.database),
        env.snapshots,
        Embedding(),
        assistance.models.default.model_id,
        prompt_version=ASSISTANCE_PROMPT_VERSION,
    )
    cached = CachedAgentAssistance(contexts, assistance.models)
    executor = ManualExecutor()

    def factory():
        return ComparisonService(
            PostgresComparisonTransactions(env.database),
            contexts,
            assistance,
            cached,
            env.proposals,
            executor,
        )

    request_test = WorkflowRunTools.request_test

    def test_with_worker_double(self, token, revision, key):
        queued = request_test(self, token, revision, key)
        claimed = env.jobs.claim(env.worker)
        assert claimed["job_id"] == queued["job_id"]
        env.jobs.permit(queued["job_id"], env.worker, claimed["ticket"])
        outcome = state.outcomes[min(len(state.calls) - 1, len(state.outcomes) - 1)]
        return env.jobs.report(
            queued["job_id"],
            env.worker,
            claimed["ticket"],
            {
                "outcome": outcome,
                "reason": "COMPLETED" if outcome == "passed" else "CHECK_FAILED",
                "elapsed_ms": 1,
                "checks": [{"name": name, "passed": outcome == "passed"} for name in CHECK_NAMES],
            },
        )

    monkeypatch.setattr(WorkflowRunTools, "request_test", test_with_worker_double)
    service = factory()
    app = FastAPI()
    configure_repository_http(app, access, env.snapshots)
    configure_workflow_http(app, env.proposals, env.jobs, None)
    configure_assistance_http(app, assistance)
    configure_context_http(app, contexts, cached)
    configure_comparison_http(app, service)
    return SimpleNamespace(
        env=env,
        state=state,
        executor=executor,
        service=service,
        factory=factory,
        contexts=contexts,
        cached=cached,
        client=TestClient(app),
    )


def create(e, prompt="test-only change", key=None):
    return e.service.create(TOKEN, e.env.snapshot.snapshot_id, prompt, key or str(uuid4()), "warm")


def start_pair(e, pair, local=None):
    e.service.start(TOKEN, pair["pair_id"], "none", {"kind": "not_applicable"})
    return e.service.start(TOKEN, pair["pair_id"], "local", local or {"kind": "no_candidate"})


def test_two_branches_revision_history_metrics_assessment_and_restart_without_calls(comparison):
    e = comparison
    e.state.outcomes = ["failed", "passed"]
    pair = create(e)
    admission = start_pair(e, pair)["admission"]
    assert admission is not None and e.state.calls == []
    e.executor.drain()
    e.executor.drain()
    result = e.service.get(TOKEN, pair["pair_id"])
    none, local = result["branches"]["none"], result["branches"]["local"]
    assert none["status"] == local["status"] == "passed"
    assert none["run"]["proposal_id"] != local["run"]["proposal_id"]
    assert [r["revision"] for r in none["revisions"]] == [1, 2]
    assert len(none["assessments"]) == 2 and len(local["assessments"]) == 1
    assert all(a["correctness"]["value"] is None for a in none["assessments"])
    assert all(
        a["artifact_digest"] == r["artifact_digest"]
        for a, r in zip(none["assessments"], none["revisions"], strict=True)
    )
    assert none["context"]["outcome"] == "not_applicable" and local["context"]["outcome"] == "miss"
    assert e.state.embeddings == ["test-only change"] and len(e.state.calls) == 3
    assert (e.env.root / EDITABLE_PATH).read_bytes() == b"original\r\n"
    reopened = e.factory().get(TOKEN, pair["pair_id"])
    assert reopened == result and len(e.state.calls) == 3
    with e.env.database.connection() as c:
        assert c.execute("SELECT count(*) FROM control.comparison_revisions").fetchone() == (3,)
        assert c.execute("SELECT count(*) FROM control.comparison_assessments").fetchone() == (3,)
        assert c.execute(
            "SELECT count(*) FROM control.context_entries WHERE record ? 'payload'"
        ).fetchone() == (0,)


def test_create_and_start_replay_never_regenerates_or_embeds_again(comparison):
    e = comparison
    pair = create(e, key="same")
    assert create(e, key="same") == pair and len(e.state.embeddings) == 1
    with pytest.raises(ContextError, match="IDEMPOTENCY_CONFLICT"):
        create(e, prompt="different", key="same")
    start_pair(e, pair)
    start_pair(e, pair)
    assert len(e.executor.pending) == 2
    e.executor.drain()
    e.executor.drain()
    start_pair(e, pair)
    assert len(e.state.calls) == 2 and not e.executor.pending


def test_conversation_keeps_order_and_grouping_across_restart_and_legacy_pairs(comparison):
    e = comparison
    first = create(e, "first prompt")
    start_pair(e, first)
    e.executor.drain()
    e.executor.drain()
    session_id = UUID(first["pair_id"])
    with e.env.database.connection() as connection:
        connection.execute(
            "UPDATE control.comparison_pairs SET record = record - 'session_id' WHERE pair_id=%s",
            (session_id,),
        )
    headers = {"Authorization": "Bearer " + TOKEN, "Idempotency-Key": "second-turn"}
    body = {
        "snapshot_id": first["snapshot_id"],
        "prompt": "second prompt",
        "cache_state": "warm",
        "provider_consent": True,
        "session_id": str(session_id),
    }
    endpoint = "/api/v1/agent/comparisons"
    response = e.client.post(endpoint, json=body, headers=headers)
    assert response.status_code == 202
    second = response.json()["data"]
    assert second["session_id"] == str(session_id) and second["pair_id"] != first["pair_id"]
    assert second["conversation_context"]["turn_ids"] == [first["pair_id"]]
    assert e.client.post(endpoint, json=body, headers=headers).json()["data"] == second
    assert (
        e.client.post(endpoint, json={**body, "session_id": None}, headers=headers).status_code
        == 409
    )
    start_pair(e, second)
    e.executor.drain()
    e.executor.drain()
    history = e.state.calls[2][2]
    assert e.state.calls[3][2] == history
    assert history[:2] == [
        {"role": "user", "content": "first prompt"},
        {"role": "assistant", "content": "test-only answer"},
    ]
    diffs = json.loads(history[2]["content"])["previous_tested_diffs"]
    assert set(diffs) == {"Không cache", "Có Context Cache"}
    assert all("candidate-" in diff for diff in diffs.values())
    assert e.state.embeddings == ["first prompt", "second prompt"]
    separate = create(e, "new conversation")
    assert separate["session_id"] == separate["pair_id"]
    start_pair(e, separate)
    e.executor.drain()
    e.executor.drain()
    assert all(call[2] == [] for call in e.state.calls[4:])
    rows = e.factory().list(TOKEN)
    assert [(row["pair_id"], row["prompt"]) for row in rows] == [
        (separate["pair_id"], "new conversation"),
        (second["pair_id"], "first prompt"),
    ]
    restored = e.factory().turns(TOKEN, session_id)
    assert [turn["prompt"] for turn in restored["turns"]] == ["first prompt", "second prompt"]
    assert all(
        turn["branches"][mode] == {"answer": "test-only answer", "status": "passed"}
        for turn in restored["turns"]
        for mode in ("none", "local")
    )
    path = f"{endpoint}/{session_id}/turns"
    assert e.client.get(path, headers=headers).json()["data"] == restored
    assert e.client.get(f"{endpoint}/{second['pair_id']}/turns", headers=headers).status_code == 404
    grants(e.env, frozenset())
    assert e.client.get(path, headers=headers).status_code == 403


def test_selected_model_binds_both_branches_repair_idempotency_and_cache(comparison):
    e = comparison
    prompt = "test-only change"
    default = create(e, prompt)
    old_entry = e.service.start(TOKEN, default["pair_id"], "local", {"kind": "no_candidate"})[
        "admission"
    ]
    e.executor.drain()
    e.state.models.clear()
    e.state.calls.clear()
    e.state.outcomes = ["failed", "passed"]
    headers = {"Authorization": "Bearer " + TOKEN, "Idempotency-Key": "model-pair"}
    body = {
        "snapshot_id": str(e.env.snapshot.snapshot_id),
        "prompt": prompt,
        "cache_state": "warm",
        "provider_consent": True,
    }
    endpoint = "/api/v1/agent/comparisons"
    unsupported = e.client.post(
        endpoint, json={**body, "model": "gemini-4-carbon"}, headers=headers
    )
    assert unsupported.status_code == 400
    assert unsupported.json()["error"]["code"] == "MODEL_NOT_SUPPORTED"
    assert e.state.embeddings == [prompt]
    chosen = "gemini-4-hydrogen"
    answer = e.client.post(
        "/api/v1/agent/messages",
        json={
            "snapshot_id": body["snapshot_id"],
            "prompt": prompt,
            "model": chosen,
        },
        headers=headers,
    )
    assert answer.status_code == 200 and answer.json()["data"]["model"] == chosen
    assert e.state.models == [chosen]
    e.state.calls.clear()
    e.state.models.clear()
    response = e.client.post(endpoint, json={**body, "model": chosen}, headers=headers)
    assert response.status_code == 202
    pair = response.json()["data"]
    assert pair["model"] == chosen
    assert all(branch["context_request"]["model"] == chosen for branch in pair["branches"].values())
    assert pair["branches"]["local"]["context_request"]["namespace"] != old_entry["namespace"]
    assert e.client.post(endpoint, json=body, headers=headers).status_code == 409
    start_pair(
        e,
        pair,
        {
            "kind": "candidate",
            "candidates": [
                {
                    "kind": "exact",
                    "entry_id": old_entry["entry_id"],
                    "payload": old_entry["payload"],
                }
            ],
        },
    )
    e.executor.drain()
    e.executor.drain()
    result = e.factory().get(TOKEN, pair["pair_id"])
    assert result["model"] == chosen and e.state.models == [chosen] * 3
    assert all(branch["run"]["model"] == chosen for branch in result["branches"].values())
    local = result["branches"]["local"]["context"]
    assert local["outcome"] == "rejected"
    assert local["decisions"][0]["reason"] == "SCOPE_OR_CONFIG_MISMATCH"


def test_client_cache_write_telemetry_is_bound_owned_and_idempotent(comparison):
    e = comparison
    pair = create(e)
    admission = start_pair(e, pair)["admission"]
    report = {
        "report_id": str(uuid4()),
        "entry_id": admission["entry_id"],
        "state": "storage_error",
        "elapsed_ms": 1.0,
    }
    assert e.service.record_cache_io(TOKEN, pair["pair_id"], report) == {"recorded": True}
    e.service.record_cache_io(TOKEN, pair["pair_id"], report)
    branch = e.service.get(TOKEN, pair["pair_id"])["branches"]["local"]
    assert branch["client_cache_io"] == [report] and branch["context"]["outcome"] == "miss"
    with pytest.raises(ContextError, match="CACHE_IO_BINDING_MISMATCH"):
        e.service.record_cache_io(TOKEN, pair["pair_id"], {**report, "entry_id": str(uuid4())})
    with pytest.raises(ContextError, match="IDEMPOTENCY_CONFLICT"):
        e.service.record_cache_io(TOKEN, pair["pair_id"], {**report, "state": "written"})
    e.executor.drain()
    e.executor.drain()


def test_checkpoint_failure_stops_generation_and_never_publishes_pass(comparison, monkeypatch):
    from app.comparisons.postgres_comparisons import PostgresComparisonRecords

    e = comparison
    pair = create(e)
    start_pair(e, pair)
    original = PostgresComparisonRecords.checkpoint

    def unavailable(*args):
        raise ContextError("COMPARISON_STORAGE_UNAVAILABLE", 503)

    monkeypatch.setattr(PostgresComparisonRecords, "checkpoint", unavailable)
    e.executor.drain()
    monkeypatch.setattr(PostgresComparisonRecords, "checkpoint", original)
    result = e.service.get(TOKEN, pair["pair_id"])
    assert result["branches"]["none"]["status"] == "incomplete"
    assert result["branches"]["none"]["error_code"] == "CHECKPOINT_FAILED"
    assert not e.state.calls
    e.executor.drain()


def test_semantic_hit_and_tamper_rejection_use_actual_registry_not_client_metadata(comparison):
    e = comparison
    first = create(e)
    admission = start_pair(e, first)["admission"]
    e.executor.drain()
    e.executor.drain()
    payload = {
        "kind": "candidate",
        "candidates": [
            {"entry_id": admission["entry_id"], "kind": "semantic", "payload": admission["payload"]}
        ],
    }
    second = create(e, prompt="test-only paraphrase")
    e.service.start(TOKEN, second["pair_id"], "local", payload)
    assert (
        e.service.get(TOKEN, second["pair_id"])["branches"]["local"]["context"]["outcome"] == "hit"
    )
    e.executor.drain()
    third = create(e, prompt="another paraphrase")
    payload["candidates"][0]["payload"]["files"][0]["content"] = "tampered"
    e.service.start(TOKEN, third["pair_id"], "local", payload)
    branch = e.service.get(TOKEN, third["pair_id"])["branches"]["local"]
    assert branch["context"]["outcome"] == "rejected"
    assert branch["context"]["decisions"][0]["reason"] == "INTEGRITY_MISMATCH"
    e.executor.drain()


def test_restart_marks_inflight_incomplete_without_resuming_and_preserves_test_refs(comparison):
    e = comparison
    pair = create(e)
    start_pair(e, pair)
    restarted = e.factory()
    result = restarted.get(TOKEN, pair["pair_id"])
    assert all(branch["status"] == "incomplete" for branch in result["branches"].values())
    assert e.state.calls == []
    # The old process is gone in this scenario; its queued fake executor is not drained.
    e.executor.pending.clear()


def test_retry_rechecks_source_before_sending_verified_context(comparison, monkeypatch):
    e = comparison
    pair = create(e)

    def fail():
        raise GenerationTransportError("MODEL_UNAVAILABLE", 503, retryable=True)

    def change_source_during_wait(*_):
        (e.env.root / EDITABLE_PATH).write_text("changed outside the run", encoding="utf-8")
        return 0

    e.state.action = fail
    monkeypatch.setattr("app.agent_assistance.run_service.uniform", change_source_during_wait)
    e.service.start(TOKEN, pair["pair_id"], "local", {"kind": "no_candidate"})
    e.executor.drain()
    result = e.service.get(TOKEN, pair["pair_id"])["branches"]["local"]
    assert result["run"]["error_code"] == "STALE_SNAPSHOT"
    assert len(e.state.calls) == 1 and not result["revisions"]


def test_revoke_blocks_history_and_generation_after_prepare(comparison):
    e = comparison
    pair = create(e)
    start_pair(e, pair)
    grants(e.env, frozenset())
    with pytest.raises(ControlAccessDenied):
        e.service.get(TOKEN, pair["pair_id"])
    e.executor.drain()
    e.executor.drain()
    assert e.state.calls == []


def test_embedding_outage_is_recorded_for_local_without_running_or_warming_none(comparison):
    e = comparison

    def unavailable(prompt):
        raise ContextError("EMBEDDING_UNAVAILABLE", 503)

    e.contexts.embedding = SimpleNamespace(embed=unavailable)
    pair = create(e)
    assert pair["branches"]["local"]["status"] == "error"
    assert pair["branches"]["local"]["error_code"] == "EMBEDDING_UNAVAILABLE"
    e.service.start(TOKEN, pair["pair_id"], "none", {"kind": "not_applicable"})
    e.executor.drain()
    assert e.service.get(TOKEN, pair["pair_id"])["branches"]["none"]["status"] == "passed"
    with e.env.database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM control.context_entries").fetchone() == (0,)


def test_http_auth_report_limits_scope_injection_and_provider_consent(comparison):
    e = comparison
    headers = {"Authorization": "Bearer " + TOKEN, "Idempotency-Key": "http-pair"}
    body = {
        "snapshot_id": str(e.env.snapshot.snapshot_id),
        "prompt": "test-only",
        "cache_state": "cold",
        "provider_consent": True,
    }
    assert e.client.post("/api/v1/agent/comparisons", json=body).status_code == 401
    for extra in (
        {"owner_id": str(uuid4())},
        {"provider_url": "http://evil"},
        {"provider_consent": False},
    ):
        assert (
            e.client.post(
                "/api/v1/agent/comparisons", json={**body, **extra}, headers=headers
            ).status_code
            == 400
        )
    response = e.client.post("/api/v1/agent/comparisons", json=body, headers=headers)
    assert response.status_code == 202 and response.headers["cache-control"] == "no-store"
    pair_id = response.json()["data"]["pair_id"]
    assert (
        e.client.post(
            f"/api/v1/agent/comparisons/{pair_id}/local",
            headers=headers,
            json={"lookup_report": {"kind": "candidate", "candidates": []}},
        ).status_code
        == 400
    )
    assert e.client.get(f"/api/v1/agent/comparisons/{uuid4()}", headers=headers).status_code == 404
    assert e.state.calls == []
