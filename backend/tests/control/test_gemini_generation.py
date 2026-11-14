"""Provider doubles only: Gemini transport, output bounds and error semantics."""

import io
import json
import urllib.error
from contextlib import contextmanager

import pytest

from app.agent_assistance.gemini_generation import (
    ENDPOINT,
    MODEL,
    GeminiContentGeneration,
    decode_response,
)
from app.agent_assistance.generation import AgentError
from app.agent_assistance.generation_transport import NoRedirect


def response_value():
    return {
        "modelVersion": MODEL,
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {
                    "role": "model",
                    "parts": [
                        {"thought": True, "text": "test-only hidden reasoning"},
                        {"text": json.dumps({"answer": "test-only answer", "content": None})},
                    ],
                },
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 10,
            "candidatesTokenCount": 7,
            "thoughtsTokenCount": 3,
            "totalTokenCount": 20,
        },
    }


def test_usage_includes_reported_thinking_and_never_invents_missing_counters():
    value = response_value()
    result = decode_response(value)
    assert result.answer == "test-only answer" and result.content is None
    assert result.usage == {"input_tokens": 10, "output_tokens": 10, "total_tokens": 20}
    del value["usageMetadata"]["candidatesTokenCount"]
    assert decode_response(value).usage is None
    del value["usageMetadata"]
    assert decode_response(value).usage is None


@pytest.mark.parametrize(
    "mutation",
    [
        lambda v: v.update(modelVersion="gemini-3.5-flash-lite-lite"),
        lambda v: v.update(candidates=[]),
        lambda v: v.update(candidates=[None]),
        lambda v: v["candidates"][0]["content"].update(role="user"),
        lambda v: v["candidates"][0]["content"].update(
            parts=[{"functionCall": {"name": "deploy"}}]
        ),
        lambda v: v["candidates"][0]["content"].update(parts=[{"text": "not JSON"}]),
        lambda v: v["usageMetadata"].update(promptTokenCount=True),
        lambda v: v["usageMetadata"].update(thoughtsTokenCount=-1),
        lambda v: v["candidates"][0]["content"].update(
            parts=[
                {
                    "text": json.dumps(
                        {
                            "answer": "test",
                            "content": "x" * 65537,
                        }
                    )
                }
            ]
        ),
        lambda v: v["candidates"][0]["content"].update(
            parts=[
                {
                    "text": json.dumps(
                        {
                            "answer": "test",
                            "content": None,
                            "approved": True,
                        }
                    )
                }
            ]
        ),
    ],
)
def test_malformed_or_unbound_provider_output_is_rejected(mutation):
    value = response_value()
    mutation(value)
    with pytest.raises(AgentError, match="MODEL_INVALID_RESPONSE"):
        decode_response(value)


@pytest.mark.parametrize(
    "reason,code",
    [
        ("MAX_TOKENS", "MODEL_INCOMPLETE"),
        ("SAFETY", "MODEL_REFUSED"),
        ("RECITATION", "MODEL_REFUSED"),
        ("OTHER", "MODEL_INCOMPLETE"),
    ],
)
def test_partial_and_blocked_output_never_becomes_a_suggestion(reason, code):
    value = response_value()
    value["candidates"][0]["finishReason"] = reason
    with pytest.raises(AgentError, match=code):
        decode_response(value)
    with pytest.raises(AgentError, match="MODEL_REFUSED"):
        decode_response({"promptFeedback": {"blockReason": "SAFETY"}})


def test_private_key_rotation_history_mapping_and_fixed_transport(tmp_path, monkeypatch):
    config = tmp_path / "gemini.env"
    model = GeminiContentGeneration(config)
    assert not model.configured()
    with pytest.raises(AgentError, match="MODEL_NOT_CONFIGURED"):
        model.generate("test", (), [])
    key = "test-only-gemini-" + "a" * 40
    config.write_text("GEMINI_API_KEY=" + key, encoding="utf-8")
    seen = []

    class Opener:
        @contextmanager
        def open(self, request, timeout):
            seen.append(request)
            assert timeout == 75

            class Response:
                def read(self, limit):
                    assert limit == 524289
                    return json.dumps(response_value()).encode()

            yield Response()

    def build(*handlers):
        assert handlers[0].proxies == {} and isinstance(handlers[1], NoRedirect)
        return Opener()

    monkeypatch.setattr("urllib.request.build_opener", build)
    assert model.configured()
    model.generate(
        "test",
        (("file.py", "test-only source"),),
        [
            {"role": "user", "content": "question"},
            {"role": "assistant", "content": "answer"},
        ],
    )
    request = seen[0]
    body = json.loads(request.data)
    assert request.full_url == ENDPOINT and "?" not in request.full_url
    assert request.get_header("X-goog-api-key") == key
    assert [m["role"] for m in body["contents"]] == ["user", "model", "user"]
    assert "tools" not in body and "cachedContent" not in body
    assert body["generationConfig"]["responseJsonSchema"]["additionalProperties"] is False
    assert key not in str(body)
    config.write_text("GEMINI_API_KEY=test-only-rotated-" + "b" * 40, encoding="utf-8")
    model.generate("test", (), [])
    assert seen[-1].get_header("X-goog-api-key") != key
    config.write_text("OPENAI_API_KEY=" + key, encoding="utf-8")
    assert not model.configured()  # The old provider's key cannot configure Gemini.


@pytest.mark.parametrize(
    "status,reason,code",
    [
        (400, "API_KEY_INVALID", "MODEL_KEY_REJECTED"),
        (400, "INVALID_ARGUMENT", "MODEL_REQUEST_REJECTED"),
        (401, "", "MODEL_KEY_REJECTED"),
        (403, "", "MODEL_ACCESS_DENIED"),
        (404, "", "MODEL_NOT_AVAILABLE"),
        (429, "", "MODEL_RATE_LIMIT"),
        (500, "", "MODEL_UNAVAILABLE"),
        (302, "", "MODEL_UNAVAILABLE"),
    ],
)
def test_http_errors_are_sanitized_without_retry(tmp_path, monkeypatch, status, reason, code):
    config = tmp_path / "gemini.env"
    config.write_text("GEMINI_API_KEY=test-only-key-" + "a" * 40)
    calls = []

    class Opener:
        def open(self, request, timeout):
            calls.append(request)
            raise urllib.error.HTTPError(
                ENDPOINT,
                status,
                "secret-must-not-echo",
                {},
                io.BytesIO(
                    json.dumps(
                        {
                            "error": {
                                "message": "secret-must-not-echo",
                                "details": [
                                    {"reason": reason},
                                ],
                            }
                        }
                    ).encode(),
                ),
            )

    monkeypatch.setattr("urllib.request.build_opener", lambda *handlers: Opener())
    with pytest.raises(AgentError, match=code) as caught:
        GeminiContentGeneration(config).generate("test", (), [])
    assert len(calls) == 1 and "secret-must-not-echo" not in str(caught.value)


@pytest.mark.parametrize(
    "raw", [b"not JSON", b"[]", b"x" * 524289], ids=["invalid-json", "array", "oversized"]
)
def test_invalid_or_oversized_http_body_is_rejected(tmp_path, monkeypatch, raw):
    config = tmp_path / "gemini.env"
    config.write_text("GEMINI_API_KEY=test-only-key-" + "a" * 40)

    class Opener:
        @contextmanager
        def open(self, request, timeout):
            class Response:
                def read(self, limit):
                    return raw

            yield Response()

    monkeypatch.setattr("urllib.request.build_opener", lambda *handlers: Opener())
    with pytest.raises(AgentError, match="MODEL_INVALID_RESPONSE"):
        GeminiContentGeneration(config).generate("test", (), [])
