"""Query-only embedding adapter with explicit provider doubles; no external calls."""

import pytest

from app.agent_assistance.generation import AgentError
from app.context_cache.context_contract import ContextError
from app.context_cache.gemini_embedding import GeminiQueryEmbedding


def test_embedding_sends_only_query_and_fixed_descriptor_to_provider(monkeypatch):
    monkeypatch.setattr(
        "app.context_cache.gemini_embedding.private_key", lambda *args: "test-only-key"
    )
    seen = []

    def provider(endpoint, headers, body):
        seen.append((endpoint, headers, body))
        return {"embedding": {"values": [3.0, 4.0] + [0.0] * 766}}

    monkeypatch.setattr("app.context_cache.gemini_embedding.post_generation_json", provider)
    assert GeminiQueryEmbedding(None).embed("test-only query")[:2] == [0.6, 0.8]
    assert (
        seen[0][0]
        == "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
    )
    assert seen[0][2] == {
        "model": "models/gemini-embedding-001",
        "content": {"parts": [{"text": "test-only query"}]},
        "taskType": "SEMANTIC_SIMILARITY",
        "outputDimensionality": 768,
    }


@pytest.mark.parametrize(
    "value",
    [
        {},
        {"embedding": None},
        {"embedding": {"values": [0.0] * 768}},
        {"embedding": {"values": [True] * 768}},
    ],
    ids=["missing", "null", "zero", "boolean"],
)
def test_embedding_invalid_response_does_not_become_miss(monkeypatch, value):
    monkeypatch.setattr(
        "app.context_cache.gemini_embedding.private_key", lambda *args: "test-only-key"
    )
    monkeypatch.setattr(
        "app.context_cache.gemini_embedding.post_generation_json", lambda *args: value
    )
    with pytest.raises(ContextError, match="EMBEDDING_INVALID_RESPONSE"):
        GeminiQueryEmbedding(None).embed("test-only query")


def test_embedding_no_key_and_provider_outage_are_explicit_errors(monkeypatch):
    monkeypatch.setattr("app.context_cache.gemini_embedding.private_key", lambda *args: None)
    with pytest.raises(ContextError, match="EMBEDDING_NOT_CONFIGURED"):
        GeminiQueryEmbedding(None).embed("test-only query")
    monkeypatch.setattr(
        "app.context_cache.gemini_embedding.private_key", lambda *args: "test-only-key"
    )

    def unavailable(*args):
        raise AgentError("MODEL_UNAVAILABLE")

    monkeypatch.setattr("app.context_cache.gemini_embedding.post_generation_json", unavailable)
    with pytest.raises(ContextError, match="EMBEDDING_UNAVAILABLE"):
        GeminiQueryEmbedding(None).embed("test-only query")
