"""Harness regression: accepted ISO week dates must not satisfy the YYYY-MM-DD contract."""

from uuid import uuid4

import pytest

from app.testing.expiration_checks import CASES, STRICT_FORMAT_INPUTS, run_expiration_checks


@pytest.mark.parametrize("accept_week_date", [False, True])
def test_strict_format_group_covers_each_variant_without_losing_earlier_failures(accept_week_date):
    records, results = {}, []

    def request(method, path, token, body=None, key=None):
        assert method == "POST" and token == "test-only-operator"
        if path == "":
            identifier = str(uuid4())
            records[identifier] = body
            return 201, {"data": {"id": identifier}}
        identifier = path.split("/")[1]
        # Deliberate response double; this test checks harness aggregation, not a second validator.
        is_week = records[identifier].get("expires_on") == "2026-W46-1"
        flags = (
            []
            if accept_week_date and is_week
            else [{"code": "expiration_review", "field": "expires_on"}]
        )
        return 200, {
            "data": {
                "quotation_id": identifier,
                "reference_date": "2026-11-07",
                "evaluated_rules": ["expiration_review"],
                "flags": flags,
            }
        }

    run_expiration_checks(
        request, "test-only-operator", lambda name, passed: results.append((name, passed))
    )
    assert [name for name, _ in results] == [case[0] for case in CASES]
    assert dict(results)["expiration_strict_format"] is not accept_week_date
    observed = [
        body["expires_on"]
        for body in records.values()
        if body["description"] == "expiration_strict_format"
    ]
    assert observed == list(STRICT_FORMAT_INPUTS)
