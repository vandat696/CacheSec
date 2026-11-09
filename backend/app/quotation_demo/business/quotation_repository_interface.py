from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from app.quotation_demo.business.quotation_models import (
    QuotationCreate,
    QuotationPage,
    QuotationRecord,
)


class QuotationPersistenceError(RuntimeError):
    pass


class QuotationIdempotencyConflict(ValueError):
    pass


@dataclass(frozen=True)
class QuotationCreationIdentity:
    principal_id: str
    scope_id: str
    idempotency_key: str


class QuotationRepository(Protocol):
    def create_once(
        self, data: QuotationCreate, identity: QuotationCreationIdentity
    ) -> QuotationRecord: ...

    def get(self, quotation_id: UUID) -> QuotationRecord | None: ...

    def list(self, *, limit: int = 50, after: UUID | None = None) -> QuotationPage: ...


class QuotationRepositoryTransactions(Protocol):
    def open(self) -> AbstractContextManager[QuotationRepository]:
        """Commit on normal exit, roll back on failure; propagate commit errors before return."""
        ...
