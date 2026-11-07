from uuid import UUID

from app.quotation_demo.application.quotation_access import QuotationAccess, QuotationCapability
from app.quotation_demo.application.quotation_repository import (
    QuotationCreationIdentity,
    QuotationRepositorySessions,
)
from app.quotation_demo.domain.quotation import QuotationCreate, QuotationPage, QuotationRecord


class QuotationNotFound(LookupError):
    pass


class InvalidQuotationPage(ValueError):
    pass


class InvalidIdempotencyKey(ValueError):
    pass


class QuotationService:
    """Authorize operations and own their transaction boundary independently of HTTP/storage."""

    def __init__(
        self,
        sessions: QuotationRepositorySessions,
        access: QuotationAccess,
        *,
        max_page_size: int,
    ) -> None:
        if type(max_page_size) is not int or max_page_size < 1:
            raise ValueError("Maximum page size must be a positive integer.")
        self._sessions = sessions
        self._access = access
        self._max_page_size = max_page_size

    def create(self, data: QuotationCreate, *, idempotency_key: str) -> QuotationRecord:
        self._access.require(QuotationCapability.CREATE)
        if not 1 <= len(idempotency_key) <= 128 or not idempotency_key.isascii():
            raise InvalidIdempotencyKey("Idempotency key must contain 1-128 ASCII characters.")
        caller = self._access.caller
        with self._sessions.open() as repository:
            record = repository.create_once(
                data,
                QuotationCreationIdentity(caller.principal_id, caller.scope_id, idempotency_key),
            )
        # The session has committed before the caller can report successful creation.
        return record

    def get(self, quotation_id: UUID) -> QuotationRecord:
        self._access.require(QuotationCapability.READ)
        with self._sessions.open() as repository:
            record = repository.get(quotation_id)
        if record is None:
            raise QuotationNotFound("Quotation was not found.")
        return record

    def list(self, *, limit: int | None = None, after: UUID | None = None) -> QuotationPage:
        self._access.require(QuotationCapability.READ)
        if limit is None:
            limit = min(50, self._max_page_size)
        if type(limit) is not int or not 1 <= limit <= self._max_page_size:
            raise InvalidQuotationPage("Page size is outside the configured range.")
        with self._sessions.open() as repository:
            page = repository.list(limit=limit, after=after)
        return page
