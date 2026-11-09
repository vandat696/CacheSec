from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.quotation_demo.main import create_app
from app.quotation_demo.settings import QuotationSettings
from app.shared.postgres import PostgresDatabase

ORIGIN = "http://127.0.0.1:3000"
READER = "cors-test-reader-" + "r" * 32


def configured_app():
    return create_app(
        QuotationSettings(
            _env_file=None,
            database_url=None,
            fixture_reader_token=SecretStr(READER),
            fixture_operator_token=SecretStr("cors-test-operator-" + "o" * 32),
            cors_origins=[ORIGIN],
        )
    )


def test_allowed_preflight_exposes_only_required_methods_and_headers():
    with TestClient(configured_app()) as client:
        response = client.options(
            "/api/v1/quotations",
            headers={
                "Origin": ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert set(response.headers["access-control-allow-methods"].split(", ")) == {"GET", "POST"}
    assert "access-control-allow-credentials" not in response.headers


@pytest.mark.parametrize(
    "origin,method,header",
    [
        ("https://untrusted.example", "POST", "authorization"),
        (ORIGIN, "DELETE", "authorization"),
        (ORIGIN, "POST", "x-role"),
    ],
)
def test_unconfigured_preflight_is_rejected(origin, method, header):
    with TestClient(configured_app()) as client:
        response = client.options(
            "/api/v1/quotations",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": header,
            },
        )
    assert response.status_code == 400


def test_cors_does_not_authenticate_or_hide_storage_failure():
    with TestClient(configured_app()) as client:
        for token, expected in [(None, 401), (READER, 503)]:
            response = client.get(
                "/api/v1/quotations",
                headers={
                    "Origin": ORIGIN,
                    **({"Authorization": f"Bearer {token}"} if token else {}),
                },
            )
            assert response.status_code == expected
            assert response.headers["access-control-allow-origin"] == ORIGIN
            assert "X-Request-ID" in response.headers["access-control-expose-headers"]


def test_unhandled_errors_still_have_cors_and_sanitized_body(monkeypatch):
    @contextmanager
    def broken_connection(self):
        raise TypeError("do-not-echo-this-internal-value")
        yield

    monkeypatch.setattr(PostgresDatabase, "connection", broken_connection)
    with TestClient(configured_app(), raise_server_exceptions=False) as client:
        response = client.get(
            "/api/v1/quotations", headers={"Origin": ORIGIN, "Authorization": f"Bearer {READER}"}
        )
    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "internal-value" not in response.text
