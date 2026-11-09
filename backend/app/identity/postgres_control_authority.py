"""PostgreSQL authority reads and shared scope lock, reusable within control transactions."""

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

import psycopg

from app.identity.control_authority import (
    ControlAuthorityUnavailable,
    ControlCapability,
    ControlPrincipal,
    RegisteredRepository,
    RepositoryScope,
)
from app.shared.postgres_connection import DatabaseNotConfigured, PostgresDatabase


def _principal(row: tuple | None) -> ControlPrincipal | None:
    if row is None:
        return None
    tenant_id, repo_id, principal_id, version, digest, active = row
    return ControlPrincipal(
        RepositoryScope(tenant_id, repo_id), principal_id, version, digest, active
    )


class PostgresControlAuthorityRepository:
    def __init__(self, connection: psycopg.Connection) -> None:
        self._connection = connection

    def lock_scope(self, scope: RepositoryScope) -> RegisteredRepository | None:
        row = self._connection.execute(
            "SELECT r.identity, a.epoch FROM control.scope_authorities a "
            "JOIN control.repositories r USING (tenant_id, repo_id) "
            "WHERE a.tenant_id=%s AND a.repo_id=%s FOR UPDATE OF a",
            (scope.tenant_id, scope.repo_id),
        ).fetchone()
        return RegisteredRepository(scope, *row) if row else None

    def find_credential(self, digest: bytes) -> ControlPrincipal | None:
        return _principal(
            self._connection.execute(
                "SELECT tenant_id, repo_id, principal_id, credential_version, token_digest, active "
                "FROM control.principals WHERE token_digest=%s",
                (digest,),
            ).fetchone()
        )

    def get_principal(self, scope: RepositoryScope, principal_id: UUID) -> ControlPrincipal | None:
        return _principal(
            self._connection.execute(
                "SELECT tenant_id, repo_id, principal_id, credential_version, token_digest, active "
                "FROM control.principals WHERE tenant_id=%s AND repo_id=%s AND principal_id=%s",
                (scope.tenant_id, scope.repo_id, principal_id),
            ).fetchone()
        )

    def capabilities(
        self, scope: RepositoryScope, principal_id: UUID
    ) -> frozenset[ControlCapability]:
        rows = self._connection.execute(
            "SELECT capability FROM control.principal_grants "
            "WHERE tenant_id=%s AND repo_id=%s AND principal_id=%s",
            (scope.tenant_id, scope.repo_id, principal_id),
        ).fetchall()
        return frozenset(ControlCapability(row[0]) for row in rows)


class PostgresControlAuthorityTransactions:
    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    @contextmanager
    def open(self) -> Iterator[PostgresControlAuthorityRepository]:
        try:
            with self._database.connection() as connection:
                yield PostgresControlAuthorityRepository(connection)
        except (psycopg.Error, DatabaseNotConfigured) as error:
            raise ControlAuthorityUnavailable("Control authority is unavailable.") from error
