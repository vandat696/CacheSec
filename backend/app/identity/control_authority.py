"""Control identity and current scoped permissions; independent of HTTP and storage."""

import hashlib
import hmac
from contextlib import AbstractContextManager
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Protocol
from uuid import UUID


class ControlIdentityRequired(Exception):
    pass


class ControlAccessDenied(Exception):
    pass


class ControlResourceUnavailable(Exception):
    pass


class ControlAuthorityUnavailable(Exception):
    pass


class AuthorityConflict(Exception):
    pass


class ControlCapability(StrEnum):
    REPOSITORY_READ = "repository.read"
    WORKFLOW_RUN = "workflow.run"
    WORKFLOW_READ = "workflow.read"
    PROPOSAL_CREATE = "proposal.create"
    TEST_RUN = "test.run"
    DEPLOYMENT_READ = "deployment.read"
    CHANGE_REVIEW = "change.review"
    DEPLOYMENT_ACTIVATE = "deployment.activate"


@dataclass(frozen=True)
class RepositoryScope:
    tenant_id: UUID
    repo_id: UUID

    def __post_init__(self) -> None:
        if not isinstance(self.tenant_id, UUID) or not isinstance(self.repo_id, UUID):
            raise ValueError("Scope identifiers must be UUIDs.")


@dataclass(frozen=True)
class ControlPrincipal:
    """A backend fixture identity in exactly one repository scope, with no implicit roles."""

    scope: RepositoryScope
    principal_id: UUID
    credential_version: int
    token_digest: bytes = field(repr=False)
    active: bool = True

    def __post_init__(self) -> None:
        if (
            not isinstance(self.scope, RepositoryScope)
            or not isinstance(self.principal_id, UUID)
            or type(self.credential_version) is not int
            or self.credential_version < 1
            or type(self.token_digest) is not bytes
            or len(self.token_digest) != 32
            or type(self.active) is not bool
        ):
            raise ValueError("Invalid control principal.")


@dataclass(frozen=True)
class RegisteredRepository:
    scope: RepositoryScope
    identity: str
    authority_epoch: int


def control_token_digest(token: str) -> bytes:
    """Tokens must be independently generated secrets; hashing does not supply entropy."""
    if (
        type(token) is not str
        or not 32 <= len(token) <= 65536
        or not token.isascii()
        or not all(33 <= ord(char) <= 126 for char in token)
    ):
        raise ValueError(
            "Control token must be a non-whitespace ASCII secret of sufficient length."
        )
    return hashlib.sha256(token.encode("ascii")).digest()


class ControlAuthorityRepository(Protocol):
    def lock_scope(self, scope: RepositoryScope) -> RegisteredRepository | None: ...

    def find_credential(self, digest: bytes) -> ControlPrincipal | None: ...

    def get_principal(
        self, scope: RepositoryScope, principal_id: UUID
    ) -> ControlPrincipal | None: ...

    def capabilities(
        self, scope: RepositoryScope, principal_id: UUID
    ) -> frozenset[ControlCapability]: ...


class ControlAuthorityTransactions(Protocol):
    def open(self) -> AbstractContextManager[ControlAuthorityRepository]: ...


class ControlAuthorizer:
    """Use inside the caller's transaction, including future approval/permit transactions."""

    def authenticate(
        self, authority: ControlAuthorityRepository, token: str | None
    ) -> ControlPrincipal:
        if token is None:
            raise ControlIdentityRequired()
        try:
            digest = control_token_digest(token)
        except ValueError:
            raise ControlIdentityRequired() from None
        candidate = authority.find_credential(digest)
        if candidate is None:
            raise ControlIdentityRequired()
        if authority.lock_scope(candidate.scope) is None:
            raise ControlIdentityRequired()
        current = authority.get_principal(candidate.scope, candidate.principal_id)
        if (
            current is None
            or not current.active
            or not hmac.compare_digest(current.token_digest, digest)
        ):
            raise ControlIdentityRequired()
        return current

    def require(
        self,
        authority: ControlAuthorityRepository,
        caller: ControlPrincipal,
        scope: RepositoryScope,
        capabilities: frozenset[ControlCapability],
    ) -> RegisteredRepository:
        if caller.scope != scope:
            raise ControlResourceUnavailable()
        repository = authority.lock_scope(scope)
        if repository is None:
            raise ControlResourceUnavailable()
        current = authority.get_principal(scope, caller.principal_id)
        if (
            current is None
            or not current.active
            or current.credential_version != caller.credential_version
            or not hmac.compare_digest(current.token_digest, caller.token_digest)
        ):
            raise ControlIdentityRequired()
        if not capabilities <= authority.capabilities(scope, caller.principal_id):
            raise ControlAccessDenied()
        return repository


class RepositoryAccessService:
    def __init__(self, transactions: ControlAuthorityTransactions) -> None:
        self._transactions = transactions
        self._authorizer = ControlAuthorizer()

    def describe_current(self, token: str | None) -> RegisteredRepository:
        """Resolve the sole fixture scope from current authority, never from HTTP metadata."""
        with self._transactions.open() as authority:
            caller = self._authorizer.authenticate(authority, token)
            repository = self._authorizer.require(
                authority, caller, caller.scope, frozenset({ControlCapability.REPOSITORY_READ})
            )
        return repository

    def describe(self, token: str | None, scope: RepositoryScope) -> RegisteredRepository:
        with self._transactions.open() as authority:
            caller = self._authorizer.authenticate(authority, token)
            repository = self._authorizer.require(
                authority, caller, scope, frozenset({ControlCapability.REPOSITORY_READ})
            )
        return repository
