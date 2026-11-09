from contextlib import contextmanager
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.quotation_demo.api.quotation_http_app import create_quotation_http_app
from app.quotation_demo.api.quotation_service_factory import FixtureQuotationServiceFactory
from app.quotation_demo.auth.fixture_identity import FixtureIdentityRegistry
from app.quotation_demo.business.quotation_models import QuotationPage, QuotationRecord
from app.quotation_demo.business.quotation_repository_interface import QuotationPersistenceError

READER = "unit-test-reader-credential-0000000000"
OPERATOR = "unit-test-operator-credential-00000000"
BODY = {"supplier_name": "Test", "description": "Test", "total_amount": "1.2300", "currency": "VND"}


class EmptySessions:
    def __init__(self):
        self.opens = 0

    @contextmanager
    def open(self):
        self.opens += 1
        yield self

    def get(self, quotation_id):
        return None

    def list(self, *, limit=50, after=None):
        return QuotationPage((), None)


@pytest.fixture
def runtime():
    registry = FixtureIdentityRegistry(SecretStr(READER), SecretStr(OPERATOR))
    sessions = EmptySessions()
    provider = FixtureQuotationServiceFactory(registry, sessions, max_page_size=100)
    app = create_quotation_http_app(provider, max_body_bytes=65536)
    with TestClient(app) as client:
        yield client, registry, sessions


@pytest.mark.parametrize("authorization", [None, "Bearer wrong", "Basic wrong", "Bearer"])
def test_missing_or_invalid_identity_is_rejected_before_storage(runtime, authorization):
    client, _, sessions = runtime
    response = client.get(
        "/api/v1/quotations", headers={"Authorization": authorization} if authorization else {}
    )
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "IDENTITY_REQUIRED"
    assert response.json()["meta"]["request_id"] == response.headers["x-request-id"]
    assert sessions.opens == 0


def test_reader_can_read_but_cannot_escalate_role_using_client_headers(runtime):
    client, _, sessions = runtime
    headers = {"Authorization": f"Bearer {READER}", "X-Role": "operator", "X-Tenant": "other"}
    assert client.get("/api/v1/quotations", headers=headers).status_code == 200
    opened = sessions.opens
    response = client.post(
        "/api/v1/quotations", json=BODY, headers={**headers, "Idempotency-Key": "x"}
    )
    assert response.status_code == 403
    assert sessions.opens == opened


def test_revocation_is_checked_on_next_request(runtime):
    client, registry, sessions = runtime
    headers = {"Authorization": f"Bearer {READER}"}
    assert client.get("/api/v1/quotations", headers=headers).status_code == 200
    registry.revoke("quotation-reader")
    opened = sessions.opens
    assert client.get("/api/v1/quotations", headers=headers).status_code == 401
    assert sessions.opens == opened


@pytest.mark.parametrize("limit", [0, -1, 101])
def test_page_limits_do_not_open_storage(runtime, limit):
    client, _, sessions = runtime
    response = client.get(
        f"/api/v1/quotations?limit={limit}", headers={"Authorization": f"Bearer {READER}"}
    )
    assert response.status_code == 400
    assert sessions.opens == 0


def test_not_found_has_a_scoped_request_reference(runtime):
    client, _, _ = runtime
    response = client.get(
        f"/api/v1/quotations/{uuid4()}", headers={"Authorization": f"Bearer {READER}"}
    )
    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["meta"]["identity_mode"] == "fixture"


@pytest.mark.parametrize("extra", ["role", "tenant_id", "flags", "id"])
def test_client_owned_input_does_not_accept_server_metadata(runtime, extra):
    client, _, sessions = runtime
    response = client.post(
        "/api/v1/quotations",
        json={**BODY, extra: "do-not-echo-this-value"},
        headers={"Authorization": f"Bearer {OPERATOR}", "Idempotency-Key": "x"},
    )
    assert response.status_code == 400
    assert "do-not-echo-this-value" not in response.text
    assert sessions.opens == 0


@pytest.mark.parametrize("field", ["supplier_name", "description", "total_amount", "currency"])
def test_baseline_required_fields_are_rejected_before_storage(runtime, field):
    client, _, sessions = runtime
    body = {key: value for key, value in BODY.items() if key != field}
    response = client.post(
        "/api/v1/quotations",
        json=body,
        headers={"Authorization": f"Bearer {OPERATOR}", "Idempotency-Key": "missing-field"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
    assert sessions.opens == 0


@pytest.mark.parametrize("field", ["supplier_name", "description", "total_amount", "currency"])
@pytest.mark.parametrize("value", [None, False, 10, [], {}])
def test_baseline_fields_do_not_coerce_non_string_json_values(runtime, field, value):
    client, _, sessions = runtime
    response = client.post(
        "/api/v1/quotations",
        json={**BODY, field: value},
        headers={"Authorization": f"Bearer {OPERATOR}", "Idempotency-Key": "wrong-type"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
    assert sessions.opens == 0


@pytest.mark.parametrize("amount", ["1e3", "NaN", "Infinity", " 1", "1\n"])
def test_baseline_decimal_syntax_errors_do_not_open_storage(runtime, amount):
    client, _, sessions = runtime
    response = client.post(
        "/api/v1/quotations",
        json={**BODY, "total_amount": amount},
        headers={"Authorization": f"Bearer {OPERATOR}", "Idempotency-Key": "wrong-amount"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
    assert sessions.opens == 0


@pytest.mark.parametrize("key", [None, "", "x" * 129])
def test_required_bounded_ascii_idempotency_key(runtime, key):
    client, _, sessions = runtime
    headers = {"Authorization": f"Bearer {OPERATOR}"}
    if key is not None:
        headers["Idempotency-Key"] = key
    response = client.post("/api/v1/quotations", json=BODY, headers=headers)
    assert response.status_code == 400
    assert sessions.opens == 0


def test_body_limit_is_enforced_before_provider_or_storage(runtime):
    client, _, sessions = runtime
    response = client.post(
        "/api/v1/quotations",
        content=b"x" * 65537,
        headers={"Authorization": f"Bearer {OPERATOR}", "Idempotency-Key": "x"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert response.headers["x-request-id"]
    assert sessions.opens == 0


def test_storage_failure_is_sanitized_and_never_reported_as_success():
    class FailedSessions:
        @contextmanager
        def open(self):
            raise QuotationPersistenceError("postgresql://do-not-echo-credentials")
            yield

    registry = FixtureIdentityRegistry(SecretStr(READER), SecretStr(OPERATOR))
    provider = FixtureQuotationServiceFactory(registry, FailedSessions(), max_page_size=100)
    with TestClient(create_quotation_http_app(provider, max_body_bytes=65536)) as client:
        response = client.get("/api/v1/quotations", headers={"Authorization": f"Bearer {READER}"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "STORAGE_UNAVAILABLE"
    assert "credentials" not in response.text


def test_openapi_declares_bearer_security(runtime):
    client, _, _ = runtime
    schema = client.get("/openapi.json").json()
    operation = schema["paths"]["/api/v1/quotations"]["post"]
    assert operation["security"] == [{"HTTPBearer": []}]
    assert "fixture" in schema["info"]["description"]


def test_unexpected_programming_error_remains_a_sanitized_500():
    class BrokenProvider:
        def for_credential(self, credential):
            raise TypeError("do-not-echo-an-internal-secret")

    app = create_quotation_http_app(BrokenProvider(), max_body_bytes=65536)
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/v1/quotations", headers={"Authorization": "Bearer test"})
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "internal-secret" not in response.text
    assert response.headers["x-request-id"] == response.json()["meta"]["request_id"]


def test_duplicate_authorization_headers_are_not_accepted(runtime):
    client, _, sessions = runtime
    response = client.get(
        "/api/v1/quotations",
        headers=[("Authorization", f"Bearer {READER}"), ("Authorization", f"Bearer {OPERATOR}")],
    )
    assert response.status_code == 401
    assert sessions.opens == 0


@pytest.mark.parametrize("token,status", [(None, 401), ("wrong", 401), (READER, 403)])
def test_validation_rejects_missing_identity_and_reader_before_storage(runtime, token, status):
    client, _, sessions = runtime
    response = client.post(
        f"/api/v1/quotations/{uuid4()}/validate",
        headers={"Authorization": f"Bearer {token}", "X-Role": "operator"} if token else {},
    )
    assert response.status_code == status
    assert sessions.opens == 0


def test_validation_checks_revocation_and_reports_not_found(runtime):
    client, registry, sessions = runtime
    path = f"/api/v1/quotations/{uuid4()}/validate"
    headers = {"Authorization": f"Bearer {OPERATOR}"}
    response = client.post(path, headers=headers)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "QUOTATION_NOT_FOUND"
    assert sessions.opens == 1
    registry.revoke("quotation-operator")
    assert client.post(path, headers=headers).status_code == 401
    assert sessions.opens == 1


@pytest.mark.parametrize(
    "payload", [{"reference_date": "2000-01-01"}, {"flags": []}, {"approved": True}]
)
def test_validation_does_not_accept_client_configuration_or_results(runtime, payload):
    client, _, sessions = runtime
    response = client.post(
        f"/api/v1/quotations/{uuid4()}/validate",
        headers={"Authorization": f"Bearer {OPERATOR}"},
        json=payload,
    )
    assert response.status_code == 400
    assert sessions.opens == 0


def test_validator_failure_is_not_reported_as_an_empty_success(runtime, monkeypatch):
    from app.quotation_demo.business import quotation_service

    client, _, sessions = runtime
    record = QuotationRecord(id=uuid4(), **BODY)
    monkeypatch.setattr(sessions, "get", lambda _quotation_id: record)

    def broken_validator(_record):
        raise RuntimeError("do-not-echo-validator-internals")

    monkeypatch.setattr(quotation_service, "validate_quotation", broken_validator)
    # Allow the configured application exception handler to produce the real HTTP response.
    with TestClient(client.app, raise_server_exceptions=False) as errors:
        response = errors.post(
            f"/api/v1/quotations/{record.id}/validate",
            headers={"Authorization": f"Bearer {OPERATOR}"},
        )
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "data" not in response.json()
    assert "validator-internals" not in response.text
