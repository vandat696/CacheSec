from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.quotation_demo.application.quotation_access import QuotationIdentityRequired
from app.quotation_demo.application.quotation_service import QuotationService
from app.quotation_demo.domain.quotation import QuotationCreate, QuotationRecord
from app.quotation_demo.http.contracts import (
    CONTRACT_VERSION,
    ApiMeta,
    ApiResponse,
    QuotationList,
)
from app.quotation_demo.http.service_provider import QuotationServiceProvider


def create_quotation_router(provider: QuotationServiceProvider) -> APIRouter:
    router = APIRouter(prefix="/api/v1/quotations", tags=["quotations"])
    bearer = HTTPBearer(auto_error=False)

    def service_for_request(
        request: Request,
        credential: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)],
    ) -> QuotationService:
        if len(request.headers.getlist("authorization")) != 1:
            raise QuotationIdentityRequired()
        return provider.for_credential(credential.credentials if credential else None)

    def metadata(request: Request) -> ApiMeta:
        return ApiMeta(
            contract_version=CONTRACT_VERSION,
            request_id=request.state.request_id,
            identity_mode="fixture",
        )

    @router.post("", status_code=201, response_model_exclude_unset=True)
    def create_quotation(
        data: QuotationCreate,
        request: Request,
        service: Annotated[QuotationService, Depends(service_for_request)],
        idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
    ) -> ApiResponse[QuotationRecord]:
        return ApiResponse(
            data=service.create(data, idempotency_key=idempotency_key), meta=metadata(request)
        )

    @router.get("", response_model_exclude_unset=True)
    def list_quotations(
        request: Request,
        service: Annotated[QuotationService, Depends(service_for_request)],
        limit: int | None = None,
        after: UUID | None = None,
    ) -> ApiResponse[QuotationList]:
        page = service.list(limit=limit, after=after)
        return ApiResponse(
            data=QuotationList(items=page.items, next_cursor=page.next_cursor),
            meta=metadata(request),
        )

    @router.get("/{quotation_id}", response_model_exclude_unset=True)
    def get_quotation(
        quotation_id: UUID,
        request: Request,
        service: Annotated[QuotationService, Depends(service_for_request)],
    ) -> ApiResponse[QuotationRecord]:
        return ApiResponse(data=service.get(quotation_id), meta=metadata(request))

    return router
