"""Local technical rule regression; not a frozen research fixture or acceptance threshold."""

from datetime import date
from uuid import uuid4

import pytest

from app.quotation_demo.business.quotation_models import QuotationRecord
from app.quotation_demo.business.quotation_validation import validate_quotation

REFERENCE = date(2026, 11, 7)


def quotation(**fields):
    return QuotationRecord(
        id=uuid4(), supplier_name="", description="", total_amount="-1.00", currency="", **fields
    )


@pytest.mark.parametrize(
    "fields, flagged",
    [
        ({}, True),
        ({"expires_on": None}, True),
        ({"expires_on": ""}, True),
        ({"expires_on": "2026-11-06"}, True),
        ({"expires_on": "2026-11-07"}, False),
        ({"expires_on": "2026-11-08"}, False),
        ({"expires_on": "2026-02-30"}, True),
        ({"expires_on": "2027-02-29"}, True),
        ({"expires_on": "2028-02-29"}, False),
        ({"expires_on": "2026-1-7"}, True),
        ({"expires_on": "20261107"}, True),
        ({"expires_on": "2026-W46-1"}, True),
        ({"expires_on": "2028-W09-2"}, True),
        ({"expires_on": " 2026-11-07"}, True),
        ({"expires_on": "2026-11-07\n"}, True),
        ({"expires_on": "2026-11-07T00:00:00Z"}, True),
        ({"expires_on": "２０２６-１１-０７"}, True),
        ({"expires_on": 20261107}, True),
        ({"expires_on": False}, True),
        ({"expires_on": []}, True),
        ({"expires_on": {}}, True),
    ],
)
def test_expiration_review_uses_strict_dates_and_preserves_raw_input(fields, flagged):
    record = quotation(**fields)
    original = record.model_dump(exclude_unset=True)
    result = validate_quotation(record, reference_date=REFERENCE)
    assert result.quotation_id == record.id
    assert [(flag.code, flag.field) for flag in result.flags] == (
        [("expiration_review", "expires_on")] if flagged else []
    )
    assert result.evaluated_rules == ("expiration_review",)
    assert result.validation_config_ref == "quotation-expiration-v1"
    assert result.reference_date == REFERENCE
    assert result.active_artifact is None
    assert record.model_dump(exclude_unset=True) == original


def test_reference_date_is_required_without_falling_back_to_system_time():
    with pytest.raises(ValueError, match="[Rr]eference date"):
        validate_quotation(quotation(expires_on="2026-11-07"))


def test_backend_reference_date_controls_the_boundary_instead_of_a_hardcoded_day():
    record = quotation(expires_on="2026-11-07")
    assert not validate_quotation(record, reference_date=date(2026, 11, 6)).flags
    assert validate_quotation(record, reference_date=date(2026, 11, 8)).flags
