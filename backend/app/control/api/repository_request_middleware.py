"""Bound repository input without buffering source requests; sanitize unexpected errors."""

from uuid import uuid4

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class RepositoryRequestMiddleware:
    def __init__(self, app: ASGIApp):
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http" or not scope["path"].startswith("/api/v1/repository"):
            await self._app(scope, receive, send)
            return
        request_id = str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        started = False

        async def referenced(message: Message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                message = {
                    **message,
                    "headers": [
                        *[
                            (key, value)
                            for key, value in message.get("headers", [])
                            if key.lower() not in (b"cache-control", b"x-request-id")
                        ],
                        (b"cache-control", b"no-store"),
                        (b"x-request-id", request_id.encode()),
                        (b"x-content-type-options", b"nosniff"),
                    ],
                }
            await send(message)

        async def reject(status: int, code: str):
            await JSONResponse(
                status_code=status,
                content={
                    "error": {
                        "code": code,
                        "message": "Repository request could not be completed.",
                    },
                    "meta": {
                        "contract_version": "v0.2",
                        "request_id": request_id,
                        "identity_mode": "fixture",
                    },
                },
            )(scope, receive, referenced)

        declared = dict(scope.get("headers", [])).get(b"content-length")
        if declared is not None:
            try:
                length = int(declared)
                if length < 0:
                    raise ValueError()
            except ValueError:
                await reject(400, "INVALID_REQUEST")
                return
            if length > 65536:
                await reject(413, "PAYLOAD_TOO_LARGE")
                return
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message.get("body"):
                await reject(400, "INVALID_REQUEST")
                return
            if not message.get("more_body", False):
                break

        async def empty() -> Message:
            return {"type": "http.request", "body": b"", "more_body": False}

        try:
            await self._app(scope, empty, referenced)
        except Exception:
            if started:
                raise
            await reject(500, "INTERNAL_ERROR")
