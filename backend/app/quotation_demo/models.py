from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, JsonValue, StringConstraints

DecimalString = Annotated[str, StringConstraints(pattern=r"^[+-]?[0-9]+(\.[0-9]+)?$")]


class QuotationCreate(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", frozen=True, allow_inf_nan=False)

    supplier_name: str
    description: str
    total_amount: DecimalString
    currency: str
    expires_on: JsonValue = None

    @property
    def expires_on_is_present(self) -> bool:
        return "expires_on" in self.model_fields_set


class QuotationRecord(QuotationCreate):
    id: UUID


@dataclass(frozen=True)
class QuotationPage:
    items: tuple[QuotationRecord, ...]
    next_cursor: UUID | None
