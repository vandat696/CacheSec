import json
from contextlib import contextmanager
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agent_assistance.assistance_http import configure_assistance_http
from app.agent_assistance.assistance_service import AgentAssistanceService
from app.agent_assistance.gemini_generation import MODEL as GEMINI_MODEL
from app.agent_assistance.generation import AgentError, GenerationResult
from app.agent_assistance.openai_generation import MODEL, OpenAIResponsesGeneration, decode_response
from app.change_workflow.test_profiles import EDITABLE_PATH, OVERLAY_PATHS
from app.change_workflow.workflow_http import configure_workflow_http
from app.control.api.repository_http_app import configure_repository_http
from app.identity.control_authority import (
    ControlAccessDenied,
    ControlResourceUnavailable,
    RepositoryAccessService,
)
from app.identity.postgres_control_authority import PostgresControlAuthorityTransactions
from tests.control.test_change_workflow_integration import TOKEN, grants
from tests.control.test_change_workflow_integration import workflow as workflow


class FakeGeneration:
    model_id = MODEL

    def __init__(self, action=lambda: None, configured=True, model_id=MODEL):
        self.model_id = model_id
        self.action, self.enabled, self.calls = action, configured, []

    def configured(self):
        return self.enabled

    def generate(self, prompt, files, history):
        self.calls.append((prompt, files, history))
        self.action()
        return GenerationResult("test-only model answer", "test-only source", self.model_id, None)


@pytest.fixture(params=[MODEL, GEMINI_MODEL])
def model_id(request):
    return request.param


def service(env, model):
    access = RepositoryAccessService(PostgresControlAuthorityTransactions(env.database))
    return AgentAssistanceService(access, env.snapshots, model)


def test_authorized_context_is_exact_and_generation_never_writes_or_executes(workflow, model_id):
    env, model = workflow, FakeGeneration(model_id=model_id)
    result = service(env, model).ask(TOKEN, env.snapshot.snapshot_id, "explain", [])
    assert tuple(path for path, _ in model.calls[0][1]) == OVERLAY_PATHS
    assert result["snapshot_id"] == str(env.snapshot.snapshot_id)
    assert result["content"] == "test-only source" and result["usage"] is None
    assert (env.root / EDITABLE_PATH).read_bytes() == b"original\r\n"
    with env.database.connection() as connection:
        assert (
            connection.execute("SELECT count(*) FROM control.change_proposals").fetchone()[0] == 0
        )


def test_denied_or_unknown_snapshot_never_reaches_provider(workflow, model_id):
    env, model = workflow, FakeGeneration(model_id=model_id)
    svc = service(env, model)
    with pytest.raises(ControlResourceUnavailable):
        svc.ask(TOKEN, uuid4(), "explain", [])
    grants(env, frozenset())
    with pytest.raises(ControlAccessDenied):
        svc.ask(TOKEN, env.snapshot.snapshot_id, "explain", [])
    assert model.calls == []


def test_revocation_during_generation_discards_response(workflow, model_id):
    env = workflow
    model = FakeGeneration(lambda: grants(env, frozenset()), model_id=model_id)
    with pytest.raises(ControlAccessDenied):
        service(env, model).ask(TOKEN, env.snapshot.snapshot_id, "explain", [])
    assert len(model.calls) == 1


@pytest.mark.parametrize("during_generation", [False, True])
def test_source_changes_before_or_during_generation_discard_suggestion(
    workflow, during_generation, model_id
):
    env = workflow

    def modify():
        (env.root / EDITABLE_PATH).write_text("changed", encoding="utf-8")

    model = FakeGeneration(modify if during_generation else lambda: None, model_id=model_id)
    if not during_generation:
        modify()
    with pytest.raises(AgentError, match="STALE_SNAPSHOT"):
        service(env, model).ask(TOKEN, env.snapshot.snapshot_id, "explain", [])
    assert len(model.calls) == int(during_generation)


def test_http_auth_body_limits_and_errors_do_not_echo_source_or_secret(workflow, model_id):
    env, model = workflow, FakeGeneration(configured=False, model_id=model_id)
    svc = service(env, model)
    app = FastAPI()
    configure_repository_http(app, svc.access, env.snapshots)
    configure_workflow_http(app, env.proposals, env.jobs, None)
    configure_assistance_http(app, svc)
    with TestClient(app) as client:
        headers = {"Authorization": "Bearer " + TOKEN}
        assert client.get("/api/v1/agent/config").status_code == 401
        config = client.get("/api/v1/agent/config", headers=headers)
        assert config.json()["data"] == {"model": model_id, "configured": False, "mode": "assisted"}
        payload = {"snapshot_id": str(env.snapshot.snapshot_id), "prompt": "explain"}
        result = client.post("/api/v1/agent/messages", json=payload, headers=headers)
        assert (
            result.status_code == 503 and result.json()["error"]["code"] == "MODEL_NOT_CONFIGURED"
        )
        for extra in ({"path": "../secret"}, {"provider_url": "http://evil"}, {"role": "reviewer"}):
            response = client.post(
                "/api/v1/agent/messages", json={**payload, **extra}, headers=headers
            )
            assert response.status_code == 400 and "../secret" not in response.text
        assert (
            client.post(
                "/api/v1/agent/messages", json={**payload, "prompt": "x" * 70000}, headers=headers
            ).status_code
            == 413
        )
        model.enabled = True
        model.action = lambda: grants(env, frozenset())
        denied = client.post("/api/v1/agent/messages", json=payload, headers=headers)
        assert denied.status_code == 403 and "test-only model answer" not in denied.text
        assert denied.headers["cache-control"] == "no-store"


def response_value(data=None):
    return {
        "status": "completed",
        "model": MODEL,
        "output": [
            {"type": "reasoning"},
            {
                "type": "message",
                "role": "assistant",
                "content": [
                    {
                        "type": "output_text",
                        "text": json.dumps(data or {"answer": "test", "content": None}),
                    },
                ],
            },
        ],
    }


def test_adapter_handles_refusal_incomplete_invalid_output_and_missing_usage():
    assert decode_response(response_value()).usage is None
    for value in (
        {"status": "incomplete"},
        response_value({"answer": "test", "content": "x" * 65537}),
        response_value({"answer": "test", "content": None, "approved": True}),
        {**response_value(), "model": "other-model"},
    ):
        with pytest.raises(AgentError):
            decode_response(value)
    refused = response_value()
    refused["output"][1]["content"] = [{"type": "refusal", "refusal": "test-only"}]
    with pytest.raises(AgentError, match="MODEL_REFUSED"):
        decode_response(refused)


def test_adapter_reads_private_key_dynamically_and_uses_only_fixed_endpoint(tmp_path, monkeypatch):
    config = tmp_path / "openai.env"
    adapter = OpenAIResponsesGeneration(config)
    assert not adapter.configured()
    with pytest.raises(AgentError, match="MODEL_NOT_CONFIGURED"):
        adapter.generate("test", (), [])
    config.write_text("OPENAI_API_KEY=test-only-key-" + "a" * 40)
    seen = []

    class Opener:
        @contextmanager
        def open(self, request, timeout):
            seen.append((request, timeout))

            class Response:
                def read(self, limit):
                    assert limit == 524289
                    return json.dumps(response_value()).encode()

            yield Response()

    monkeypatch.setattr("urllib.request.build_opener", lambda *handlers: Opener())
    assert adapter.configured()
    assert adapter.generate("test", (("file.py", "source"),), []).answer == "test"
    request, timeout = seen[0]
    body = json.loads(request.data)
    assert request.full_url == "https://api.openai.com/v1/responses" and timeout == 75
    assert body["model"] == MODEL and body["store"] is False and "tools" not in body
    assert body["text"]["format"]["strict"] is True
    assert "test-only-key" not in str(body)
