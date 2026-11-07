from unittest.mock import MagicMock

import psycopg
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.database import Database, DatabaseInfo, DatabaseNotConfigured, DatabaseProbeError
from app.main import app, get_database


@pytest.fixture
def database():
    database = MagicMock(spec=Database)
    database.probe.return_value = DatabaseInfo(170000, None)
    app.dependency_overrides[get_database] = lambda: database
    try:
        yield database
    finally:
        del app.dependency_overrides[get_database]


def test_readiness_requires_successful_database_query(database) -> None:
    with TestClient(app) as client:
        response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "ready"}
    database.probe.assert_called_once()


@pytest.mark.parametrize(
    ("failure", "expected_database"),
    [
        (DatabaseNotConfigured(), "not_configured"),
        (psycopg.OperationalError("postgresql://secret-should-not-leak"), "unavailable"),
        (psycopg.errors.QueryCanceled("statement timeout"), "unavailable"),
        (DatabaseProbeError(), "unavailable"),
    ],
)
def test_readiness_fails_without_exposing_connection_errors(database, failure, expected_database):
    database.probe.side_effect = failure
    with TestClient(app) as client:
        response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "database": expected_database}
    assert "secret-should-not-leak" not in response.text


def test_liveness_does_not_call_database(database) -> None:
    database.probe.side_effect = psycopg.OperationalError("database offline")
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
    database.probe.assert_not_called()


def test_unexpected_programming_errors_are_not_reported_as_database_outage(database) -> None:
    database.probe.side_effect = TypeError("programming error")
    with TestClient(app) as client, pytest.raises(TypeError):
        client.get("/ready")


def test_real_driver_rejects_invalid_connection_string_without_exposing_it(database) -> None:
    invalid_database = Database(
        SecretStr("invalid-dsn-containing-a-unit-test-secret"),
        connect_timeout_seconds=3,
        statement_timeout_ms=1000,
    )
    app.dependency_overrides[get_database] = lambda: invalid_database
    with TestClient(app) as client:
        response = client.get("/ready")
        assert client.get("/health").status_code == 200
    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "database": "unavailable"}
    assert "unit-test-secret" not in response.text
