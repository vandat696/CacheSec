"""Bounded body transport and sanitized request references."""

from uuid import uuid4

from fastapi.responses import JSONResponse
from starlette.types import ASGIApp


class WorkflowRequestMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith(
            ("/api/v1/changes", "/api/v1/agent", "/_internal/test-worker")
        ):
            await self.app(scope, receive, send)
            return
        request_id = str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        started = False

        async def referenced(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                message = {
                    **message,
                    "headers": [
                        *[
                            (k, v)
                            for k, v in message.get("headers", [])
                            if k.lower() not in (b"cache-control", b"x-request-id")
                        ],
                        (b"cache-control", b"no-store"),
                        (b"x-request-id", request_id.encode()),
                        (b"x-content-type-options", b"nosniff"),
                    ],
                }
            await send(message)

        async def reject(status, code):
            await JSONResponse(
                status_code=status,
                content={
                    "error": {"code": code, "message": "Workflow request failed."},
                    "meta": {
                        "contract_version": "v0.2",
                        "identity_mode": "fixture",
                        "request_id": request_id,
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
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > 65536:
                await reject(413, "PAYLOAD_TOO_LARGE")
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        try:
            await self.app(scope, replay, referenced)
        except Exception:
            if started:
                raise
            await reject(500, "INTERNAL_ERROR")
