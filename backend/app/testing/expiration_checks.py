"""Local task checks, with explicit expected labels; not a frozen research fixture."""

CASES = (
    ("expiration_missing", {}, True),
    ("expiration_null", {"expires_on": None}, True),
    ("expiration_empty", {"expires_on": ""}, True),
    ("expiration_past", {"expires_on": "2026-11-06"}, True),
    ("expiration_equal", {"expires_on": "2026-11-07"}, False),
    ("expiration_future", {"expires_on": "2026-11-08"}, False),
    ("expiration_invalid_calendar", {"expires_on": "2026-02-30"}, True),
    ("expiration_invalid_leap", {"expires_on": "2027-02-29"}, True),
    ("expiration_valid_leap", {"expires_on": "2028-02-29"}, False),
    ("expiration_strict_format", {"expires_on": "2026-1-7"}, True),
    ("expiration_whitespace", {"expires_on": " 2026-11-07"}, True),
    ("expiration_timestamp", {"expires_on": "2026-11-07T00:00:00Z"}, True),
    ("expiration_number", {"expires_on": 20261107}, True),
    ("expiration_boolean", {"expires_on": False}, True),
    ("expiration_array", {"expires_on": []}, True),
    ("expiration_object", {"expires_on": {}}, True),
)


def run_expiration_checks(request, operator, check):
    from uuid import uuid4

    for name, fields, flagged in CASES:
        body = {
            "supplier_name": "Synthetic task check",
            "description": name,
            "total_amount": "123.4500",
            "currency": "VND",
            **fields,
        }
        status, created = request("POST", "", operator, body, str(uuid4()))
        if status != 201:
            check(name, False)
            continue
        identifier = created["data"]["id"]
        status, response = request("POST", "/" + identifier + "/validate", operator)
        result = response.get("data", {})
        flags = result.get("flags", [])
        has_flag = any(
            f.get("code") == "expiration_review" and f.get("field") == "expires_on" for f in flags
        )
        check(
            name,
            status == 200
            and result.get("quotation_id") == identifier
            and result.get("reference_date") == "2026-11-07"
            and "expiration_review" in result.get("evaluated_rules", [])
            and has_flag == flagged,
        )
