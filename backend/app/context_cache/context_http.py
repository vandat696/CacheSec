"""Strict browser context protocol; no client-supplied owner, namespace or model."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Header, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.context_cache.context_contract import ContextError
from app.control.api.repository_routes import bearer, envelope


class ContextPrepareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    snapshot_id: UUID
    prompt: str = Field(min_length=1, max_length=4000)
    mode: Literal["none", "local"]
    purpose: Literal["inspect", "change"]


class ContextFile(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    path: str = Field(min_length=1, max_length=512)
    content: str = Field(max_length=131072)


class ContextPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    kind: Literal["full-source-context-v1"]
    files: list[ContextFile] = Field(min_length=1, max_length=256)


class ContextCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entry_id: UUID
    kind: Literal["exact", "semantic"]
    payload: ContextPayload


class LookupReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["not_applicable", "no_candidate", "candidate", "client_storage_error"]
    candidates: list[ContextCandidate] = Field(default_factory=list, max_length=3)
    client_state: Literal["cold", "warm"] | None = None
    lookup_ms: float | None = Field(default=None, ge=0, le=600000, allow_inf_nan=False)

    @model_validator(mode="after")
    def candidate_shape(self):
        if bool(self.candidates) != (self.kind == "candidate"):
            raise ValueError("Candidate report requires candidates only.")
        return self


class ContextMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    context_request_id: UUID
    lookup_report: LookupReport


def configure_context_http(app, contexts, assistance):
    async def error(request, exc):
        return JSONResponse(
            status_code=exc.status,
            content={
                "error": {"code": exc.code, "message": "Context request could not be completed."},
                "meta": {
                    "contract_version": "v0.2",
                    "identity_mode": "fixture",
                    "request_id": request.state.request_id,
                },
            },
        )

    app.add_exception_handler(ContextError, error)
    router = APIRouter(prefix="/api/v1/agent/context")
    auth = Annotated[str | None, Header(alias="Authorization")]

    def check(request):
        if request.query_params:
            raise ContextError("INVALID_REQUEST", 400)
        if contexts is None:
            raise ContextError("CONTEXT_NOT_CONFIGURED", 503)

    @router.post("/requests")
    async def prepare(body: ContextPrepareRequest, request: Request, authorization: auth = None):
        check(request)
        return envelope(
            request,
            await run_in_threadpool(
                contexts.prepare,
                bearer(authorization),
                body.snapshot_id,
                body.prompt,
                body.mode,
                body.purpose,
            ),
        )

    @router.post("/messages")
    async def generate(body: ContextMessageRequest, request: Request, authorization: auth = None):
        check(request)
        token = bearer(authorization)
        context_request, resolved, resolution = await run_in_threadpool(
            contexts.resolve,
            token,
            body.context_request_id,
            body.lookup_report.model_dump(mode="json"),
        )
        reply = await run_in_threadpool(assistance.generate, token, context_request, resolved, [])
        return envelope(
            request,
            {
                **reply,
                "context": {
                    **resolution,
                    "request_id": str(body.context_request_id),
                    "admission": resolved.admission,
                    "embedding_calls": context_request["embedding_calls"],
                    "embedding_ms": context_request["embedding_ms"],
                },
            },
        )

    app.include_router(router)
