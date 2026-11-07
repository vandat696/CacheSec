from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import psycopg
import pytest

from app.quotation_demo.persistence import migrations as migrate
from app.quotation_demo.persistence.migrations import Migration, MigrationError, apply_migrations


def test_migration_replay_preserves_existing_records(quotation_database) -> None:
    from app.quotation_demo.domain.quotation import QuotationCreate
    from app.quotation_demo.persistence.postgres_quotation_repository import (
        PostgresQuotationRepository,
    )

    with quotation_database.connection() as connection:
        assert apply_migrations(connection) == ("001_create_quotations.sql",)
        record = PostgresQuotationRepository(connection).create(
            QuotationCreate(
                supplier_name="test", description="test", total_amount="1", currency="VND"
            )
        )
    with quotation_database.connection() as connection:
        assert apply_migrations(connection) == ()
        assert PostgresQuotationRepository(connection).get(record.id) == record


def test_unknown_or_modified_migration_is_refused(quotation_database) -> None:
    with quotation_database.connection() as connection:
        apply_migrations(connection)
        connection.execute("UPDATE quotation_demo.schema_migrations SET checksum = %s", ("0" * 64,))
    with pytest.raises(MigrationError):
        with quotation_database.connection() as connection:
            apply_migrations(connection)
    with quotation_database.connection() as connection:
        connection.execute(
            "DELETE FROM quotation_demo.schema_migrations WHERE name = %s",
            ("001_create_quotations.sql",),
        )
        connection.execute(
            "INSERT INTO quotation_demo.schema_migrations (name,checksum) VALUES (%s,%s)",
            ("999_unknown.sql", "0" * 64),
        )
    with pytest.raises(MigrationError):
        with quotation_database.connection() as connection:
            apply_migrations(connection)


def test_failed_batch_rolls_back_schema_and_history_then_can_retry(quotation_database, monkeypatch):
    originals = migrate.load_migrations()
    broken = Migration(
        "002_broken.sql", "CREATE TABLE quotation_demo.partial (id int); SELECT 1/0;", "x"
    )
    with monkeypatch.context() as patch:
        patch.setattr(migrate, "load_migrations", lambda: (*originals, broken))
        with pytest.raises(psycopg.errors.DivisionByZero):
            with quotation_database.connection() as connection:
                apply_migrations(connection)
    with quotation_database.connection() as connection:
        assert connection.execute(
            "SELECT pg_catalog.to_regnamespace('quotation_demo')"
        ).fetchone() == (None,)
        assert apply_migrations(connection) == ("001_create_quotations.sql",)


def test_parallel_migrators_apply_each_version_once(quotation_database) -> None:
    barrier = Barrier(2)

    def run():
        with quotation_database.connection() as connection:
            barrier.wait(timeout=10)
            return apply_migrations(connection)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(run) for _ in range(2)]
        results = [future.result(timeout=15) for future in futures]
    assert sorted(results, key=len) == [(), ("001_create_quotations.sql",)]
