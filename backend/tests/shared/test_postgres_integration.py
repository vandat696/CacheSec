"""Opt-in checks against a test PostgreSQL server; not a research fixture."""

import os

import psycopg
import pytest
from pydantic import SecretStr

from app.shared.postgres import PostgresDatabase


@pytest.fixture
def database():
    url = os.environ.get("CACHESEC_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set CACHESEC_TEST_DATABASE_URL to run real PostgreSQL checks.")
    return PostgresDatabase(SecretStr(url), connect_timeout_seconds=3, statement_timeout_ms=1000)


def test_postgresql_probe(database) -> None:
    try:
        info = database.probe()
    except psycopg.Error:
        pytest.fail("Configured test PostgreSQL server could not be queried.", pytrace=False)
    assert info.postgresql_version > 0


def test_postgresql_round_trip_in_session_local_table(database) -> None:
    try:
        with database.connection() as connection:
            connection.execute(
                "CREATE TEMP TABLE cachesec_connection_probe (value text) ON COMMIT DROP"
            )
            connection.execute(
                "INSERT INTO cachesec_connection_probe (value) VALUES (%s)", ("probe's value",)
            )
            assert connection.execute("SELECT value FROM cachesec_connection_probe").fetchone() == (
                "probe's value",
            )
    except psycopg.Error:
        pytest.fail("Test PostgreSQL temporary-table round trip failed.", pytrace=False)
