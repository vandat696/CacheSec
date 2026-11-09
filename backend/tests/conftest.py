import os
from contextlib import contextmanager
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import make_conninfo
from pydantic import SecretStr

from app.shared.postgres_connection import PostgresDatabase


@pytest.fixture
def temporary_database():
    """Create/drop only a freshly owned random test DB, never the configured source DB."""

    @contextmanager
    def create(owner: str):
        if owner not in {"control", "quotations"}:
            raise ValueError("Unknown test database owner.")
        url = os.environ.get("CACHESEC_TEST_DATABASE_URL")
        if not url:
            pytest.skip("Set CACHESEC_TEST_DATABASE_URL for PostgreSQL tests.")
        name = f"cachesec_test_{owner}_" + uuid4().hex
        try:
            admin = psycopg.connect(url, autocommit=True, connect_timeout=3)
        except psycopg.Error:
            pytest.fail("Cannot connect to configured PostgreSQL test server.", pytrace=False)
        with admin:
            try:
                admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
            except psycopg.Error:
                pytest.fail("Tests require CREATE DATABASE on the test server.", pytrace=False)
            try:
                yield PostgresDatabase(
                    SecretStr(make_conninfo(url, dbname=name)),
                    connect_timeout_seconds=3,
                    statement_timeout_ms=5000,
                )
            finally:
                # Reachable only after this exact random database was successfully created.
                admin.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))

    return create
