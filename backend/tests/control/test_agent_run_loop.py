"""Deterministic loop tests with marked model/tool doubles; no provider or Docker calls."""

from dataclasses import replace
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.agent_assistance.generation import AgentError
from app.agent_assistance.run_service import AgentRunService
from app.agent_assistance.run_store import LocalAgentRunStore
from app.change_workflow.workflow_repository import WorkflowStorageUnavailable
from app.identity.control_authority import (
    ControlAccessDenied,
    ControlPrincipal,
    ControlResourceUnavailable,
    RepositoryScope,
    control_token_digest,
)

TOKEN = "test-only-agent-" + "a" * 40
HASH = "sha256:" + "a" * 64


class ManualExecutor:
    def __init__(self):
        self.pending = []

    def submit(self, function, *args):
        self.pending.append((function, args))

    def drain(self):
        function, args = self.pending.pop(0)
        function(*args)


@pytest.fixture
def loop():
    actor = ControlPrincipal(
        RepositoryScope(uuid4(), uuid4()), uuid4(), 1, control_token_digest(TOKEN)
    )
    state = SimpleNamespace(
        actor=actor,
        allowed=True,
        now=0.0,
        after_generate=lambda: None,
        outcomes=["passed"],
        after_job=lambda: None,
    )

    class Access:
        def current(self, token, *, execute):
            if execute and not state.allowed:
                raise ControlAccessDenied()
            return state.actor

    class Generation:
        def __init__(self):
            self.calls = []
            self.content = "test-only candidate"

        def config(self, token):
            return {"model": "gemini-3.5-flash-lite", "configured": True}

        def ask(self, token, snapshot, prompt, history, candidate=None):
            self.calls.append((history, candidate))
            state.after_generate()
            return {
                "model": "gemini-3.5-flash-lite",
                "snapshot_id": str(snapshot),
                "answer": "test-only suggestion",
                "content": self.content,
                "usage": None,
            }

    class Tools:
        def __init__(self):
            self.saved, self.jobs, self.source_checks = [], [], 0

        def check_source(self, token, snapshot):
            self.source_checks += 1

        def save(self, token, snapshot, content, key, previous):
            record = {
                "proposal_id": previous["proposal_id"] if previous else uuid4(),
                "revision": len(self.saved) + 1,
                "artifact_digest": HASH,
                "profile_digest": HASH,
                "content": content,
            }
            self.saved.append(record)
            return record

        def request_test(self, token, revision, key):
            outcome = state.outcomes[min(len(self.jobs), len(state.outcomes) - 1)]
            job = {
                **revision,
                "job_id": uuid4(),
                "status": outcome,
                "result": {"outcome": outcome, "reason": "COMPLETED", "checks": []},
                "evidence_digest": HASH if outcome == "passed" else None,
            }
            self.jobs.append(job)
            return job

        def job(self, token, job_id):
            state.after_job()
            return self.jobs[-1]

        def revision(self, token, proposal_id):
            return self.saved[-1]

    generation, tools, executor = Generation(), Tools(), ManualExecutor()
    store = LocalAgentRunStore()
    service = AgentRunService(Access(), generation, tools, store, executor, lambda: state.now)
    snapshot = uuid4()
    return SimpleNamespace(
        service=service,
        generation=generation,
        tools=tools,
        state=state,
        executor=executor,
        store=store,
        snapshot=snapshot,
        start=lambda key="test-run": service.start(TOKEN, snapshot, "test task", key),
    )


def finish(env):
    response = env.start()
    env.executor.drain()
    from uuid import UUID

    return env.service.get(TOKEN, UUID(response["run_id"]))


def test_failed_candidate_is_repaired_from_its_bound_feedback_and_source(loop):
    loop.state.outcomes = ["failed", "passed"]
    result = finish(loop)
    assert result["status"] == "passed" and result["revision"] == 2
    assert len(loop.generation.calls) == 2 and len(loop.tools.saved) == 2
    assert loop.generation.calls[1][1] == "test-only candidate"
    assert "trusted_technical_test_feedback" in loop.generation.calls[1][0][0]["content"]
    assert all("token" not in key for key in result)
    assert TOKEN not in repr(result) and TOKEN not in repr(next(iter(loop.store.records.values())))
    assert next(iter(loop.store.records.values())).token is None


def test_no_suggestion_needs_input_without_writes_or_test(loop):
    loop.generation.content = None
    result = finish(loop)
    assert result["status"] == "needs_input" and not loop.tools.saved and not loop.tools.jobs


def test_repeated_failures_exhaust_three_calls_and_three_tests(loop):
    loop.state.outcomes = ["failed"]
    result = finish(loop)
    assert result["status"] == "exhausted" and result["turn"] == 3
    assert len(loop.generation.calls) == len(loop.tools.jobs) == 3


@pytest.mark.parametrize("outcome", ["error", "timed_out", "blocked", "unknown"])
def test_infrastructure_errors_never_trigger_model_repair_or_pass(loop, outcome):
    loop.state.outcomes = [outcome]
    result = finish(loop)
    assert result["status"] == "error" and len(loop.generation.calls) == 1
    assert result["test_status"] == outcome


def test_revoked_before_or_during_generation_stops_all_subsequent_tools(loop):
    initial = loop.start()
    loop.state.allowed = False
    loop.executor.drain()
    assert next(iter(loop.store.records.values())).error_code == "AGENT_ACCESS_REVOKED"
    assert loop.generation.calls == []
    loop.state.allowed = True
    loop.state.after_generate = lambda: setattr(loop.state, "allowed", False)
    loop.start("second")
    loop.executor.drain()
    assert not loop.tools.saved
    assert initial["status"] == "queued"


@pytest.mark.parametrize("mode", ["cancel", "deadline"])
def test_cancel_or_deadline_during_generation_discards_the_response(loop, mode):
    def stop():
        if mode == "cancel":
            loop.service.shutdown()
        else:
            loop.state.now = 601

    loop.state.after_generate = stop
    result = finish(loop)
    assert result["status"] == ("cancelled" if mode == "cancel" else "timed_out")
    assert not loop.tools.saved and not loop.tools.jobs


def test_cancel_while_waiting_keeps_job_reference_and_reports_that_test_can_continue(loop):
    loop.state.outcomes = ["running"]
    loop.state.after_job = loop.service.shutdown
    result = finish(loop)
    assert result["status"] == "cancelled" and result["test_job_id"]
    assert result["test_may_continue"] and len(loop.generation.calls) == 1


def test_test_result_for_another_artifact_never_becomes_passed(loop):
    original = loop.tools.request_test

    def mismatched(*args):
        return {**original(*args), "artifact_digest": "sha256:" + "b" * 64}

    loop.tools.request_test = mismatched
    result = finish(loop)
    assert result["status"] == "error" and result["error_code"] == "AGENT_BINDING_MISMATCH"


def test_other_identity_cannot_read_or_cancel_run_even_in_the_same_repo(loop):
    from uuid import UUID

    result = loop.start()
    loop.state.actor = replace(loop.state.actor, principal_id=uuid4())
    for operation in (loop.service.get, loop.service.cancel):
        with pytest.raises(ControlResourceUnavailable):
            operation(TOKEN, UUID(result["run_id"]))
    loop.executor.drain()
    assert not loop.generation.calls


def test_start_is_idempotent_and_conflicting_payload_or_parallel_run_is_rejected(loop):
    first = loop.start()
    assert loop.start()["run_id"] == first["run_id"] and len(loop.executor.pending) == 1
    with pytest.raises(AgentError, match="IDEMPOTENCY_CONFLICT"):
        loop.service.start(TOKEN, loop.snapshot, "changed task", "test-run")
    with pytest.raises(AgentError, match="AGENT_BUSY"):
        loop.start("other")
    loop.executor.drain()
    assert loop.start()["status"] == "passed" and not loop.executor.pending


@pytest.mark.parametrize("operation", ["save", "request_test"])
def test_storage_failure_has_unknown_effect_without_retry_or_fabricated_success(loop, operation):
    def failed(*args):
        raise WorkflowStorageUnavailable()

    setattr(loop.tools, operation, failed)
    result = finish(loop)
    assert result["status"] == "error" and result["error_code"] == "STORAGE_UNAVAILABLE"
    assert any(event["state"] == "effect_unknown" for event in result["events"])
    assert not loop.tools.jobs and len(loop.generation.calls) == 1
    if operation == "request_test":
        assert any(
            event["tool"] == "test" and event["state"] == "started" for event in result["events"]
        )


def test_provider_failure_is_not_retried_and_raw_errors_never_escape(loop):
    def failed(*args):
        raise RuntimeError("secret-provider-error")

    loop.generation.ask = failed
    result = finish(loop)
    assert result["status"] == "error" and result["error_code"] == "AGENT_INTERNAL_ERROR"
    assert "secret-provider-error" not in repr(result) and not loop.tools.saved
