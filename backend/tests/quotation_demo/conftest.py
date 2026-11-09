import os
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import make_conninfo
from pydantic import SecretStr

from app.shared.postgres_connection import PostgresDatabase


@pytest.fixture
def quotation_database():
    """Own one new disposable DB; never drop or reset the configured source DB."""
    url = os.environ.get("CACHESEC_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set CACHESEC_TEST_DATABASE_URL for quotation PostgreSQL tests.")
    name = "cachesec_test_quotations_" + uuid4().hex
    try:
        admin = psycopg.connect(url, autocommit=True, connect_timeout=3)
    except psycopg.Error:
        pytest.fail("Cannot connect to configured PostgreSQL test server.", pytrace=False)
    with admin:
        try:
            admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        except psycopg.Error:
            pytest.fail(
                "Quotation tests require CREATE DATABASE on the test server.", pytrace=False
            )
        try:
            yield PostgresDatabase(
                SecretStr(make_conninfo(url, dbname=name)),
                connect_timeout_seconds=3,
                statement_timeout_ms=5000,
            )
        finally:
            # Only this fixture's successfully-created random DB can reach this cleanup.
            admin.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))
