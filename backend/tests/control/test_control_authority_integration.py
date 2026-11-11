from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from uuid import uuid4

import psycopg
import pytest

from app.control.database.control_migrations import apply_migrations
from app.identity.control_authority import (
    AuthorityConflict,
    ControlAccessDenied,
    ControlAuthorizer,
    ControlCapability,
    ControlIdentityRequired,
    ControlPrincipal,
    ControlResourceUnavailable,
    RepositoryAccessService,
    RepositoryScope,
    control_token_digest,
)
from app.identity.postgres_authority_administration import PostgresAuthorityAdministration
from app.identity.postgres_control_authority import (
    PostgresControlAuthorityRepository,
    PostgresControlAuthorityTransactions,
)

TOKEN = "test-only-control-token-" + "a" * 32
READ = frozenset({ControlCapability.REPOSITORY_READ})


@pytest.fixture
def registry(control_database):
    scope = RepositoryScope(uuid4(), uuid4())
    principal = ControlPrincipal(scope, uuid4(), 1, control_token_digest(TOKEN))
    with control_database.connection() as connection:
        apply_migrations(connection)
        admin = PostgresAuthorityAdministration(connection)
        assert admin.register_repository(scope, "test-repository").authority_epoch == 1
        assert admin.configure_principal(principal, READ, expected_epoch=1) == 2
    return control_database, scope, principal


def service(database):
    return RepositoryAccessService(PostgresControlAuthorityTransactions(database))


def test_real_registry_reads_current_capabilities_and_epoch(registry):
    database, scope, principal = registry
    assert service(database).describe(TOKEN, scope).authority_epoch == 2
    with database.connection() as connection:
        admin = PostgresAuthorityAdministration(connection)
        assert admin.configure_principal(principal, READ, expected_epoch=2) == 2
        assert admin.configure_principal(principal, frozenset(), expected_epoch=2) == 3
    with pytest.raises(ControlAccessDenied):
        service(database).describe(TOKEN, scope)


def test_scope_identity_cannot_be_remapped_or_crossed(registry):
    database, scope, _ = registry
    with pytest.raises(AuthorityConflict):
        with database.connection() as connection:
            PostgresAuthorityAdministration(connection).register_repository(scope, "different")
    assert service(database).describe(TOKEN, scope).identity == "test-repository"
    for other in (
        RepositoryScope(uuid4(), scope.repo_id),
        RepositoryScope(scope.tenant_id, uuid4()),
    ):
        with pytest.raises(ControlResourceUnavailable):
            service(database).describe(TOKEN, other)


def test_rotation_rejects_old_token_and_previously_authenticated_caller(registry):
    database, scope, principal = registry
    new_token = "b" * 40
    rotated = replace(principal, credential_version=2, token_digest=control_token_digest(new_token))
    with database.connection() as connection:
        admin = PostgresAuthorityAdministration(connection)
        assert admin.configure_principal(rotated, READ, expected_epoch=2) == 3
    with pytest.raises(ControlIdentityRequired):
        service(database).describe(TOKEN, scope)
    assert service(database).describe(new_token, scope).authority_epoch == 3
    with database.connection() as connection:
        with pytest.raises(ControlIdentityRequired):
            ControlAuthorizer().require(
                PostgresControlAuthorityRepository(connection), principal, scope, READ
            )


def test_disabled_principal_cannot_authenticate(registry):
    database, scope, principal = registry
    with database.connection() as connection:
        PostgresAuthorityAdministration(connection).configure_principal(
            replace(principal, active=False), READ, expected_epoch=2
        )
    with pytest.raises(ControlIdentityRequired):
        service(database).describe(TOKEN, scope)


def test_stale_configuration_and_non_monotonic_rotation_cannot_overwrite(registry):
    database, scope, principal = registry
    with pytest.raises(AuthorityConflict):
        with database.connection() as connection:
            PostgresAuthorityAdministration(connection).configure_principal(
                principal, frozenset(), expected_epoch=1
            )
    with pytest.raises(AuthorityConflict):
        with database.connection() as connection:
            PostgresAuthorityAdministration(connection).configure_principal(
                replace(principal, token_digest=control_token_digest("c" * 40)),
                READ,
                expected_epoch=2,
            )
    assert service(database).describe(TOKEN, scope).authority_epoch == 2


def test_admin_transaction_failure_rolls_back_principal_grants_and_epoch(registry):
    database, scope, principal = registry
    with pytest.raises(psycopg.errors.DivisionByZero):
        with database.connection() as connection:
            PostgresAuthorityAdministration(connection).configure_principal(
                principal, frozenset(), expected_epoch=2
            )
            connection.execute("SELECT 1/0")
    assert service(database).describe(TOKEN, scope).authority_epoch == 2


def test_global_token_uniqueness_and_composite_scope_foreign_key(registry):
    database, scope, principal = registry
    other = RepositoryScope(uuid4(), uuid4())
    with database.connection() as connection:
        PostgresAuthorityAdministration(connection).register_repository(other, "other")
    with pytest.raises(AuthorityConflict):
        with database.connection() as connection:
            PostgresAuthorityAdministration(connection).configure_principal(
                replace(principal, scope=other), READ, expected_epoch=1
            )
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        with database.connection() as connection:
            connection.execute(
                "INSERT INTO control.principal_grants VALUES (%s,%s,%s,%s)",
                (other.tenant_id, other.repo_id, principal.principal_id, "repository.read"),
            )


def test_authorization_holds_same_scope_lock_until_caller_transaction_commits(registry):
    database, scope, principal = registry
    with database.connection() as connection:
        authority = PostgresControlAuthorityRepository(connection)
        authorizer = ControlAuthorizer()
        caller = authorizer.authenticate(authority, TOKEN)
        assert authorizer.require(authority, caller, scope, READ).authority_epoch == 2
        with pytest.raises(psycopg.errors.LockNotAvailable):
            with database.connection() as competing:
                competing.execute("SET LOCAL lock_timeout = '100ms'")
                PostgresAuthorityAdministration(competing).configure_principal(
                    principal, frozenset(), expected_epoch=2
                )
    with database.connection() as connection:
        assert (
            PostgresAuthorityAdministration(connection).configure_principal(
                principal, frozenset(), expected_epoch=2
            )
            == 3
        )
    with pytest.raises(ControlAccessDenied):
        service(database).describe(TOKEN, scope)


def test_concurrent_configuration_uses_epoch_compare_and_set(registry):
    database, scope, principal = registry

    def configure(grants):
        try:
            with database.connection() as connection:
                return PostgresAuthorityAdministration(connection).configure_principal(
                    principal, grants, expected_epoch=2
                )
        except AuthorityConflict:
            return "conflict"

    with ThreadPoolExecutor(max_workers=2) as worker:
        results = list(worker.map(configure, [frozenset(), frozenset(ControlCapability)]))
    assert sorted(results, key=str) == [3, "conflict"]


def test_upgrade_from_blob_only_schema_preserves_bytes_metadata(control_database, monkeypatch):
    from app.control.database import control_migrations

    migrations = control_migrations.load_migrations()
    with monkeypatch.context() as patch:
        patch.setattr(control_migrations, "load_migrations", lambda: migrations[:1])
        with control_database.connection() as connection:
            assert apply_migrations(connection) == ("001_artifact_blobs.sql",)
            connection.execute(
                "INSERT INTO control.artifact_blobs (digest, byte_size) VALUES (%s,0)",
                ("sha256:" + "a" * 64,),
            )
    with control_database.connection() as connection:
        assert apply_migrations(connection) == (
            "002_control_authority.sql",
            "003_repository_snapshots.sql",
            "004_change_workflow.sql",
        )
        assert connection.execute("SELECT byte_size FROM control.artifact_blobs").fetchall() == [
            (0,)
        ]
        assert connection.execute("SELECT count(*) FROM control.principals").fetchone() == (0,)
        assert apply_migrations(connection) == ()
