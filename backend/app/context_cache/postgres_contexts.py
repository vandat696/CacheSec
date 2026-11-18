"""Context registry metadata and requests share the current authority transaction."""

from contextlib import contextmanager

import psycopg
from psycopg.types.json import Jsonb

from app.artifacts.postgres_blob_metadata import PostgresBlobMetadataRepository
from app.context_cache.context_contract import ContextError
from app.context_cache.context_repository import ContextSession
from app.identity.postgres_control_authority import PostgresControlAuthorityRepository
from app.repositories.postgres_repository_snapshots import PostgresSnapshotRepository
from app.repositories.repository_snapshots import SnapshotSession
from app.shared.postgres_connection import DatabaseNotConfigured


class PostgresContextRecords:
    def __init__(self, connection):
        self.connection = connection

    def add_request(self, scope, owner, record):
        self.connection.execute(
            "INSERT INTO control.context_requests (tenant_id,repo_id,owner_id,request_id,record) "
            "VALUES (%s,%s,%s,%s,%s)",
            (scope.tenant_id, scope.repo_id, owner, record["request_id"], Jsonb(record)),
        )

    def request(self, scope, owner, request_id):
        row = self.connection.execute(
            "SELECT record,resolution FROM control.context_requests "
            "WHERE tenant_id=%s AND repo_id=%s AND owner_id=%s AND request_id=%s FOR UPDATE",
            (scope.tenant_id, scope.repo_id, owner, request_id),
        ).fetchone()
        return {**row[0], "resolution": row[1]} if row else None

    def bind(self, scope, owner, request_id, resolution):
        self.connection.execute(
            "UPDATE control.context_requests SET resolution=%s WHERE tenant_id=%s AND repo_id=%s "
            "AND owner_id=%s AND request_id=%s AND resolution IS NULL",
            (Jsonb(resolution), scope.tenant_id, scope.repo_id, owner, request_id),
        )

    def add_entry(self, scope, owner, record):
        self.connection.execute(
            "INSERT INTO control.context_entries (tenant_id,repo_id,owner_id,entry_id,record) "
            "VALUES (%s,%s,%s,%s,%s)",
            (scope.tenant_id, scope.repo_id, owner, record["entry_id"], Jsonb(record)),
        )

    def entry(self, scope, owner, entry_id):
        row = self.connection.execute(
            "SELECT record FROM control.context_entries "
            "WHERE tenant_id=%s AND repo_id=%s AND owner_id=%s AND entry_id=%s",
            (scope.tenant_id, scope.repo_id, owner, entry_id),
        ).fetchone()
        return row[0] if row else None


class PostgresContextTransactions:
    def __init__(self, database):
        self.database = database

    @contextmanager
    def open(self):
        try:
            with self.database.connection() as connection:
                authority = PostgresControlAuthorityRepository(connection)
                yield ContextSession(
                    authority,
                    SnapshotSession(
                        authority,
                        PostgresBlobMetadataRepository(connection),
                        PostgresSnapshotRepository(connection),
                    ),
                    PostgresContextRecords(connection),
                )
        except (psycopg.Error, DatabaseNotConfigured) as error:
            raise ContextError("CONTEXT_STORAGE_UNAVAILABLE", 503) from error
