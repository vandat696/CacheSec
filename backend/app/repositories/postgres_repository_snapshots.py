"""Snapshot persistence, blob index and authority use exactly the same connection."""

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

import psycopg

from app.artifacts.blob_models import BlobReference
from app.artifacts.postgres_blob_metadata import PostgresBlobMetadataRepository
from app.identity.control_authority import RepositoryScope
from app.identity.postgres_control_authority import PostgresControlAuthorityRepository
from app.repositories.repository_snapshots import SnapshotSession
from app.repositories.snapshot_models import (
    RepositorySnapshot,
    SnapshotFile,
    SnapshotIntegrityError,
    SnapshotStorageUnavailable,
)
from app.repositories.source_profiles import MAX_SOURCE_FILES
from app.shared.postgres_connection import DatabaseNotConfigured, PostgresDatabase


class PostgresSnapshotRepository:
    def __init__(self, connection: psycopg.Connection) -> None:
        self._connection = connection

    def active_profile(self, scope: RepositoryScope) -> str | None:
        row = self._connection.execute(
            "SELECT profile_digest FROM control.repository_source_profiles "
            "WHERE tenant_id=%s AND repo_id=%s",
            (scope.tenant_id, scope.repo_id),
        ).fetchone()
        return row[0] if row else None

    def add(self, snapshot: RepositorySnapshot) -> None:
        scope = snapshot.scope
        self._connection.execute(
            "INSERT INTO control.snapshots (tenant_id,repo_id,snapshot_id,repository_identity,"
            "created_by,authority_epoch,profile_digest,profile_size,manifest_digest,manifest_size) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (
                scope.tenant_id,
                scope.repo_id,
                snapshot.snapshot_id,
                snapshot.repository_identity,
                snapshot.created_by,
                snapshot.authority_epoch,
                snapshot.profile_blob.digest,
                snapshot.profile_blob.byte_size,
                snapshot.manifest_blob.digest,
                snapshot.manifest_blob.byte_size,
            ),
        )
        for item in snapshot.files:
            self._connection.execute(
                "INSERT INTO control.snapshot_files "
                "(tenant_id,repo_id,snapshot_id,file_id,path,path_key,blob_digest,byte_size) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    scope.tenant_id,
                    scope.repo_id,
                    snapshot.snapshot_id,
                    item.file_id,
                    item.path,
                    item.path.lower(),
                    item.blob.digest,
                    item.blob.byte_size,
                ),
            )

    def get(self, scope: RepositoryScope, snapshot_id: UUID) -> RepositorySnapshot | None:
        row = self._connection.execute(
            "SELECT repository_identity,created_by,authority_epoch,profile_digest,profile_size,"
            "manifest_digest,manifest_size FROM control.snapshots "
            "WHERE tenant_id=%s AND repo_id=%s AND snapshot_id=%s",
            (scope.tenant_id, scope.repo_id, snapshot_id),
        ).fetchone()
        if row is None:
            return None
        files = self._connection.execute(
            "SELECT file_id,path,blob_digest,byte_size FROM control.snapshot_files "
            "WHERE tenant_id=%s AND repo_id=%s AND snapshot_id=%s "
            'ORDER BY path COLLATE "C" LIMIT %s',
            (scope.tenant_id, scope.repo_id, snapshot_id, MAX_SOURCE_FILES + 1),
        ).fetchall()
        identity, actor, epoch, profile_digest, profile_size, digest, size = row
        try:
            return RepositorySnapshot(
                scope,
                snapshot_id,
                identity,
                actor,
                epoch,
                BlobReference(profile_digest, profile_size),
                BlobReference(digest, size),
                tuple(
                    SnapshotFile(fid, path, BlobReference(blob, n)) for fid, path, blob, n in files
                ),
            )
        except ValueError as error:
            raise SnapshotIntegrityError("Stored snapshot records are invalid.") from error


class PostgresSnapshotTransactions:
    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    @contextmanager
    def open(self) -> Iterator[SnapshotSession]:
        try:
            with self._database.connection() as connection:
                yield SnapshotSession(
                    PostgresControlAuthorityRepository(connection),
                    PostgresBlobMetadataRepository(connection),
                    PostgresSnapshotRepository(connection),
                )
        except (psycopg.Error, DatabaseNotConfigured) as error:
            raise SnapshotStorageUnavailable("Snapshot storage is unavailable.") from error
