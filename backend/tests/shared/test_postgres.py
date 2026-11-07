from unittest.mock import MagicMock

import psycopg
import pytest
from pydantic import SecretStr, ValidationError

from app.control.settings import Settings
from app.shared.postgres import (
    DatabaseInfo,
    DatabaseNotConfigured,
    DatabaseProbeError,
    PostgresDatabase,
)


def make_database(url: str | None = "postgresql://example.invalid/test") -> PostgresDatabase:
    return PostgresDatabase(
        SecretStr(url) if url is not None else None,
        connect_timeout_seconds=3,
        statement_timeout_ms=1000,
    )


@pytest.mark.parametrize("url", [None, "", "   "])
def test_missing_configuration_never_uses_libpq_environment(monkeypatch, url) -> None:
    connect = MagicMock()
    monkeypatch.setattr(psycopg, "connect", connect)
    with pytest.raises(DatabaseNotConfigured):
        make_database(url).probe()
    connect.assert_not_called()


def test_connection_uses_timeouts_and_closes_transaction_context(monkeypatch) -> None:
    connect = MagicMock()
    monkeypatch.setattr(psycopg, "connect", connect)
    manager = connect.return_value
    with make_database().connection() as connection:
        assert connection is manager.__enter__.return_value
    connect.assert_called_once_with(
        "postgresql://example.invalid/test",
        connect_timeout=3,
    )
    connection.execute.assert_called_once_with(
        "SELECT pg_catalog.set_config('statement_timeout', %s, false)", ("1000",)
    )
    manager.__exit__.assert_called_once_with(None, None, None)


def test_connection_passes_failures_to_transaction_rollback(monkeypatch) -> None:
    connect = MagicMock()
    monkeypatch.setattr(psycopg, "connect", connect)
    connect.return_value.__exit__.return_value = False
    failure = psycopg.IntegrityError("failed write")
    with pytest.raises(psycopg.IntegrityError):
        with make_database().connection():
            raise failure
    args = connect.return_value.__exit__.call_args.args
    assert args[0] is psycopg.IntegrityError
    assert args[1] is failure


@pytest.mark.parametrize("vector_version", [None, "test-version"])
def test_probe_reports_installed_metadata_without_requiring_vector(
    monkeypatch, vector_version
) -> None:
    connect = MagicMock()
    monkeypatch.setattr(psycopg, "connect", connect)
    connection = connect.return_value.__enter__.return_value
    connection.execute.return_value.fetchone.return_value = (170000, vector_version)
    assert make_database().probe() == DatabaseInfo(170000, vector_version)


def test_empty_probe_result_is_not_ready(monkeypatch) -> None:
    connect = MagicMock()
    monkeypatch.setattr(psycopg, "connect", connect)
    connection = connect.return_value.__enter__.return_value
    connection.execute.return_value.fetchone.return_value = None
    with pytest.raises(DatabaseProbeError):
        make_database().probe()


def test_settings_do_not_print_database_credentials(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    url = "postgresql://example:credential-for-unit-test@example.invalid/test"
    config = Settings(_env_file=None, database_url=url)
    assert config.database_url.get_secret_value() == url
    assert "credential-for-unit-test" not in repr(config)
    assert "credential-for-unit-test" not in config.model_dump_json()


@pytest.mark.parametrize("url", ["", "   "])
def test_settings_treat_empty_url_as_not_configured(url) -> None:
    assert Settings(_env_file=None, database_url=url).database_url is None


@pytest.mark.parametrize(
    "values",
    [{"database_connect_timeout_seconds": 0}, {"database_statement_timeout_ms": 0}],
)
def test_settings_reject_unbounded_timeouts(values) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)
