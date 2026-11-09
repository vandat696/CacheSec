from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel

from app.quotation_demo.business.quotation_models import QuotationRecord

Payload = TypeVar("Payload")
CONTRACT_VERSION = "v0.2"


class ApiMeta(BaseModel):
    contract_version: str
    request_id: str
    identity_mode: str


class ApiResponse(BaseModel, Generic[Payload]):
    data: Payload
    meta: ApiMeta


class QuotationList(BaseModel):
    items: tuple[QuotationRecord, ...]
    next_cursor: UUID | None
