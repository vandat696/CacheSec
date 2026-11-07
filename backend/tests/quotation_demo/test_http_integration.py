from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.quotation_demo.http.application import create_quotation_app
from app.quotation_demo.http.fixture_service_provider import FixtureQuotationServiceProvider
from app.quotation_demo.identity.fixture_registry import FixtureIdentityRegistry
from app.quotation_demo.persistence.migrations import apply_migrations
from app.quotation_demo.persistence.postgres_quotation_sessions import PostgresQuotationSessions

READER = "integration-test-reader-" + "r" * 32
OPERATOR = "integration-test-operator-" + "o" * 32
BODY = {
    "supplier_name": "Test",
    "description": "Test",
    "total_amount": "001.2300",
    "currency": "VND",
}
READ_HEADERS = {"Authorization": f"Bearer {READER}"}
WRITE_HEADERS = {"Authorization": f"Bearer {OPERATOR}", "Idempotency-Key": "test-create"}


@pytest.fixture
def api(quotation_database):
    with quotation_database.connection() as connection:
        apply_migrations(connection)
    registry = FixtureIdentityRegistry(SecretStr(READER), SecretStr(OPERATOR))
    sessions = PostgresQuotationSessions(quotation_database)
    provider = FixtureQuotationServiceProvider(registry, sessions, max_page_size=100)
    app = create_quotation_app(provider, max_body_bytes=65536)
    with TestClient(app) as client:
        yield client, registry, quotation_database, app


def test_create_read_list_and_raw_expiration_round_trip(api):
    client, _, _, _ = api
    cases = [
        {},
        {"expires_on": None},
        {"expires_on": ""},
        {"expires_on": "2026-02-30"},
        {"expires_on": "2024-01-01"},
        {"expires_on": False},
        {"expires_on": {"raw": 1}},
    ]
    for index, expiration in enumerate(cases):
        body = {**BODY, **expiration}
        response = client.post(
            "/api/v1/quotations",
            json=body,
            headers={**WRITE_HEADERS, "Idempotency-Key": f"case-{index}"},
        )
        assert response.status_code == 201
        record = response.json()["data"]
        assert set(record) == {*body, "id"}
        assert {key: value for key, value in record.items() if key != "id"} == body
        assert response.json()["meta"]["identity_mode"] == "fixture"
        restored = client.get(f"/api/v1/quotations/{record['id']}", headers=READ_HEADERS)
        assert restored.status_code == 200
        assert restored.json()["data"] == record
    ids, cursor = [], None
    while True:
        response = client.get(
            "/api/v1/quotations",
            headers=READ_HEADERS,
            params={"limit": 2, **({"after": cursor} if cursor else {})},
        )
        assert response.status_code == 200
        page = response.json()["data"]
        ids.extend(row["id"] for row in page["items"])
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert len(ids) == len(set(ids)) == len(cases)


def test_replay_creates_one_row_and_conflicting_payload_returns_409(api):
    client, _, database, _ = api
    first = client.post("/api/v1/quotations", json=BODY, headers=WRITE_HEADERS)
    replay = client.post("/api/v1/quotations", json=BODY, headers=WRITE_HEADERS)
    assert first.status_code == replay.status_code == 201
    assert first.json()["data"] == replay.json()["data"]
    conflict = client.post(
        "/api/v1/quotations", json={**BODY, "expires_on": None}, headers=WRITE_HEADERS
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM quotation_demo.quotations").fetchone() == (
            1,
        )
        assert connection.execute(
            "SELECT count(*) FROM quotation_demo.creation_requests"
        ).fetchone() == (1,)


def test_replay_does_not_bypass_current_identity_or_permission(api):
    client, registry, database, _ = api
    assert client.post("/api/v1/quotations", json=BODY, headers=WRITE_HEADERS).status_code == 201
    assert (
        client.post(
            "/api/v1/quotations",
            json=BODY,
            headers={**READ_HEADERS, "Idempotency-Key": "test-create"},
        ).status_code
        == 403
    )
    registry.revoke("quotation-operator")
    assert client.post("/api/v1/quotations", json=BODY, headers=WRITE_HEADERS).status_code == 401
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM quotation_demo.quotations").fetchone() == (
            1,
        )


def test_parallel_http_retries_create_one_committed_quotation(api):
    _, _, database, app = api
    barrier = Barrier(3)

    def submit():
        with TestClient(app) as client:
            barrier.wait(timeout=10)
            response = client.post("/api/v1/quotations", json=BODY, headers=WRITE_HEADERS)
            assert response.status_code == 201
            return response.json()["data"]["id"]

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(submit) for _ in range(3)]
        ids = [future.result(timeout=15) for future in futures]
    assert len(set(ids)) == 1
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM quotation_demo.quotations").fetchone() == (
            1,
        )


def test_commit_failure_returns_503_and_retry_can_succeed_after_rollback(api):
    client, _, database, _ = api
    with database.connection() as connection:
        connection.execute(
            "ALTER TABLE quotation_demo.quotations ADD CONSTRAINT test_only_unique "
            "UNIQUE (supplier_name) DEFERRABLE INITIALLY DEFERRED"
        )
    assert client.post("/api/v1/quotations", json=BODY, headers=WRITE_HEADERS).status_code == 201
    headers = {**WRITE_HEADERS, "Idempotency-Key": "failed-commit"}
    failed = client.post("/api/v1/quotations", json=BODY, headers=headers)
    assert failed.status_code == 503
    assert "test_only_unique" not in failed.text
    retry = client.post(
        "/api/v1/quotations", json={**BODY, "supplier_name": "Other"}, headers=headers
    )
    assert retry.status_code == 201
    with database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM quotation_demo.quotations").fetchone() == (
            2,
        )
        assert connection.execute(
            "SELECT count(*) FROM quotation_demo.creation_requests"
        ).fetchone() == (2,)
