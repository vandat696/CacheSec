from collections.abc import Iterator
from contextlib import contextmanager

import psycopg

from app.artifacts.blob_models import (
    BlobIntegrityError,
    BlobMetadataUnavailable,
    BlobReference,
    require_blob_digest,
)
from app.shared.postgres_connection import DatabaseNotConfigured, PostgresDatabase


class PostgresBlobMetadataRepository:
    def __init__(self, connection: psycopg.Connection) -> None:
        self._connection = connection

    def register(self, reference: BlobReference) -> None:
        self._connection.execute(
            "INSERT INTO control.artifact_blobs (digest, byte_size) VALUES (%s, %s) "
            "ON CONFLICT DO NOTHING",
            (reference.digest, reference.byte_size),
        )
        if self.get(reference.digest) != reference:
            raise BlobIntegrityError("Existing blob metadata does not match its content.")

    def get(self, digest: str) -> BlobReference | None:
        require_blob_digest(digest)
        row = self._connection.execute(
            "SELECT digest, byte_size FROM control.artifact_blobs WHERE digest = %s", (digest,)
        ).fetchone()
        return BlobReference(*row) if row else None


class PostgresBlobMetadataTransactions:
    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    @contextmanager
    def open(self) -> Iterator[PostgresBlobMetadataRepository]:
        try:
            with self._database.connection() as connection:
                yield PostgresBlobMetadataRepository(connection)
        except (psycopg.Error, DatabaseNotConfigured) as error:
            raise BlobMetadataUnavailable("Control blob metadata is unavailable.") from error
