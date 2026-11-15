"""Fixed browser commands and an independently authenticated host-worker channel."""

import hmac
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field

from app.change_workflow.workflow_repository import WorkflowError
from app.control.api.repository_routes import bearer, envelope


class RevisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    proposal_id: UUID
    revision: int = Field(strict=True, ge=1)
    artifact_digest: str = Field(strict=True, pattern=r"^sha256:[0-9a-f]{64}$")


class ApprovalRequest(RevisionRequest):
    job_id: UUID


class SourceRequest(RevisionRequest):
    expected_snapshot_id: UUID


class ActivationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    approval_id: UUID
    expected_version: int = Field(strict=True, ge=0)


class WorkerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    worker_id: UUID
    ticket: UUID | None = None
    result: dict | None = None


def configure_workspace_http(app, operations, runtime, worker, credential):
    router = APIRouter(prefix="/api/v1/changes/workspace")
    auth = Annotated[str | None, Header(alias="Authorization")]
    key = Annotated[str | None, Header(alias="Idempotency-Key")]

    def services(authorization):
        token = bearer(authorization)
        if operations is None:
            raise WorkflowError("WORKSPACE_NOT_CONFIGURED", 503)
        return token

    @router.get("/config")
    async def config(request: Request, authorization: auth = None):
        token = services(authorization)
        return envelope(request, await run_in_threadpool(runtime.config, token))

    @router.get("/operations/{identifier}")
    async def get(identifier: UUID, request: Request, authorization: auth = None):
        token = services(authorization)
        return envelope(request, await run_in_threadpool(operations.get, token, identifier))

    @router.post("/source", status_code=202)
    async def save(
        body: SourceRequest,
        request: Request,
        authorization: auth = None,
        idempotency_key: key = None,
    ):
        token = services(authorization)
        return envelope(
            request,
            await run_in_threadpool(
                operations.save,
                token,
                body.proposal_id,
                body.revision,
                body.artifact_digest,
                body.expected_snapshot_id,
                idempotency_key,
            ),
        )

    @router.post("/approvals", status_code=201)
    async def approve(
        body: ApprovalRequest,
        request: Request,
        authorization: auth = None,
        idempotency_key: key = None,
    ):
        token = services(authorization)
        return envelope(
            request,
            await run_in_threadpool(
                runtime.approve,
                token,
                body.proposal_id,
                body.revision,
                body.artifact_digest,
                body.job_id,
                idempotency_key,
            ),
        )

    @router.post("/activations", status_code=202)
    async def activate(
        body: ActivationRequest,
        request: Request,
        authorization: auth = None,
        idempotency_key: key = None,
    ):
        token = services(authorization)
        return envelope(
            request,
            await run_in_threadpool(
                runtime.activate, token, body.approval_id, body.expected_version, idempotency_key
            ),
        )

    app.include_router(router)
    internal = APIRouter(prefix="/_internal/workspace-worker", include_in_schema=False)
    worker_key = Annotated[str | None, Header(alias="X-Control-Worker-Key")]

    def trusted(value):
        if (
            credential is None
            or not isinstance(value, str)
            or not value.isascii()
            or not hmac.compare_digest(value, credential.get_secret_value())
        ):
            raise WorkflowError("WORKER_IDENTITY_REQUIRED", 401)
        if worker is None:
            raise WorkflowError("WORKSPACE_NOT_CONFIGURED", 503)
        return worker

    @internal.post("/claim")
    async def claim(body: WorkerRequest, request: Request, credential: worker_key = None):
        return envelope(request, await run_in_threadpool(trusted(credential).claim, body.worker_id))

    @internal.post("/owned")
    async def owned(body: WorkerRequest, request: Request, credential: worker_key = None):
        return envelope(
            request, {"items": await run_in_threadpool(trusted(credential).owned, body.worker_id)}
        )

    @internal.post("/{identifier}/{action}")
    async def operation(
        identifier: UUID,
        action: str,
        body: WorkerRequest,
        request: Request,
        credential: worker_key = None,
    ):
        svc = trusted(credential)
        if action not in {"bundle", "permit", "result"} or body.ticket is None:
            raise WorkflowError("INVALID_REQUEST", 400)
        method = {"bundle": svc.bundle, "permit": svc.permit, "result": svc.report}[action]
        args = [identifier, body.worker_id, body.ticket]
        if action == "result":
            if body.result is None:
                raise WorkflowError("INVALID_REQUEST", 400)
            args.append(body.result)
        return envelope(request, await run_in_threadpool(method, *args))

    app.include_router(internal)
