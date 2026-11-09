from contextlib import contextmanager
from dataclasses import replace
from uuid import uuid4

import psycopg
import pytest

from app.identity.control_authority import (
    ControlAccessDenied,
    ControlAuthorityUnavailable,
    ControlAuthorizer,
    ControlCapability,
    ControlIdentityRequired,
    ControlPrincipal,
    ControlResourceUnavailable,
    RegisteredRepository,
    RepositoryAccessService,
    RepositoryScope,
    control_token_digest,
)
from app.identity.postgres_control_authority import PostgresControlAuthorityTransactions
from app.shared.postgres_connection import DatabaseNotConfigured

TOKEN = "test-only-control-token-" + "a" * 32
READ = frozenset({ControlCapability.REPOSITORY_READ})


class MemoryAuthority:
    def __init__(self):
        self.scope = RepositoryScope(uuid4(), uuid4())
        self.principal = ControlPrincipal(self.scope, uuid4(), 1, control_token_digest(TOKEN))
        self.grants = READ
        self.epoch = 1
        self.commit_failure = False
        self.after_find = lambda: None

    @contextmanager
    def open(self):
        yield self
        if self.commit_failure:
            raise ControlAuthorityUnavailable()

    def lock_scope(self, scope):
        assert scope == self.scope
        return RegisteredRepository(scope, "test-repository", self.epoch)

    def find_credential(self, digest):
        result = self.principal if self.principal.token_digest == digest else None
        self.after_find()
        return result

    def get_principal(self, scope, principal_id):
        assert scope == self.scope
        return self.principal if principal_id == self.principal.principal_id else None

    def capabilities(self, scope, principal_id):
        assert scope == self.scope
        assert principal_id == self.principal.principal_id
        return self.grants


def test_replacement_adapter_and_current_grants_without_cached_allow():
    authority = MemoryAuthority()
    service = RepositoryAccessService(authority)
    assert service.describe(TOKEN, authority.scope).identity == "test-repository"
    authority.grants = frozenset()
    with pytest.raises(ControlAccessDenied):
        service.describe(TOKEN, authority.scope)


@pytest.mark.parametrize(
    "token",
    [None, "", "a" * 31, " " * 40, "é" * 40, "a" * 65537, "z" * 40],
    ids=["missing", "empty", "short", "whitespace", "unicode", "oversized", "unknown"],
)
def test_missing_invalid_or_foreign_credentials_fail_closed(token):
    authority = MemoryAuthority()
    with pytest.raises(ControlIdentityRequired):
        RepositoryAccessService(authority).describe(token, authority.scope)


def test_other_tenant_or_repository_is_unavailable():
    authority = MemoryAuthority()
    for scope in (
        RepositoryScope(uuid4(), authority.scope.repo_id),
        RepositoryScope(authority.scope.tenant_id, uuid4()),
    ):
        with pytest.raises(ControlResourceUnavailable):
            RepositoryAccessService(authority).describe(TOKEN, scope)


def test_developer_does_not_implicitly_have_review_or_deployment_authority():
    authority = MemoryAuthority()
    authorizer = ControlAuthorizer()
    caller = authorizer.authenticate(authority, TOKEN)
    for capability in (ControlCapability.CHANGE_REVIEW, ControlCapability.DEPLOYMENT_ACTIVATE):
        with pytest.raises(ControlAccessDenied):
            authorizer.require(authority, caller, authority.scope, frozenset({capability}))


def test_explicit_reviewer_grant_can_authorize_same_human_and_is_rechecked():
    authority = MemoryAuthority()
    authorizer = ControlAuthorizer()
    caller = authorizer.authenticate(authority, TOKEN)
    review = frozenset({ControlCapability.CHANGE_REVIEW})
    authority.grants = READ | review
    assert authorizer.require(authority, caller, authority.scope, review).scope == authority.scope
    authority.grants = READ
    with pytest.raises(ControlAccessDenied):
        authorizer.require(authority, caller, authority.scope, review)


def test_recheck_rejects_previously_authenticated_rotated_or_disabled_identity():
    authority = MemoryAuthority()
    authorizer = ControlAuthorizer()
    caller = authorizer.authenticate(authority, TOKEN)
    authority.principal = replace(caller, credential_version=2)
    with pytest.raises(ControlIdentityRequired):
        authorizer.require(authority, caller, authority.scope, READ)
    authority.principal = replace(caller, active=False)
    with pytest.raises(ControlIdentityRequired):
        authorizer.require(authority, caller, authority.scope, READ)


def test_token_rotated_between_lookup_and_scope_lock_is_rejected():
    authority = MemoryAuthority()

    def rotate():
        authority.principal = replace(
            authority.principal, credential_version=2, token_digest=control_token_digest("b" * 32)
        )

    authority.after_find = rotate
    with pytest.raises(ControlIdentityRequired):
        RepositoryAccessService(authority).describe(TOKEN, authority.scope)


def test_commit_failure_does_not_return_a_repository():
    authority = MemoryAuthority()
    authority.commit_failure = True
    with pytest.raises(ControlAuthorityUnavailable):
        RepositoryAccessService(authority).describe(TOKEN, authority.scope)


def test_tokens_and_digests_are_not_in_identity_repr():
    authority = MemoryAuthority()
    assert TOKEN not in repr(authority.principal)
    assert repr(authority.principal.token_digest) not in repr(authority.principal)


@pytest.mark.parametrize("failure", [DatabaseNotConfigured(), psycopg.OperationalError("private")])
def test_database_open_and_commit_errors_are_sanitized(failure):
    class FailingDatabase:
        @contextmanager
        def connection(self):
            if isinstance(failure, DatabaseNotConfigured):
                raise failure
            yield object()
            raise failure

    transactions = PostgresControlAuthorityTransactions(FailingDatabase())
    with pytest.raises(ControlAuthorityUnavailable) as error:
        with transactions.open():
            pass
    assert "private" not in str(error.value)


def test_transaction_adapter_preserves_programming_errors():
    class Database:
        @contextmanager
        def connection(self):
            yield object()

    with pytest.raises(ValueError, match="programming error"):
        with PostgresControlAuthorityTransactions(Database()).open():
            raise ValueError("programming error")
