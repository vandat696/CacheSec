from dataclasses import dataclass
from datetime import date
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
    reference_date: date | None = None
    active_artifact: None = None


def validate_quotation(
    quotation: QuotationRecord, *, reference_date: date | None = None
) -> QuotationValidation:
    if reference_date is None:
        raise ValueError("Reference date is required for expiration review.")

    flags = []
    expires_on = quotation.expires_on

    is_valid_date = False
    if isinstance(expires_on, str) and expires_on.isascii() and len(expires_on) == 10:
        parts = expires_on.split("-")
        if len(parts) == 3 and len(parts[0]) == 4 and len(parts[1]) == 2 and len(parts[2]) == 2:
            try:
                parsed_date = date.fromisoformat(expires_on)
                if parsed_date >= reference_date:
                    is_valid_date = True
            except ValueError:
                pass

    if not is_valid_date:
        flags.append(
            QuotationFlag(
                code="expiration_review",
                field="expires_on",
                message=(
                    "Quotation expiration date must be a valid ISO date "
                    "on or after the reference date."
                ),
            )
        )

    return QuotationValidation(
        quotation_id=quotation.id,
        flags=tuple(flags),
        evaluated_rules=("expiration_review",),
        validation_config_ref="quotation-expiration-v1",
        reference_date=reference_date,
    )
