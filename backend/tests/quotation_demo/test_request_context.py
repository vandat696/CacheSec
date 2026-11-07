import asyncio
import json

import pytest

from app.quotation_demo.http.request_context import QuotationRequestContext


@pytest.mark.parametrize("declared", [None, b"1"])
def test_actual_stream_bytes_are_bounded_even_without_an_honest_content_length(declared):
    called, sent = [], []
    messages = iter(
        [
            {"type": "http.request", "body": b"abc", "more_body": True},
            {"type": "http.request", "body": b"def", "more_body": False},
        ]
    )

    async def app(scope, receive, send):
        called.append(True)

    async def receive():
        return next(messages)

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "headers": [(b"content-length", declared)] if declared else []}
    asyncio.run(QuotationRequestContext(app, max_body_bytes=5)(scope, receive, send))
    assert called == []
    assert sent[0]["status"] == 413
    assert json.loads(sent[1]["body"])["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_body_at_limit_is_replayed_and_incoming_request_id_does_not_become_authority():
    seen, sent = [], []
    messages = iter(
        [
            {"type": "http.request", "body": b"ab", "more_body": True},
            {"type": "http.request", "body": b"cde", "more_body": False},
        ]
    )

    async def app(scope, receive, send):
        seen.append(await receive())
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    async def receive():
        return next(messages)

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "headers": [(b"x-request-id", b"client-chosen")]}
    asyncio.run(QuotationRequestContext(app, max_body_bytes=5)(scope, receive, send))
    assert seen == [{"type": "http.request", "body": b"abcde", "more_body": False}]
    assert scope["state"]["request_id"] != "client-chosen"
    assert dict(sent[0]["headers"])[b"cache-control"] == b"no-store"
