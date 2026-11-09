"""Trusted activation of an exact source profile under the authority scope lock."""

import psycopg

from app.identity.control_authority import AuthorityConflict, ControlResourceUnavailable
from app.identity.postgres_control_authority import PostgresControlAuthorityRepository
from app.repositories.source_profiles import SourceProfile


class PostgresSourceProfileAdministration:
    """Caller owns commit/rollback; never auto-apply a worker's config at startup."""

    def __init__(self, connection: psycopg.Connection) -> None:
        self._connection = connection

    def set_profile(self, profile: SourceProfile, *, expected_epoch: int) -> int:
        scope = profile.scope
        repository = PostgresControlAuthorityRepository(self._connection).lock_scope(scope)
        if repository is None or repository.identity != profile.repository_identity:
            raise ControlResourceUnavailable()
        if type(expected_epoch) is not int or repository.authority_epoch != expected_epoch:
            raise AuthorityConflict("Authority has changed; reload before configuring source.")
        row = self._connection.execute(
            "SELECT profile_digest FROM control.repository_source_profiles "
            "WHERE tenant_id=%s AND repo_id=%s",
            (scope.tenant_id, scope.repo_id),
        ).fetchone()
        if row == (profile.digest,):
            return repository.authority_epoch
        self._connection.execute(
            "INSERT INTO control.repository_source_profiles (tenant_id,repo_id,profile_digest) "
            "VALUES (%s,%s,%s) ON CONFLICT (tenant_id,repo_id) DO UPDATE "
            "SET profile_digest=EXCLUDED.profile_digest",
            (scope.tenant_id, scope.repo_id, profile.digest),
        )
        return self._connection.execute(
            "UPDATE control.scope_authorities SET epoch=epoch+1 "
            "WHERE tenant_id=%s AND repo_id=%s RETURNING epoch",
            (scope.tenant_id, scope.repo_id),
        ).fetchone()[0]
