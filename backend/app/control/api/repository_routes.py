"""Read-only source transport. Every service call rechecks current authority."""

from base64 import b64encode
from typing import Annotated, Generic, Literal, TypeVar
from uuid import UUID

from fastapi import APIRouter, Header, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.artifacts.blob_models import BlobStorageNotConfigured
from app.identity.control_authority import ControlIdentityRequired, RepositoryAccessService
from app.repositories.repository_snapshots import RepositorySnapshotService
from app.repositories.snapshot_models import RepositorySnapshot


class InvalidRepositoryRequest(Exception):
    pass


class RepositoryResponse(BaseModel):
    tenant_id: UUID
    repo_id: UUID
    repository_identity: str
    authority_epoch: int


class ResponseMeta(BaseModel):
    contract_version: Literal["v0.2"]
    identity_mode: Literal["fixture"]
    request_id: UUID


Data = TypeVar("Data")


class RepositoryEnvelope(BaseModel, Generic[Data]):
    data: Data
    meta: ResponseMeta


class FileResponse(BaseModel):
    file_id: UUID
    path: str
    digest: str
    byte_size: int


class SnapshotResponse(BaseModel):
    snapshot_id: UUID
    repository_identity: str
    source_profile_digest: str
    manifest_digest: str
    files: list[FileResponse]


class FileContentResponse(BaseModel):
    snapshot_id: UUID
    file_id: UUID
    encoding: Literal["base64"]
    content: str


def snapshot_data(snapshot: RepositorySnapshot) -> dict:
    return SnapshotResponse(
        snapshot_id=snapshot.snapshot_id,
        repository_identity=snapshot.repository_identity,
        source_profile_digest=snapshot.profile_blob.digest,
        manifest_digest=snapshot.manifest_blob.digest,
        files=[
            FileResponse(
                file_id=item.file_id,
                path=item.path,
                digest=item.blob.digest,
                byte_size=item.blob.byte_size,
            )
            for item in snapshot.files
        ],
    ).model_dump(mode="json")


def envelope(request: Request, data: dict) -> dict:
    return {
        "data": data,
        "meta": {
            "contract_version": "v0.2",
            "identity_mode": "fixture",
            "request_id": request.state.request_id,
        },
    }


def bearer(authorization: str | None) -> str:
    if authorization is None:
        raise ControlIdentityRequired()
    scheme, separator, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not separator or not token or " " in token:
        raise ControlIdentityRequired()
    return token


def create_repository_router(
    access: RepositoryAccessService,
    snapshots: RepositorySnapshotService | None,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/repository")
    credential = Annotated[str | None, Header(alias="Authorization")]

    def source() -> RepositorySnapshotService:
        if snapshots is None:
            raise BlobStorageNotConfigured()
        return snapshots

    async def empty_request(request: Request) -> None:
        # No client paths, scope, policy, role or digests, even as ignored query fields.
        if request.query_params or await request.body():
            raise InvalidRepositoryRequest()

    @router.get("", response_model=RepositoryEnvelope[RepositoryResponse])
    async def describe(request: Request, authorization: credential = None):
        await empty_request(request)
        repository = await run_in_threadpool(access.describe_current, bearer(authorization))
        return envelope(
            request,
            {
                "tenant_id": str(repository.scope.tenant_id),
                "repo_id": str(repository.scope.repo_id),
                "repository_identity": repository.identity,
                "authority_epoch": repository.authority_epoch,
            },
        )

    @router.post("/snapshots", status_code=201, response_model=RepositoryEnvelope[SnapshotResponse])
    async def capture(request: Request, authorization: credential = None):
        await empty_request(request)
        token = bearer(authorization)
        repository = await run_in_threadpool(access.describe_current, token)
        snapshot = await run_in_threadpool(source().capture, token, repository.scope)
        return envelope(request, snapshot_data(snapshot))

    @router.get("/snapshots/{snapshot_id}", response_model=RepositoryEnvelope[SnapshotResponse])
    async def get(snapshot_id: UUID, request: Request, authorization: credential = None):
        await empty_request(request)
        token = bearer(authorization)
        repository = await run_in_threadpool(access.describe_current, token)
        snapshot = await run_in_threadpool(source().get, token, repository.scope, snapshot_id)
        return envelope(request, snapshot_data(snapshot))

    @router.get(
        "/snapshots/{snapshot_id}/files/{file_id}",
        response_model=RepositoryEnvelope[FileContentResponse],
    )
    async def read_file(
        snapshot_id: UUID,
        file_id: UUID,
        request: Request,
        authorization: credential = None,
    ):
        await empty_request(request)
        token = bearer(authorization)
        repository = await run_in_threadpool(access.describe_current, token)
        content = await run_in_threadpool(
            source().read_file,
            token,
            repository.scope,
            snapshot_id,
            file_id,
        )
        return envelope(
            request,
            {
                "snapshot_id": str(snapshot_id),
                "file_id": str(file_id),
                "encoding": "base64",
                "content": b64encode(content).decode("ascii"),
            },
        )

    return router
