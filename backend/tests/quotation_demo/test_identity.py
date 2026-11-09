from contextlib import contextmanager

import pytest
from pydantic import SecretStr

from app.quotation_demo.auth.fixture_identity import FixtureIdentityRegistry
from app.quotation_demo.business.quotation_models import QuotationPage
from app.quotation_demo.business.quotation_permissions import (
    QuotationAccessDenied,
    QuotationCapability,
    QuotationIdentityRequired,
)
from app.quotation_demo.business.quotation_service import QuotationService


def test_access_handle_checks_revocation_instead_of_reusing_an_authentication_decision():
    token = SecretStr("test-only-reader-" + "x" * 32)
    registry = FixtureIdentityRegistry(token, SecretStr("test-only-operator-" + "y" * 32))
    access = registry.authenticate(token.get_secret_value())
    access.require(QuotationCapability.READ)
    with pytest.raises(QuotationAccessDenied):
        access.require(QuotationCapability.CREATE)
    registry.revoke(access.caller.principal_id)
    with pytest.raises(QuotationIdentityRequired):
        access.require(QuotationCapability.READ)


@pytest.mark.parametrize("reader,operator", [("", "x" * 32), ("x" * 32, "x" * 32)])
def test_invalid_fixture_configuration_fails_closed(reader, operator):
    with pytest.raises(ValueError):
        FixtureIdentityRegistry(SecretStr(reader), SecretStr(operator))


def test_revocation_does_not_cancel_operation_that_already_passed_the_gate():
    token = "test-only-reader-" + "x" * 32
    registry = FixtureIdentityRegistry(SecretStr(token), SecretStr("y" * 32))
    access = registry.authenticate(token)

    class RevokingSessions:
        @contextmanager
        def open(self):
            registry.revoke(access.caller.principal_id)
            yield self

        def list(self, *, limit, after):
            return QuotationPage(items=(), next_cursor=None)

    service = QuotationService(RevokingSessions(), access, max_page_size=100)
    assert service.list().items == ()
    with pytest.raises(QuotationIdentityRequired):
        service.list()
