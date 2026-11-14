"""Authenticated, bounded assistance endpoints; no commands, provider URL or roles from clients."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Header, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.agent_assistance.generation import AgentError
from app.control.api.repository_routes import bearer, envelope


class HistoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=16000)


class AssistanceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    snapshot_id: UUID
    prompt: str = Field(min_length=1, max_length=4000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=12)

    @model_validator(mode="after")
    def bounded_history(self):
        if (
            not self.prompt.strip()
            or sum(len(m.content.encode("utf-8")) for m in self.history) > 24000
        ):
            raise ValueError("Invalid assistance request.")
        return self


def configure_assistance_http(app, service, runs=None):
    async def error(request, exc: AgentError):
        return JSONResponse(
            status_code=exc.status,
            content={
                "error": {"code": exc.code, "message": "Agent request could not be completed."},
                "meta": {
                    "contract_version": "v0.2",
                    "identity_mode": "fixture",
                    "request_id": request.state.request_id,
                },
            },
        )

    app.add_exception_handler(AgentError, error)
    router = APIRouter(prefix="/api/v1/agent")
    credential = Annotated[str | None, Header(alias="Authorization")]

    @router.get("/config")
    async def config(request: Request, authorization: credential = None):
        token = bearer(authorization)
        data = await run_in_threadpool(service.config, token)
        if runs is not None:
            data["automation"] = await run_in_threadpool(runs.config, token)
        return envelope(request, data)

    @router.post("/messages")
    async def message(body: AssistanceRequest, request: Request, authorization: credential = None):
        if request.query_params:
            raise AgentError("INVALID_REQUEST", 400)
        data = await run_in_threadpool(
            service.ask,
            bearer(authorization),
            body.snapshot_id,
            body.prompt,
            [m.model_dump() for m in body.history],
        )
        return envelope(request, data)

    app.include_router(router)
