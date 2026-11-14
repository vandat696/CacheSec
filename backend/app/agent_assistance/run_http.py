"""Human-started, explicitly scoped automation; status/cancel never accept tool commands."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Header, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.agent_assistance.generation import AgentError
from app.control.api.repository_routes import bearer, envelope


class StartAgentRun(BaseModel):
    model_config = ConfigDict(extra="forbid")
    snapshot_id: UUID
    prompt: str = Field(min_length=1, max_length=4000)
    provider_consent: Literal[True]

    @field_validator("provider_consent", mode="before")
    @classmethod
    def explicit_consent(cls, value):
        if value is not True:
            raise ValueError("Explicit source-sharing consent is required.")
        return value


def configure_run_http(app, service):
    router = APIRouter(prefix="/api/v1/agent/runs")
    auth = Annotated[str | None, Header(alias="Authorization")]
    key = Annotated[str | None, Header(alias="Idempotency-Key")]

    def check(request):
        if request.query_params:
            raise AgentError("INVALID_REQUEST", 400)

    @router.post("", status_code=202)
    async def start(
        body: StartAgentRun,
        request: Request,
        authorization: auth = None,
        idempotency_key: key = None,
    ):
        check(request)
        return envelope(
            request,
            await run_in_threadpool(
                service.start, bearer(authorization), body.snapshot_id, body.prompt, idempotency_key
            ),
        )

    @router.get("/{run_id}")
    async def get(run_id: UUID, request: Request, authorization: auth = None):
        check(request)
        if await request.body():
            raise AgentError("INVALID_REQUEST", 400)
        return envelope(
            request, await run_in_threadpool(service.get, bearer(authorization), run_id)
        )

    @router.post("/{run_id}/cancel")
    async def cancel(run_id: UUID, request: Request, authorization: auth = None):
        check(request)
        if await request.body() not in (b"", b"null"):
            raise AgentError("INVALID_REQUEST", 400)
        return envelope(
            request, await run_in_threadpool(service.cancel, bearer(authorization), run_id)
        )

    app.include_router(router)
