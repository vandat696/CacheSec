"""Owned comparison creation/start/history with server-validated model selection."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Header, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.context_cache.context_contract import ContextError
from app.context_cache.context_http import LookupReport
from app.control.api.repository_routes import bearer, envelope


class CreateComparison(BaseModel):
    model_config = ConfigDict(extra="forbid")
    snapshot_id: UUID
    prompt: str = Field(min_length=1, max_length=4000)
    cache_state: Literal["cold", "warm", "preload"]
    provider_consent: Literal[True]
    model: str | None = Field(default=None, min_length=1, max_length=64)

    @field_validator("provider_consent", mode="before")
    @classmethod
    def explicit_consent(cls, value):
        if value is not True:
            raise ValueError("Explicit source-sharing consent is required.")
        return value


class StartBranch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lookup_report: LookupReport


class CacheIoReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    report_id: UUID
    entry_id: UUID
    state: Literal["written", "session_changed", "storage_error"]
    elapsed_ms: float = Field(ge=0, le=600000, allow_inf_nan=False)


def configure_comparison_http(app, service):
    router = APIRouter(prefix="/api/v1/agent/comparisons")
    auth = Annotated[str | None, Header(alias="Authorization")]
    key = Annotated[str | None, Header(alias="Idempotency-Key")]

    def check(request):
        if request.query_params:
            raise ContextError("INVALID_REQUEST", 400)
        if service is None:
            raise ContextError("COMPARISON_NOT_CONFIGURED", 503)

    @router.post("", status_code=202)
    async def create(
        body: CreateComparison,
        request: Request,
        authorization: auth = None,
        idempotency_key: key = None,
    ):
        check(request)
        return envelope(
            request,
            await run_in_threadpool(
                service.create,
                bearer(authorization),
                body.snapshot_id,
                body.prompt,
                idempotency_key,
                body.cache_state,
                body.model,
            ),
        )

    @router.get("")
    async def list_pairs(request: Request, authorization: auth = None):
        check(request)
        return envelope(request, await run_in_threadpool(service.list, bearer(authorization)))

    @router.get("/{pair_id}")
    async def get(pair_id: UUID, request: Request, authorization: auth = None):
        check(request)
        return envelope(
            request, await run_in_threadpool(service.get, bearer(authorization), pair_id)
        )

    @router.post("/{pair_id}/cache-io")
    async def cache_io(
        pair_id: UUID, body: CacheIoReport, request: Request, authorization: auth = None
    ):
        check(request)
        return envelope(
            request,
            await run_in_threadpool(
                service.record_cache_io,
                bearer(authorization),
                pair_id,
                body.model_dump(mode="json"),
            ),
        )

    @router.post("/{pair_id}/{mode}", status_code=202)
    async def start(
        pair_id: UUID,
        mode: Literal["none", "local"],
        body: StartBranch,
        request: Request,
        authorization: auth = None,
    ):
        check(request)
        return envelope(
            request,
            await run_in_threadpool(
                service.start,
                bearer(authorization),
                pair_id,
                mode,
                body.lookup_report.model_dump(mode="json"),
            ),
        )

    @router.post("/{pair_id}/{mode}/cancel")
    async def cancel(
        pair_id: UUID, mode: Literal["none", "local"], request: Request, authorization: auth = None
    ):
        check(request)
        if await request.body() not in (b"", b"null"):
            raise ContextError("INVALID_REQUEST", 400)
        return envelope(
            request, await run_in_threadpool(service.cancel, bearer(authorization), pair_id, mode)
        )

    app.include_router(router)
