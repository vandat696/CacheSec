from typing import Protocol

from app.quotation_demo.auth.fixture_identity import FixtureIdentityRegistry
from app.quotation_demo.business.quotation_repository_interface import (
    QuotationRepositoryTransactions,
)
from app.quotation_demo.business.quotation_service import QuotationService


class QuotationServiceFactory(Protocol):
    def for_credential(self, credential: str | None) -> QuotationService:
        """Resolve trusted identity/authority before supplying a service; no default caller."""
        ...


class FixtureQuotationServiceFactory:
    """Create a quotation service bound to the current backend fixture identity."""

    def __init__(
        self,
        registry: FixtureIdentityRegistry,
        transactions: QuotationRepositoryTransactions,
        *,
        max_page_size: int,
    ) -> None:
        self._registry = registry
        self._transactions = transactions
        self._max_page_size = max_page_size

    def for_credential(self, credential: str | None) -> QuotationService:
        access = self._registry.authenticate(credential)
        return QuotationService(self._transactions, access, max_page_size=self._max_page_size)
