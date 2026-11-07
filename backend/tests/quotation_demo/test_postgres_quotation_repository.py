from uuid import uuid4

import psycopg
import pytest

from app.quotation_demo.domain.quotation import QuotationCreate
from app.quotation_demo.persistence.migrations import apply_migrations
from app.quotation_demo.persistence.postgres_quotation_repository import PostgresQuotationRepository

BASE = dict(
    supplier_name="Nhà cung cấp O'Reilly",
    description="'; DROP TABLE quotation_demo.quotations; --",
    total_amount="000123456789012345678901234567890.120000",
    currency="VND",
)


@pytest.fixture
def migrated_database(quotation_database):
    with quotation_database.connection() as connection:
        apply_migrations(connection)
    return quotation_database


def test_create_commits_and_can_be_read_from_a_new_connection(migrated_database) -> None:
    with migrated_database.connection() as connection:
        created = PostgresQuotationRepository(connection).create(QuotationCreate(**BASE))
    with migrated_database.connection() as connection:
        store = PostgresQuotationRepository(connection)
        restored = store.get(created.id)
        assert restored == created
        assert restored.total_amount == BASE["total_amount"]
        assert restored.description == BASE["description"]
        assert store.get(uuid4()) is None
        assert store.list().items == (created,)
    assert not restored.expires_on_is_present
    assert "expires_on" not in restored.model_dump(mode="json", exclude_unset=True)


def test_expiration_inputs_round_trip_without_date_validation(migrated_database) -> None:
    inputs = [
        None,
        "",
        "2026-02-30",
        "2024-01-01",
        "2026-11-07",
        " 2026-11-08 ",
        False,
        123,
        1.5,
        ["raw", None],
        {"raw": "date"},
        "\u0000",
    ]
    with migrated_database.connection() as connection:
        store = PostgresQuotationRepository(connection)
        ids = [store.create(QuotationCreate(**BASE, expires_on=value)).id for value in inputs]
    with migrated_database.connection() as connection:
        store = PostgresQuotationRepository(connection)
        for quotation_id, expected in zip(ids, inputs, strict=True):
            record = store.get(quotation_id)
            assert record.expires_on_is_present
            assert record.expires_on == expected
            assert type(record.expires_on) is type(expected)
            assert set(record.model_dump(exclude_unset=True)) == {*BASE, "expires_on", "id"}


def test_error_rolls_back_the_entire_callers_transaction(migrated_database) -> None:
    quotation_id = None
    with pytest.raises(psycopg.errors.CheckViolation):
        with migrated_database.connection() as connection:
            created = PostgresQuotationRepository(connection).create(QuotationCreate(**BASE))
            quotation_id = created.id
            connection.execute(
                "INSERT INTO quotation_demo.quotations "
                "(id,supplier_name,description,total_amount,currency) VALUES (%s,%s,%s,%s,%s)",
                (uuid4(), "test", "test", "NaN", "VND"),
            )
    with migrated_database.connection() as connection:
        assert PostgresQuotationRepository(connection).get(quotation_id) is None
        assert PostgresQuotationRepository(connection).list().items == ()


def test_uuid_keyset_pagination_has_no_duplicates_and_no_empty_last_page(migrated_database) -> None:
    with migrated_database.connection() as connection:
        store = PostgresQuotationRepository(connection)
        ids = [store.create(QuotationCreate(**BASE)).id for _ in range(6)]
    with migrated_database.connection() as connection:
        store = PostgresQuotationRepository(connection)
        cursor = None
        seen = []
        while True:
            page = store.list(limit=2, after=cursor)
            assert len(page.items) == 2
            seen.extend(item.id for item in page.items)
            if page.next_cursor is None:
                break
            cursor = page.next_cursor
        assert seen == sorted(ids)
        assert store.list(limit=2, after=max(ids)).items == ()


@pytest.mark.parametrize("amount", ["NaN", "Infinity", "1e3", "1\n"])
def test_database_constraint_rejects_non_decimal_amount(migrated_database, amount) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        with migrated_database.connection() as connection:
            connection.execute(
                "INSERT INTO quotation_demo.quotations "
                "(id,supplier_name,description,total_amount,currency) VALUES (%s,%s,%s,%s,%s)",
                (uuid4(), "test", "test", amount, "VND"),
            )
