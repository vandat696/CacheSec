from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.quotation_demo.application.quotation_access import (
    QuotationAccessDenied,
    QuotationAuthorityUnavailable,
    QuotationIdentityRequired,
)
from app.quotation_demo.application.quotation_repository import (
    QuotationIdempotencyConflict,
    QuotationPersistenceError,
)
from app.quotation_demo.application.quotation_service import (
    InvalidIdempotencyKey,
    InvalidQuotationPage,
    QuotationNotFound,
)
from app.quotation_demo.http.contracts import CONTRACT_VERSION
from app.quotation_demo.http.request_context import QuotationRequestContext
from app.quotation_demo.http.router import create_quotation_router
from app.quotation_demo.http.service_provider import QuotationServiceProvider


def create_quotation_app(provider: QuotationServiceProvider, *, max_body_bytes: int) -> FastAPI:
    """Requires an explicit trusted provider; no allow-all/default fixture identity."""
    app = FastAPI(
        title="Quotation API",
        version=CONTRACT_VERSION,
        description="Local PoC with backend-controlled fixture identities; not production login.",
    )
    app.add_middleware(QuotationRequestContext, max_body_bytes=max_body_bytes)

    cases = {
        QuotationIdentityRequired: (401, "IDENTITY_REQUIRED", "Valid identity is required."),
        QuotationAccessDenied: (403, "ACCESS_DENIED", "Access is denied."),
        QuotationAuthorityUnavailable: (503, "AUTHORITY_UNAVAILABLE", "Authority is unavailable."),
        QuotationNotFound: (404, "QUOTATION_NOT_FOUND", "Quotation was not found."),
        InvalidQuotationPage: (400, "INVALID_REQUEST", "Invalid page parameters."),
        InvalidIdempotencyKey: (400, "INVALID_REQUEST", "Invalid idempotency key."),
        QuotationIdempotencyConflict: (
            409,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key was used with another request.",
        ),
        RequestValidationError: (400, "INVALID_REQUEST", "Request does not match the contract."),
        QuotationPersistenceError: (
            503,
            "STORAGE_UNAVAILABLE",
            "Quotation storage is unavailable.",
        ),
    }

    def error_handler(status: int, code: str, message: str):
        async def handle(request: Request, _error: Exception) -> JSONResponse:
            return JSONResponse(
                status_code=status,
                headers={
                    "X-Request-ID": request.state.request_id,
                    "Cache-Control": "no-store",
                    **({"WWW-Authenticate": "Bearer"} if status == 401 else {}),
                },
                content={
                    "error": {"code": code, "message": message},
                    "meta": {
                        "contract_version": CONTRACT_VERSION,
                        "request_id": request.state.request_id,
                        "identity_mode": "fixture",
                    },
                },
            )

        return handle

    for error_type, (status, code, message) in cases.items():
        app.add_exception_handler(error_type, error_handler(status, code, message))
    app.add_exception_handler(
        Exception, error_handler(500, "INTERNAL_ERROR", "Internal server error.")
    )
    app.include_router(create_quotation_router(provider))
    return app
