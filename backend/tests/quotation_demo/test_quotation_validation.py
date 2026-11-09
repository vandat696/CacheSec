from uuid import uuid4

import pytest

from app.quotation_demo.business.quotation_models import QuotationRecord
from app.quotation_demo.business.quotation_validation import validate_quotation


@pytest.mark.baseline_only
def test_original_validator_preserves_raw_dates_and_does_not_apply_the_experiment_rule():
    # Baseline regression inputs, not the labeled/frozen research fixture.
    for expiration in (
        {},
        {"expires_on": None},
        {"expires_on": ""},
        {"expires_on": "2026-02-30"},
        {"expires_on": "2026-11-06"},
        {"expires_on": "2026-11-07"},
        {"expires_on": "2026-11-08"},
        {"expires_on": False},
        {"expires_on": {"raw": [1, None]}},
    ):
        record = QuotationRecord(
            id=uuid4(),
            supplier_name="",
            description="",
            total_amount="-1.00",
            currency="",
            **expiration,
        )
        before = record.model_dump(exclude_unset=True)
        result = validate_quotation(record)
        assert result.quotation_id == record.id
        assert result.flags == ()
        assert result.evaluated_rules == ()
        assert result.reference_date is None
        assert result.active_artifact is None
        assert record.model_dump(exclude_unset=True) == before
