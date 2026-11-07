from contextlib import contextmanager
from uuid import uuid4

import pytest

from app.quotation_demo.application.quotation_access import (
    QuotationAccessDenied,
    QuotationCaller,
    QuotationCapability,
)
from app.quotation_demo.application.quotation_repository import QuotationIdempotencyConflict
from app.quotation_demo.application.quotation_service import (
    InvalidIdempotencyKey,
    InvalidQuotationPage,
    QuotationNotFound,
    QuotationService,
)
from app.quotation_demo.domain.quotation import QuotationCreate, QuotationPage, QuotationRecord


class TestAuthority:
    __test__ = False

    def __init__(self, *, allowed=True, unavailable=False):
        self.allowed = allowed
        self.unavailable = unavailable
        self.requested = []
        self.caller = QuotationCaller("unit-test", "unit-test")

    def require(self, capability):
        self.requested.append(capability)
        if self.unavailable:
            raise RuntimeError("Test authority unavailable")
        if not self.allowed:
            raise QuotationAccessDenied()


class MemoryRepository:
    def __init__(self):
        self.records = {}
        self.requests = {}

    def create(self, data):
        record = QuotationRecord(id=uuid4(), **data.model_dump(exclude_unset=True))
        self.records[record.id] = record
        return record

    def create_once(self, data, identity):
        key = (identity.principal_id, identity.scope_id, identity.idempotency_key)
        payload = data.model_dump(exclude_unset=True)
        if key in self.requests:
            original_payload, quotation_id = self.requests[key]
            if original_payload != payload:
                raise QuotationIdempotencyConflict()
            return self.records[quotation_id]
        record = self.create(data)
        self.requests[key] = payload, record.id
        return record

    def get(self, quotation_id):
        return self.records.get(quotation_id)

    def list(self, *, limit=50, after=None):
        rows = sorted(self.records.values(), key=lambda record: record.id)
        rows = [row for row in rows if after is None or row.id > after]
        items = tuple(rows[:limit])
        return QuotationPage(items, items[-1].id if len(rows) > limit else None)


class MemorySessions:
    """Test double for service orchestration; not a persistence or identity implementation."""

    def __init__(self, *, commit_failure=False):
        self.repository = MemoryRepository()
        self.open_count = 0
        self.committed = False
        self.commit_failure = commit_failure

    @contextmanager
    def open(self):
        self.open_count += 1
        before = self.repository.records.copy(), self.repository.requests.copy()
        try:
            yield self.repository
            if self.commit_failure:
                raise RuntimeError("Test commit failed")
            self.committed = True
        except BaseException:
            self.repository.records, self.repository.requests = before
            raise


def quotation(**values):
    return QuotationCreate(
        supplier_name="Test supplier",
        description="Test quote",
        total_amount="1.000",
        currency="VND",
        **values,
    )


@pytest.mark.parametrize("operation", ["create", "get", "list"])
@pytest.mark.parametrize("unavailable", [False, True])
def test_denied_or_unavailable_authority_never_opens_database(operation, unavailable):
    sessions = MemorySessions()
    access = TestAuthority(allowed=False, unavailable=unavailable)
    service = QuotationService(sessions, access, max_page_size=100)
    error = RuntimeError if unavailable else QuotationAccessDenied
    with pytest.raises(error):
        if operation == "create":
            service.create(quotation(), idempotency_key="test-create")
        elif operation == "get":
            service.get(uuid4())
        else:
            service.list(limit=0)
    assert sessions.open_count == 0


def test_creation_returns_only_after_commit_and_preserves_missing_expiration():
    sessions = MemorySessions()
    access = TestAuthority()
    record = QuotationService(sessions, access, max_page_size=100).create(
        quotation(), idempotency_key="test-create"
    )
    assert sessions.committed
    assert not record.expires_on_is_present
    assert record.total_amount == "1.000"
    assert access.requested == [QuotationCapability.CREATE]


def test_commit_error_is_propagated_instead_of_returning_success():
    sessions = MemorySessions(commit_failure=True)
    with pytest.raises(RuntimeError, match="Test commit failed"):
        QuotationService(sessions, TestAuthority(), max_page_size=100).create(
            quotation(), idempotency_key="test-create"
        )
    assert not sessions.committed
    assert sessions.repository.records == {}
    assert sessions.repository.requests == {}


def test_get_and_list_use_read_capability_and_report_not_found():
    sessions, access = MemorySessions(), TestAuthority()
    created = sessions.repository.create(quotation(expires_on=None))
    service = QuotationService(sessions, access, max_page_size=100)
    assert service.get(created.id) == created
    assert service.list(limit=1).items == (created,)
    with pytest.raises(QuotationNotFound):
        service.get(uuid4())
    assert access.requested == [QuotationCapability.READ] * 3


@pytest.mark.parametrize("limit", [0, -1, 101, True, 1.5])
def test_pagination_checks_configured_limit_before_database_access(limit):
    sessions = MemorySessions()
    with pytest.raises(InvalidQuotationPage):
        QuotationService(sessions, TestAuthority(), max_page_size=100).list(limit=limit)
    assert sessions.open_count == 0


@pytest.mark.parametrize("limit", [0, -1, True])
def test_constructor_rejects_invalid_page_size_configuration(limit):
    with pytest.raises(ValueError):
        QuotationService(MemorySessions(), TestAuthority(), max_page_size=limit)


@pytest.mark.parametrize("key", ["", "x" * 129, "non-ascii-é"])
def test_invalid_idempotency_key_is_rejected_before_storage(key):
    sessions = MemorySessions()
    with pytest.raises(InvalidIdempotencyKey):
        QuotationService(sessions, TestAuthority(), max_page_size=100).create(
            quotation(), idempotency_key=key
        )
    assert sessions.open_count == 0


def test_default_page_size_respects_a_lower_configured_cap():
    sessions = MemorySessions()
    for _ in range(3):
        sessions.repository.create(quotation())
    page = QuotationService(sessions, TestAuthority(), max_page_size=2).list()
    assert len(page.items) == 2
    assert page.next_cursor is not None
