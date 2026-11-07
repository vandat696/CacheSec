from typing import Protocol

from app.quotation_demo.application.quotation_service import QuotationService


class QuotationServiceProvider(Protocol):
    def for_credential(self, credential: str | None) -> QuotationService:
        """Resolve trusted identity/authority before supplying a service; no default caller."""
        ...
