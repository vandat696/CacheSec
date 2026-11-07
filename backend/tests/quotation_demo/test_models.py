import json
import subprocess
import sys

import pytest
from pydantic import ValidationError

from app.quotation_demo.config import QuotationSettings
from app.quotation_demo.models import QuotationCreate

BASE = dict(
    supplier_name="Nhà cung cấp thử",
    description="Vật tư giả lập",
    total_amount="001234.5000",
    currency="VND",
)


def test_missing_and_explicit_null_remain_distinct() -> None:
    missing = QuotationCreate(**BASE)
    explicit_null = QuotationCreate(**BASE, expires_on=None)
    assert not missing.expires_on_is_present
    assert explicit_null.expires_on_is_present
    assert "expires_on" not in missing.model_dump(exclude_unset=True)
    assert explicit_null.model_dump(exclude_unset=True)["expires_on"] is None


@pytest.mark.parametrize("amount", ["NaN", "Infinity", "1e3", " 10", "10\n", "1_000", 10, 1.5])
def test_amount_requires_a_plain_decimal_string_without_coercion(amount) -> None:
    with pytest.raises(ValidationError):
        QuotationCreate(**{**BASE, "total_amount": amount})


@pytest.mark.parametrize("amount", ["0", "-0.01", "+001.2300", "9" * 100 + ".00001"])
def test_amount_is_not_rounded_or_constrained_by_new_business_rules(amount) -> None:
    assert QuotationCreate(**{**BASE, "total_amount": amount}).total_amount == amount


@pytest.mark.parametrize("value", [float("nan"), {"nested": [float("inf")]}])
def test_non_json_numeric_values_are_rejected(value) -> None:
    with pytest.raises(ValidationError):
        QuotationCreate(**BASE, expires_on=value)


@pytest.mark.parametrize("field", ["id", "flags", "approved", "role"])
def test_create_does_not_accept_server_owned_fields(field) -> None:
    with pytest.raises(ValidationError):
        QuotationCreate(**BASE, **{field: "client value"})


def test_quotation_package_imports_without_control_or_http() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys,json; import app.quotation_demo.models,app.quotation_demo.storage,"
            "app.quotation_demo.migrate; "
            "print(json.dumps([m for m in sys.modules if m in "
            "('app.main','app.config','fastapi') or m.startswith('app.workflows')]))",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    assert json.loads(result.stdout) == []


def test_quotation_configuration_does_not_fall_back_to_control_database(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://control.invalid/test")
    monkeypatch.delenv("QUOTATION_DATABASE_URL", raising=False)
    assert QuotationSettings(_env_file=None).database_url is None
