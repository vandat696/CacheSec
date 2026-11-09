from dataclasses import dataclass
from uuid import UUID

from app.quotation_demo.business.quotation_models import QuotationRecord


@dataclass(frozen=True)
class QuotationFlag:
    code: str
    field: str
    message: str


@dataclass(frozen=True)
class QuotationValidation:
    quotation_id: UUID
    flags: tuple[QuotationFlag, ...]
    evaluated_rules: tuple[str, ...]
    validation_config_ref: str
    reference_date: None = None
    active_artifact: None = None


def validate_quotation(quotation: QuotationRecord) -> QuotationValidation:
    """Evaluate the original application's business rules, independently of delivery/storage.

    This baseline intentionally has no business rules after input-contract validation.
    Empty flags and evaluated_rules do not establish date validity or approval. The
    experiment's expiration rule belongs in a later code change at this entry point.
    """
    return QuotationValidation(
        quotation_id=quotation.id,
        flags=(),
        evaluated_rules=(),
        validation_config_ref="quotation-baseline-v1",
    )
