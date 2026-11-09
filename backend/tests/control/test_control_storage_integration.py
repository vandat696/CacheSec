from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from threading import Barrier

import psycopg
import pytest
from pydantic import SecretStr

from app.artifacts.blob_models import BlobIntegrityError, BlobMetadataUnavailable, content_digest
from app.artifacts.blob_storage_service import ArtifactBlobStorage
from app.artifacts.filesystem_blob_store import FileSystemBlobStore
from app.artifacts.postgres_blob_metadata import PostgresBlobMetadataTransactions
from app.control.control_settings import Settings
from app.control.database import control_migrations
from app.control.database.control_migrations import apply_migrations
from app.quotation_demo.database.quotation_migrations import apply_migrations as migrate_quotations
from app.shared.postgres_migrations import Migration, MigrationError


@pytest.fixture
def migrated(control_database):
    with control_database.connection() as connection:
        apply_migrations(connection)
    return control_database


def test_control_migration_replay_and_quotation_history_are_independent(control_database):
    with control_database.connection() as connection:
        original = migrate_quotations(connection)
        history = connection.execute(
            "SELECT name,checksum FROM quotation_demo.schema_migrations ORDER BY name"
        ).fetchall()
        assert apply_migrations(connection) == (
            "001_artifact_blobs.sql",
            "002_control_authority.sql",
            "003_repository_snapshots.sql",
        )
    with control_database.connection() as connection:
        assert apply_migrations(connection) == ()
        assert migrate_quotations(connection) == ()
        assert len(original) == 2
        assert (
            connection.execute(
                "SELECT name,checksum FROM quotation_demo.schema_migrations ORDER BY name"
            ).fetchall()
            == history
        )
        assert connection.execute("SELECT count(*) FROM quotation_demo.quotations").fetchone() == (
            0,
        )


def test_changed_control_history_is_rejected(migrated):
    with migrated.connection() as connection:
        connection.execute("UPDATE control.schema_migrations SET checksum = %s", ("0" * 64,))
    with pytest.raises(MigrationError):
        with migrated.connection() as connection:
            apply_migrations(connection)


def test_failed_control_batch_rolls_back_schema_and_history(control_database, monkeypatch):
    original = control_migrations.load_migrations()
    broken = Migration("002_broken.sql", "CREATE TABLE control.partial(id int); SELECT 1/0;", "x")
    with monkeypatch.context() as patch:
        patch.setattr(control_migrations, "load_migrations", lambda: (*original, broken))
        with pytest.raises(psycopg.errors.DivisionByZero):
            with control_database.connection() as connection:
                apply_migrations(connection)
    with control_database.connection() as connection:
        assert connection.execute("SELECT to_regnamespace('control')").fetchone() == (None,)
        assert apply_migrations(connection) == (
            "001_artifact_blobs.sql",
            "002_control_authority.sql",
            "003_repository_snapshots.sql",
        )


def test_parallel_control_migrators_install_one_batch(control_database):
    barrier = Barrier(2)

    def migrate():
        with control_database.connection() as connection:
            barrier.wait(timeout=10)
            return apply_migrations(connection)

    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(lambda _: migrate(), range(2)))
    assert sorted(results, key=len) == [
        (),
        tuple(migration.name for migration in control_migrations.load_migrations()),
    ]


def test_blob_publication_and_parallel_registration_commit_once(migrated, tmp_path):
    service = ArtifactBlobStorage(
        FileSystemBlobStore(tmp_path), PostgresBlobMetadataTransactions(migrated)
    )
    content = b"control test-only bytes\r\n"
    with ThreadPoolExecutor(max_workers=4) as workers:
        references = list(workers.map(lambda _: service.store(content), range(8)))
    assert len(set(references)) == 1
    assert service.read(references[0].digest) == content
    with migrated.connection() as connection:
        assert connection.execute("SELECT count(*) FROM control.artifact_blobs").fetchone() == (1,)
        assert connection.execute("SELECT count(*) FROM control.principals").fetchone() == (0,)


def test_factory_wires_explicit_settings_to_filesystem_and_postgres(
    migrated, tmp_path, monkeypatch
):
    from app.control import control_storage

    def configured_database(url, *, connect_timeout_seconds, statement_timeout_ms):
        assert url.get_secret_value() == "postgresql://test-only/fixture-mapped"
        assert connect_timeout_seconds == 3 and statement_timeout_ms == 5000
        return migrated

    monkeypatch.setattr(control_storage, "PostgresDatabase", configured_database)
    service = control_storage.create_artifact_blob_storage(
        Settings(
            _env_file=None,
            database_url=SecretStr("postgresql://test-only/fixture-mapped"),
            database_statement_timeout_ms=5000,
            control_artifact_root=tmp_path,
        )
    )
    reference = service.store(b"factory integration test")
    assert service.read(reference.digest) == b"factory integration test"


def test_bad_metadata_is_not_overwritten_or_returned(migrated, tmp_path):
    service = ArtifactBlobStorage(
        FileSystemBlobStore(tmp_path), PostgresBlobMetadataTransactions(migrated)
    )
    reference = service.store(b"original")
    with migrated.connection() as connection:
        connection.execute(
            "UPDATE control.artifact_blobs SET byte_size = byte_size + 1 WHERE digest = %s",
            (reference.digest,),
        )
    with pytest.raises(BlobIntegrityError):
        service.store(b"original")
    with pytest.raises(BlobIntegrityError):
        service.read(reference.digest)
    with migrated.connection() as connection:
        assert connection.execute(
            "SELECT byte_size FROM control.artifact_blobs WHERE digest = %s", (reference.digest,)
        ).fetchone() == (reference.byte_size + 1,)


def test_real_commit_failure_keeps_metadata_unregistered_and_bytes_orphaned(migrated, tmp_path):
    with migrated.connection() as connection:
        connection.execute(
            "CREATE TABLE control.commit_probe (digest text "
            "REFERENCES control.artifact_blobs(digest) "
            "DEFERRABLE INITIALLY DEFERRED)"
        )

    class FailingCommit:
        @contextmanager
        def connection(self):
            with migrated.connection() as connection:
                yield connection
                connection.execute(
                    "INSERT INTO control.commit_probe VALUES (%s)", (content_digest(b"absent"),)
                )

    store = FileSystemBlobStore(tmp_path)
    service = ArtifactBlobStorage(store, PostgresBlobMetadataTransactions(FailingCommit()))
    with pytest.raises(BlobMetadataUnavailable):
        service.store(b"not committed")
    with migrated.connection() as connection:
        assert connection.execute("SELECT count(*) FROM control.artifact_blobs").fetchone() == (0,)
    assert store.get(content_digest(b"not committed")) == b"not committed"
    service = ArtifactBlobStorage(store, PostgresBlobMetadataTransactions(migrated))
    assert service.read(service.store(b"not committed").digest) == b"not committed"


def test_control_raw_object_constraints_and_public_acl(migrated):
    for digest, size in [
        ("sha256:" + "a" * 64 + "\n", 1),
        ("../bad", 1),
        (content_digest(b"x"), -1),
        (content_digest(b"x"), 1048577),
    ]:
        with pytest.raises(psycopg.errors.CheckViolation):
            with migrated.connection() as connection:
                connection.execute(
                    "INSERT INTO control.artifact_blobs (digest,byte_size) VALUES (%s,%s)",
                    (digest, size),
                )
    with migrated.connection() as connection:
        assert connection.execute(
            "SELECT count(*) FROM pg_catalog.pg_class c, "
            "LATERAL pg_catalog.aclexplode(c.relacl) a "
            "WHERE c.oid = 'control.artifact_blobs'::regclass AND a.grantee = 0"
        ).fetchone() == (0,)
