import psycopg
import pytest

from app.quotation_demo.business.quotation_models import QuotationCreate
from app.quotation_demo.business.quotation_permissions import QuotationCaller
from app.quotation_demo.business.quotation_repository_interface import (
    QuotationCreationIdentity,
    QuotationPersistenceError,
)
from app.quotation_demo.business.quotation_service import QuotationService
from app.quotation_demo.database.postgres_quotation_transactions import (
    PostgresQuotationTransactions,
)
from app.quotation_demo.database.quotation_migrations import apply_migrations


class AllowedTestAuthority:
    """Test double; no fixture users or production grants are selected here."""

    caller = QuotationCaller("integration-test", "integration-test")

    def require(self, capability):
        pass


def test_service_postgresql_commit_and_missing_null_raw_values(quotation_database):
    with quotation_database.connection() as connection:
        apply_migrations(connection)
    service = QuotationService(
        PostgresQuotationTransactions(quotation_database), AllowedTestAuthority(), max_page_size=100
    )
    for index, expiration in enumerate([{}, {"expires_on": None}, {"expires_on": "2026-02-30"}]):
        created = service.create(
            QuotationCreate(
                supplier_name="Test",
                description="Test",
                total_amount="001.2300",
                currency="VND",
                **expiration,
            ),
            idempotency_key=f"test-{index}",
        )
        # Each service call opens a fresh PostgreSQL connection.
        restored = service.get(created.id)
        assert restored == created
        assert restored.expires_on_is_present == ("expires_on" in expiration)
    assert len(service.list().items) == 3


def test_database_deferred_commit_failure_is_visible_to_the_caller(quotation_database):
    with quotation_database.connection() as connection:
        apply_migrations(connection)
        # Test-only constraint, not a quotation business rule or an app migration.
        connection.execute(
            "ALTER TABLE quotation_demo.quotations ADD CONSTRAINT test_supplier_unique "
            "UNIQUE (supplier_name) DEFERRABLE INITIALLY DEFERRED"
        )
    service = QuotationService(
        PostgresQuotationTransactions(quotation_database), AllowedTestAuthority(), max_page_size=100
    )
    data = QuotationCreate(
        supplier_name="Test", description="Test", total_amount="1", currency="VND"
    )
    service.create(data, idempotency_key="first-create")
    with pytest.raises(QuotationPersistenceError) as failure:
        service.create(data, idempotency_key="second-create")
    assert isinstance(failure.value.__cause__, psycopg.errors.UniqueViolation)
    assert len(service.list().items) == 1


def test_idempotency_keys_are_separate_for_each_principal_and_scope(quotation_database):
    with quotation_database.connection() as connection:
        apply_migrations(connection)
    sessions = PostgresQuotationTransactions(quotation_database)
    data = QuotationCreate(
        supplier_name="Test", description="Test", total_amount="1", currency="VND"
    )
    ids = []
    for principal, scope in [("one", "app"), ("two", "app"), ("one", "other")]:
        identity = QuotationCreationIdentity(principal, scope, "same-key")
        with sessions.open() as repository:
            first = repository.create_once(data, identity)
        with sessions.open() as repository:
            assert repository.create_once(data, identity).id == first.id
        ids.append(first.id)
    assert len(set(ids)) == 3
