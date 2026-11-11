"""HTTP error mapping for repository reads, independent of quotation transport."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.artifacts.blob_models import (
    BlobBytesUnavailable,
    BlobIntegrityError,
    BlobMetadataUnavailable,
    BlobStorageNotConfigured,
    BlobTooLarge,
)
from app.control.api.repository_request_middleware import RepositoryRequestMiddleware
from app.control.api.repository_routes import InvalidRepositoryRequest, create_repository_router
from app.identity.control_authority import (
    ControlAccessDenied,
    ControlAuthorityUnavailable,
    ControlIdentityRequired,
    ControlResourceUnavailable,
    RepositoryAccessService,
)
from app.repositories.repository_snapshots import RepositorySnapshotService
from app.repositories.snapshot_models import (
    SnapshotIntegrityError,
    SnapshotStorageUnavailable,
    SourceChanged,
    SourceLimitExceeded,
    SourceUnavailable,
)


def configure_repository_http(
    app: FastAPI,
    access: RepositoryAccessService,
    snapshots: RepositorySnapshotService | None,
) -> None:
    app.add_middleware(RepositoryRequestMiddleware)
    cases = {
        ControlIdentityRequired: (401, "IDENTITY_REQUIRED"),
        ControlAccessDenied: (403, "ACCESS_DENIED"),
        ControlResourceUnavailable: (404, "RESOURCE_UNAVAILABLE"),
        ControlAuthorityUnavailable: (503, "AUTHORITY_UNAVAILABLE"),
        BlobStorageNotConfigured: (503, "SOURCE_NOT_CONFIGURED"),
        SourceUnavailable: (503, "SOURCE_UNAVAILABLE"),
        SourceChanged: (409, "SOURCE_CHANGED"),
        SourceLimitExceeded: (413, "SOURCE_LIMIT_EXCEEDED"),
        BlobTooLarge: (413, "SOURCE_LIMIT_EXCEEDED"),
        SnapshotStorageUnavailable: (503, "STORAGE_UNAVAILABLE"),
        BlobBytesUnavailable: (503, "STORAGE_UNAVAILABLE"),
        BlobMetadataUnavailable: (503, "STORAGE_UNAVAILABLE"),
        SnapshotIntegrityError: (503, "INTEGRITY_UNVERIFIED"),
        BlobIntegrityError: (503, "INTEGRITY_UNVERIFIED"),
        InvalidRepositoryRequest: (400, "INVALID_REQUEST"),
        RequestValidationError: (400, "INVALID_REQUEST"),
    }

    def handler(status: int, code: str):
        async def respond(request: Request, error: Exception):
            return JSONResponse(
                status_code=status,
                headers=({"WWW-Authenticate": "Bearer"} if status == 401 else {}),
                content={
                    "error": {
                        "code": code,
                        "message": "Repository request could not be completed.",
                    },
                    "meta": {
                        "contract_version": "v0.2",
                        "identity_mode": "fixture",
                        "request_id": request.state.request_id,
                    },
                },
            )

        return respond

    for error, (status, code) in cases.items():
        app.add_exception_handler(error, handler(status, code))
    app.include_router(create_repository_router(access, snapshots))
