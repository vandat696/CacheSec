"""Trusted backend administration only. Never exposed as a browser/Agent operation."""

import psycopg

from app.identity.control_authority import (
    AuthorityConflict,
    ControlCapability,
    ControlPrincipal,
    ControlResourceUnavailable,
    RegisteredRepository,
    RepositoryScope,
)
from app.identity.postgres_control_authority import PostgresControlAuthorityRepository


class PostgresAuthorityAdministration:
    """Caller owns the transaction/commit. No implicit provisioning or stale startup overwrite."""

    def __init__(self, connection: psycopg.Connection) -> None:
        self._connection = connection
        self._authority = PostgresControlAuthorityRepository(connection)

    def register_repository(self, scope: RepositoryScope, identity: str) -> RegisteredRepository:
        if (
            type(identity) is not str
            or not 1 <= len(identity) <= 128
            or not identity.isascii()
            or not all(33 <= ord(char) <= 126 for char in identity)
        ):
            raise ValueError("Repository identity must be a nonempty opaque ASCII identifier.")
        self._connection.execute(
            "INSERT INTO control.repositories (tenant_id, repo_id, identity) VALUES (%s,%s,%s) "
            "ON CONFLICT DO NOTHING",
            (scope.tenant_id, scope.repo_id, identity),
        )
        self._connection.execute(
            "INSERT INTO control.scope_authorities (tenant_id, repo_id) "
            "SELECT tenant_id, repo_id FROM control.repositories "
            "WHERE tenant_id=%s AND repo_id=%s ON CONFLICT DO NOTHING",
            (scope.tenant_id, scope.repo_id),
        )
        repository = self._authority.lock_scope(scope)
        if repository is None or repository.identity != identity:
            raise AuthorityConflict("Repository identity is already registered differently.")
        return repository

    def configure_principal(
        self,
        principal: ControlPrincipal,
        capabilities: frozenset[ControlCapability],
        *,
        expected_epoch: int,
    ) -> int:
        if any(type(capability) is not ControlCapability for capability in capabilities):
            raise ValueError("Unknown control capability.")
        scope = principal.scope
        repository = self._authority.lock_scope(scope)
        if repository is None:
            raise ControlResourceUnavailable()
        if type(expected_epoch) is not int or repository.authority_epoch != expected_epoch:
            raise AuthorityConflict("Authority has changed; reload before configuring.")
        current = self._authority.get_principal(scope, principal.principal_id)
        existing_grants = self._authority.capabilities(scope, principal.principal_id)
        if current == principal and existing_grants == capabilities:
            return repository.authority_epoch
        if current is not None:
            if principal.credential_version < current.credential_version or (
                principal.token_digest != current.token_digest
                and principal.credential_version <= current.credential_version
            ):
                raise AuthorityConflict("Credential rotation requires a newer version.")
        duplicate = self._authority.find_credential(principal.token_digest)
        if duplicate is not None and (
            duplicate.scope != scope or duplicate.principal_id != principal.principal_id
        ):
            raise AuthorityConflict("Credential is already registered.")
        self._connection.execute(
            "INSERT INTO control.principals "
            "(tenant_id,repo_id,principal_id,credential_version,token_digest,active) "
            "VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (tenant_id,repo_id,principal_id) "
            "DO UPDATE SET credential_version=EXCLUDED.credential_version, "
            "token_digest=EXCLUDED.token_digest, active=EXCLUDED.active",
            (
                scope.tenant_id,
                scope.repo_id,
                principal.principal_id,
                principal.credential_version,
                principal.token_digest,
                principal.active,
            ),
        )
        self._connection.execute(
            "DELETE FROM control.principal_grants WHERE tenant_id=%s AND repo_id=%s "
            "AND principal_id=%s",
            (scope.tenant_id, scope.repo_id, principal.principal_id),
        )
        for capability in sorted(capabilities):
            self._connection.execute(
                "INSERT INTO control.principal_grants "
                "(tenant_id,repo_id,principal_id,capability) VALUES (%s,%s,%s,%s)",
                (scope.tenant_id, scope.repo_id, principal.principal_id, capability.value),
            )
        row = self._connection.execute(
            "UPDATE control.scope_authorities SET epoch=epoch+1 "
            "WHERE tenant_id=%s AND repo_id=%s RETURNING epoch",
            (scope.tenant_id, scope.repo_id),
        ).fetchone()
        return row[0]
