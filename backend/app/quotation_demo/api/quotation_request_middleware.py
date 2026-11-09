from uuid import uuid4

from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.quotation_demo.api.quotation_responses import CONTRACT_VERSION


class QuotationRequestMiddleware:
    """Bound actual request bytes and provide backend-generated correlation IDs."""

    def __init__(self, app: ASGIApp, *, max_body_bytes: int):
        if type(max_body_bytes) is not int or max_body_bytes < 1:
            raise ValueError("Request body limit must be a positive integer.")
        self._app, self._max_body_bytes = app, max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return
        request_id = str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        async def send_with_reference(message: Message):
            if message["type"] == "http.response.start":
                headers = [
                    pair
                    for pair in message.get("headers", [])
                    if pair[0].lower() not in (b"x-request-id", b"cache-control")
                ]
                message = {
                    **message,
                    "headers": [
                        *headers,
                        (b"x-request-id", request_id.encode()),
                        (b"cache-control", b"no-store"),
                    ],
                }
            await send(message)

        async def reject(status: int, code: str, text: str):
            response = JSONResponse(
                status_code=status,
                content={
                    "error": {"code": code, "message": text},
                    "meta": {
                        "contract_version": CONTRACT_VERSION,
                        "request_id": request_id,
                        "identity_mode": "fixture",
                    },
                },
            )
            await response(scope, receive, send_with_reference)

        declared = dict(scope.get("headers", [])).get(b"content-length")
        if declared is not None:
            try:
                length = int(declared)
                if length < 0:
                    raise ValueError()
            except ValueError:
                await reject(400, "INVALID_REQUEST", "Invalid content length.")
                return
            if length > self._max_body_bytes:
                await reject(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the configured limit.")
                return
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > self._max_body_bytes:
                await reject(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the configured limit.")
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay() -> Message:
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        await self._app(scope, replay, send_with_reference)
