from app.quotation_demo.application.quotation_repository import QuotationRepositorySessions
from app.quotation_demo.application.quotation_service import QuotationService
from app.quotation_demo.identity.fixture_registry import FixtureIdentityRegistry


class FixtureQuotationServiceProvider:
    def __init__(
        self,
        registry: FixtureIdentityRegistry,
        sessions: QuotationRepositorySessions,
        *,
        max_page_size: int,
    ) -> None:
        self._registry, self._sessions, self._max_page_size = registry, sessions, max_page_size

    def for_credential(self, credential: str | None) -> QuotationService:
        access = self._registry.authenticate(credential)
        return QuotationService(self._sessions, access, max_page_size=self._max_page_size)
