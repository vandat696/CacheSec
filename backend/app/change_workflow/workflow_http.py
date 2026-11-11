"""Bounded browser mutation transport and a separate authenticated worker channel."""

import hmac
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, FastAPI, Header, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import SecretStr

from app.change_workflow.proposal_service import ProposalService
from app.change_workflow.test_job_service import TestJobService
from app.change_workflow.workflow_repository import WorkflowError, WorkflowStorageUnavailable
from app.change_workflow.workflow_request_middleware import WorkflowRequestMiddleware
from app.change_workflow.workflow_requests import (
    CreateProposal,
    SaveRevision,
    TestRequest,
    WorkerClaim,
    WorkerRequest,
    WorkerResult,
)
from app.control.api.repository_routes import bearer, envelope


def configure_workflow_http(
    app: FastAPI,
    proposals: ProposalService | None,
    jobs: TestJobService | None,
    worker_key: SecretStr | None,
):
    app.add_middleware(WorkflowRequestMiddleware)

    async def error(request: Request, exc: WorkflowError):
        return JSONResponse(
            status_code=exc.status,
            headers={"WWW-Authenticate": "Bearer"} if exc.status == 401 else {},
            content={
                "error": {"code": exc.code, "message": "Workflow request could not be completed."},
                "meta": {
                    "contract_version": "v0.2",
                    "identity_mode": "fixture",
                    "request_id": request.state.request_id,
                },
            },
        )

    async def unavailable(request, exc):
        return await error(request, WorkflowError("STORAGE_UNAVAILABLE", 503))

    app.add_exception_handler(WorkflowError, error)
    app.add_exception_handler(WorkflowStorageUnavailable, unavailable)
    router = APIRouter(prefix="/api/v1/changes")
    auth = Annotated[str | None, Header(alias="Authorization")]
    key = Annotated[str | None, Header(alias="Idempotency-Key")]

    def service(authorization):
        token = bearer(authorization)
        if proposals is None:
            raise WorkflowError("WORKFLOW_NOT_CONFIGURED", 503)
        return proposals, token

    @router.get("/config")
    async def config(request: Request, authorization: auth = None):
        svc, token = service(authorization)
        return envelope(request, await run_in_threadpool(svc.config, token))

    @router.post("/proposals", status_code=201)
    async def create(
        body: CreateProposal,
        request: Request,
        authorization: auth = None,
        idempotency_key: key = None,
    ):
        svc, token = service(authorization)
        return envelope(
            request,
            await run_in_threadpool(
                svc.save, token, body.base_snapshot_id, body.content, idempotency_key
            ),
        )

    @router.post("/proposals/{proposal_id}/revisions", status_code=201)
    async def save(
        proposal_id: UUID,
        body: SaveRevision,
        request: Request,
        authorization: auth = None,
        idempotency_key: key = None,
    ):
        svc, token = service(authorization)
        return envelope(
            request,
            await run_in_threadpool(
                svc.save,
                token,
                None,
                body.content,
                idempotency_key,
                proposal_id,
                body.expected_revision,
            ),
        )

    @router.get("/proposals/{proposal_id}")
    async def get(proposal_id: UUID, request: Request, authorization: auth = None):
        svc, token = service(authorization)
        return envelope(request, await run_in_threadpool(svc.get, token, proposal_id))

    @router.post("/proposals/{proposal_id}/tests", status_code=202)
    async def test(
        proposal_id: UUID,
        body: TestRequest,
        request: Request,
        authorization: auth = None,
        idempotency_key: key = None,
    ):
        svc, token = service(authorization)
        return envelope(
            request,
            await run_in_threadpool(
                svc.request_test, token, proposal_id, body.revision, idempotency_key
            ),
        )

    @router.get("/tests/{job_id}")
    async def job(job_id: UUID, request: Request, authorization: auth = None):
        svc, token = service(authorization)
        return envelope(request, await run_in_threadpool(svc.job, token, job_id))

    app.include_router(router)
    internal = APIRouter(prefix="/_internal/test-worker", include_in_schema=False)
    worker_auth = Annotated[str | None, Header(alias="X-Control-Worker-Key")]

    def worker(credential):
        if (
            worker_key is None
            or type(credential) is not str
            or not credential.isascii()
            or not hmac.compare_digest(credential, worker_key.get_secret_value())
        ):
            raise WorkflowError("WORKER_IDENTITY_REQUIRED", 401)
        if jobs is None:
            raise WorkflowError("WORKFLOW_NOT_CONFIGURED", 503)
        return jobs

    @internal.post("/claim")
    async def claim(body: WorkerRequest, request: Request, credential: worker_auth = None):
        return envelope(request, await run_in_threadpool(worker(credential).claim, body.worker_id))

    @internal.post("/owned")
    async def owned(body: WorkerRequest, request: Request, credential: worker_auth = None):
        return envelope(
            request, {"items": await run_in_threadpool(worker(credential).owned, body.worker_id)}
        )

    @internal.post("/{job_id}/bundle")
    async def bundle(
        job_id: UUID, body: WorkerClaim, request: Request, credential: worker_auth = None
    ):
        return envelope(
            request,
            await run_in_threadpool(worker(credential).bundle, job_id, body.worker_id, body.ticket),
        )

    @internal.post("/{job_id}/permit")
    async def permit(
        job_id: UUID, body: WorkerClaim, request: Request, credential: worker_auth = None
    ):
        return envelope(
            request,
            await run_in_threadpool(worker(credential).permit, job_id, body.worker_id, body.ticket),
        )

    @internal.post("/{job_id}/result")
    async def result(
        job_id: UUID, body: WorkerResult, request: Request, credential: worker_auth = None
    ):
        return envelope(
            request,
            await run_in_threadpool(
                worker(credential).report, job_id, body.worker_id, body.ticket, body.result
            ),
        )

    app.include_router(internal)
