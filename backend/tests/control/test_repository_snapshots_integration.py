from contextlib import contextmanager
from dataclasses import replace
from types import SimpleNamespace
from uuid import uuid4

import psycopg
import pytest

from app.artifacts.blob_models import BlobIntegrityError, BlobStorageNotConfigured
from app.artifacts.filesystem_blob_store import FileSystemBlobStore
from app.control.control_settings import Settings
from app.control.control_snapshots import create_repository_snapshot_service
from app.control.database import control_migrations
from app.control.database.control_migrations import apply_migrations
from app.identity.control_authority import (
    AuthorityConflict,
    ControlAccessDenied,
    ControlCapability,
    ControlPrincipal,
    ControlResourceUnavailable,
    RepositoryScope,
    control_token_digest,
)
from app.identity.postgres_authority_administration import PostgresAuthorityAdministration
from app.repositories.filesystem_repository_source import (
    FileSystemRepositorySource,
    RepositorySourceBinding,
)
from app.repositories.postgres_repository_snapshots import PostgresSnapshotTransactions
from app.repositories.postgres_source_profiles import PostgresSourceProfileAdministration
from app.repositories.repository_snapshots import RepositorySnapshotService
from app.repositories.snapshot_models import SnapshotIntegrityError, SnapshotStorageUnavailable
from app.repositories.source_profiles import SourceProfile

TOKEN = "test-only-snapshot-token-" + "a" * 32
READ = frozenset({ControlCapability.REPOSITORY_READ})


@pytest.fixture
def snapshot_setup(control_database, tmp_path):
    scope = RepositoryScope(uuid4(), uuid4())
    principal = ControlPrincipal(scope, uuid4(), 1, control_token_digest(TOKEN))
    with control_database.connection() as connection:
        apply_migrations(connection)
        admin = PostgresAuthorityAdministration(connection)
        admin.register_repository(scope, "test-repository")
        admin.configure_principal(principal, READ, expected_epoch=1)
    root = tmp_path / "repo"
    root.mkdir()
    (root / "app.py").write_bytes(b"before\r\n\x00")
    (root / ".env").write_bytes(b"test-only-excluded-secret")
    profile = SourceProfile(scope, "test-repository", ("app.py",))
    with control_database.connection() as connection:
        assert (
            PostgresSourceProfileAdministration(connection).set_profile(profile, expected_epoch=2)
            == 3
        )
    binding = RepositorySourceBinding(profile, root)
    source = FileSystemRepositorySource((binding,))
    store = FileSystemBlobStore(tmp_path / "store")
    service = RepositorySnapshotService(
        PostgresSnapshotTransactions(control_database), source, store
    )
    return SimpleNamespace(
        database=control_database,
        scope=scope,
        principal=principal,
        source=source,
        binding=binding,
        store=store,
        service=service,
        root=root,
    )


def test_real_capture_reads_saved_bytes_after_working_tree_changes(snapshot_setup):
    env = snapshot_setup
    first = env.service.capture(TOKEN, env.scope)
    assert env.service.get(TOKEN, env.scope, first.snapshot_id) == first
    (env.root / "app.py").write_bytes(b"after\n")
    second = env.service.capture(TOKEN, env.scope)
    assert first.manifest_blob != second.manifest_blob
    assert (
        env.service.read_file(TOKEN, env.scope, first.snapshot_id, first.files[0].file_id)
        == b"before\r\n\x00"
    )
    with env.database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM control.snapshots").fetchone() == (2,)
        assert connection.execute("SELECT count(*) FROM control.snapshot_files").fetchone() == (2,)
        # Two source versions, one profile, two manifests; .env bytes were never published.
        assert connection.execute("SELECT count(*) FROM control.artifact_blobs").fetchone() == (5,)


def test_bundle_preparation_uses_saved_bytes_with_real_database(snapshot_setup, tmp_path):
    from app.repositories.filesystem_snapshot_workspace import FileSystemSnapshotWorkspace

    env = snapshot_setup
    snapshot = env.service.capture(TOKEN, env.scope)
    (env.root / "app.py").write_bytes(b"working tree changed\n")
    bundle = env.service.read_bundle(TOKEN, env.scope, snapshot.snapshot_id)
    workspaces = FileSystemSnapshotWorkspace(tmp_path / "prepared")
    first = workspaces.prepare(bundle)
    second = workspaces.prepare(bundle)
    assert first.directory != second.directory
    assert (first.source_root / "app.py").read_bytes() == b"before\r\n\x00"
    workspaces.verify(first)
    assert first.snapshot.manifest_blob == snapshot.manifest_blob
    with env.database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM control.snapshots").fetchone() == (1,)


def test_bundle_holds_authority_lock_for_all_bytes_and_rechecks_revoke(snapshot_setup, monkeypatch):
    env = snapshot_setup
    snapshot = env.service.capture(TOKEN, env.scope)
    original = env.store.get
    reads = []

    def read(digest):
        if not reads:
            with pytest.raises(psycopg.errors.LockNotAvailable):
                with env.database.connection() as competing:
                    competing.execute("SET LOCAL lock_timeout = '100ms'")
                    PostgresAuthorityAdministration(competing).configure_principal(
                        env.principal,
                        frozenset(),
                        expected_epoch=3,
                    )
        reads.append(digest)
        return original(digest)

    monkeypatch.setattr(env.store, "get", read)
    assert env.service.read_bundle(TOKEN, env.scope, snapshot.snapshot_id).snapshot == snapshot
    assert snapshot.files[0].blob.digest in reads
    with env.database.connection() as connection:
        PostgresAuthorityAdministration(connection).configure_principal(
            env.principal,
            frozenset(),
            expected_epoch=3,
        )
    reads.clear()
    with pytest.raises(ControlAccessDenied):
        env.service.read_bundle(TOKEN, env.scope, snapshot.snapshot_id)
    assert reads == []


def test_bundle_is_not_returned_when_real_read_transaction_commit_fails(
    snapshot_setup, monkeypatch
):
    from app.repositories.postgres_repository_snapshots import PostgresSnapshotRepository

    env = snapshot_setup
    snapshot = env.service.capture(TOKEN, env.scope)
    with env.database.connection() as connection:
        connection.execute("CREATE TABLE control.bundle_commit_parent (id integer PRIMARY KEY)")
        connection.execute(
            "CREATE TABLE control.bundle_commit_child (parent integer REFERENCES "
            "control.bundle_commit_parent(id) DEFERRABLE INITIALLY DEFERRED)"
        )
    original = PostgresSnapshotRepository.get

    def inject_deferred_error(repository, scope, snapshot_id):
        loaded = original(repository, scope, snapshot_id)
        repository._connection.execute("INSERT INTO control.bundle_commit_child VALUES (1)")
        return loaded

    with monkeypatch.context() as patch:
        patch.setattr(PostgresSnapshotRepository, "get", inject_deferred_error)
        with pytest.raises(SnapshotStorageUnavailable):
            env.service.read_bundle(TOKEN, env.scope, snapshot.snapshot_id)
    with env.database.connection() as connection:
        assert connection.execute(
            "SELECT count(*) FROM control.bundle_commit_child"
        ).fetchone() == (0,)
    assert env.service.read_bundle(TOKEN, env.scope, snapshot.snapshot_id).snapshot == snapshot


def test_revocation_blocks_capture_and_existing_file_reads(snapshot_setup):
    env = snapshot_setup
    snapshot = env.service.capture(TOKEN, env.scope)
    with env.database.connection() as connection:
        PostgresAuthorityAdministration(connection).configure_principal(
            env.principal, frozenset(), expected_epoch=3
        )
    with pytest.raises(ControlAccessDenied):
        env.service.capture(TOKEN, env.scope)
    with pytest.raises(ControlAccessDenied):
        env.service.read_file(TOKEN, env.scope, snapshot.snapshot_id, snapshot.files[0].file_id)


def test_profile_activation_blocks_stale_workers_and_old_snapshots(snapshot_setup, monkeypatch):
    env = snapshot_setup
    snapshot = env.service.capture(TOKEN, env.scope)
    updated = replace(env.binding.profile, max_file_bytes=100)
    with env.database.connection() as connection:
        admin = PostgresSourceProfileAdministration(connection)
        assert admin.set_profile(env.binding.profile, expected_epoch=3) == 3
        assert admin.set_profile(updated, expected_epoch=3) == 4
    with pytest.raises(AuthorityConflict):
        with env.database.connection() as connection:
            PostgresSourceProfileAdministration(connection).set_profile(
                env.binding.profile, expected_epoch=3
            )
    with monkeypatch.context() as patch:

        def unexpected_access(*args):
            pytest.fail("Stale worker must stop before source/bytes access.")

        patch.setattr(env.source, "capture", unexpected_access)
        patch.setattr(env.store, "get", unexpected_access)
        with pytest.raises(ControlResourceUnavailable):
            env.service.capture(TOKEN, env.scope)
        with pytest.raises(ControlResourceUnavailable):
            env.service.get(TOKEN, env.scope, snapshot.snapshot_id)
    source = FileSystemRepositorySource((replace(env.binding, profile=updated),))
    current = RepositorySnapshotService(
        PostgresSnapshotTransactions(env.database), source, env.store
    )
    assert current.capture(TOKEN, env.scope).profile_blob.digest == updated.digest


def test_source_profile_reconfiguration_rolls_back_with_authority_epoch(snapshot_setup):
    env = snapshot_setup
    updated = replace(env.binding.profile, max_file_bytes=100)
    with pytest.raises(psycopg.errors.DivisionByZero):
        with env.database.connection() as connection:
            PostgresSourceProfileAdministration(connection).set_profile(updated, expected_epoch=3)
            connection.execute("SELECT 1/0")
    assert env.service.capture(TOKEN, env.scope).authority_epoch == 3


def test_other_scope_cannot_reuse_snapshot_or_file_id(snapshot_setup, monkeypatch):
    env = snapshot_setup
    snapshot = env.service.capture(TOKEN, env.scope)
    other = RepositoryScope(uuid4(), uuid4())
    other_token = "b" * 40
    principal = ControlPrincipal(other, uuid4(), 1, control_token_digest(other_token))
    with env.database.connection() as connection:
        admin = PostgresAuthorityAdministration(connection)
        admin.register_repository(other, "other-repository")
        admin.configure_principal(principal, READ, expected_epoch=1)

    def unexpected_read(digest):
        pytest.fail("Cross-scope lookup must stop before reading any blob.")

    monkeypatch.setattr(env.store, "get", unexpected_read)
    with pytest.raises(ControlResourceUnavailable):
        env.service.get(other_token, other, snapshot.snapshot_id)
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        with env.database.connection() as connection:
            item = snapshot.files[0]
            connection.execute(
                "INSERT INTO control.snapshot_files VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    other.tenant_id,
                    other.repo_id,
                    snapshot.snapshot_id,
                    uuid4(),
                    item.path,
                    item.path.lower(),
                    item.blob.digest,
                    item.blob.byte_size,
                ),
            )


def test_database_rejects_case_duplicate_and_wrong_blob_size(snapshot_setup):
    env = snapshot_setup
    snapshot = env.service.capture(TOKEN, env.scope)
    item = snapshot.files[0]
    for path, size, error in (
        ("APP.py", item.blob.byte_size, psycopg.errors.UniqueViolation),
        ("other.py", item.blob.byte_size + 1, psycopg.errors.ForeignKeyViolation),
    ):
        with pytest.raises(error):
            with env.database.connection() as connection:
                connection.execute(
                    "INSERT INTO control.snapshot_files VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                    (
                        env.scope.tenant_id,
                        env.scope.repo_id,
                        snapshot.snapshot_id,
                        uuid4(),
                        path,
                        path.lower(),
                        item.blob.digest,
                        size,
                    ),
                )


def test_tampered_sql_metadata_and_blob_bytes_fail_integrity_checks(snapshot_setup):
    env = snapshot_setup
    snapshot = env.service.capture(TOKEN, env.scope)
    with env.database.connection() as connection:
        connection.execute("UPDATE control.snapshot_files SET path='other.py',path_key='other.py'")
    with pytest.raises(SnapshotIntegrityError):
        env.service.get(TOKEN, env.scope, snapshot.snapshot_id)
    with env.database.connection() as connection:
        connection.execute("UPDATE control.snapshot_files SET path='app.py',path_key='app.py'")
    path = env.store._path(snapshot.files[0].blob.digest, create=False)
    path.write_bytes(b"corrupted")
    with pytest.raises(BlobIntegrityError):
        env.service.read_file(TOKEN, env.scope, snapshot.snapshot_id, snapshot.files[0].file_id)


def test_real_commit_failure_rolls_back_snapshot_files_and_blob_index(snapshot_setup):
    env = snapshot_setup
    with env.database.connection() as connection:
        connection.execute("CREATE TABLE control.commit_probe (epoch bigint PRIMARY KEY)")
        connection.execute(
            "ALTER TABLE control.snapshots ADD CONSTRAINT commit_probe_fk "
            "FOREIGN KEY (authority_epoch) REFERENCES control.commit_probe(epoch) "
            "DEFERRABLE INITIALLY DEFERRED"
        )
    with pytest.raises(SnapshotStorageUnavailable):
        env.service.capture(TOKEN, env.scope)
    with env.database.connection() as connection:
        for table in ("snapshots", "snapshot_files", "artifact_blobs"):
            assert connection.execute("SELECT count(*) FROM control." + table).fetchone() == (0,)
        connection.execute("INSERT INTO control.commit_probe VALUES (3)")
    assert tuple((env.store._root / "blobs" / "sha256").iterdir())
    snapshot = env.service.capture(TOKEN, env.scope)
    assert env.service.get(TOKEN, env.scope, snapshot.snapshot_id) == snapshot


def test_snapshot_transaction_keeps_authority_lock_until_commit(snapshot_setup):
    env = snapshot_setup
    transactions = PostgresSnapshotTransactions(env.database)
    original = env.source.capture

    def capture(profile):
        with pytest.raises(psycopg.errors.LockNotAvailable):
            with env.database.connection() as competing:
                competing.execute("SET LOCAL lock_timeout = '100ms'")
                PostgresAuthorityAdministration(competing).configure_principal(
                    env.principal, frozenset(), expected_epoch=3
                )
        return original(profile)

    env.source.capture = capture
    snapshot = RepositorySnapshotService(transactions, env.source, env.store).capture(
        TOKEN, env.scope
    )
    assert snapshot.authority_epoch == 3


def test_factory_requires_explicit_roots_and_wires_real_transactions(snapshot_setup, monkeypatch):
    import app.control.control_snapshots as module

    env = snapshot_setup
    monkeypatch.setattr(module, "PostgresDatabase", lambda *args, **kwargs: env.database)
    settings = Settings(
        _env_file=None, database_url="postgresql://unused", control_artifact_root=env.store._root
    )
    service = create_repository_snapshot_service(settings, (env.binding,))
    snapshot = service.capture(TOKEN, env.scope)
    assert service.get(TOKEN, env.scope, snapshot.snapshot_id) == snapshot
    with pytest.raises(BlobStorageNotConfigured):
        create_repository_snapshot_service(Settings(_env_file=None, database_url=None), ())
    with pytest.raises(ValueError):
        create_repository_snapshot_service(settings, (replace(env.binding, root=env.store._root),))


def test_upgrade_from_registry_preserves_registry_and_migration_history(
    control_database, monkeypatch
):
    migrations = control_migrations.load_migrations()
    scope = RepositoryScope(uuid4(), uuid4())
    with monkeypatch.context() as patch:
        patch.setattr(control_migrations, "load_migrations", lambda: migrations[:2])
        with control_database.connection() as connection:
            apply_migrations(connection)
            PostgresAuthorityAdministration(connection).register_repository(
                scope, "test-repository"
            )
            before = connection.execute(
                "SELECT name,checksum FROM control.schema_migrations ORDER BY name"
            ).fetchall()
    with control_database.connection() as connection:
        assert apply_migrations(connection) == (
            "003_repository_snapshots.sql",
            "004_change_workflow.sql",
        )
        assert connection.execute("SELECT identity FROM control.repositories").fetchall() == [
            ("test-repository",)
        ]
        after = dict(
            connection.execute("SELECT name,checksum FROM control.schema_migrations").fetchall()
        )
        assert all(after[name] == checksum for name, checksum in before)
        assert apply_migrations(connection) == ()


def test_transaction_dependency_errors_are_sanitized_and_programming_errors_preserved():
    class FailingDatabase:
        @contextmanager
        def connection(self):
            yield object()
            raise psycopg.OperationalError("private database information")

    with pytest.raises(SnapshotStorageUnavailable) as error:
        with PostgresSnapshotTransactions(FailingDatabase()).open():
            pass
    assert "private" not in str(error.value)
    with pytest.raises(ValueError, match="programming error"):
        with PostgresSnapshotTransactions(FailingDatabase()).open():
            raise ValueError("programming error")
