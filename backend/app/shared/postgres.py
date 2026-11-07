"""Shared PostgreSQL connection adapter; independent of HTTP and business domains."""

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass

import psycopg
from pydantic import SecretStr


class DatabaseNotConfigured(RuntimeError):
    pass


class DatabaseProbeError(RuntimeError):
    pass


@dataclass(frozen=True)
class DatabaseInfo:
    postgresql_version: int
    pgvector_version: str | None


class PostgresDatabase:
    def __init__(
        self,
        url: SecretStr | None,
        *,
        connect_timeout_seconds: int,
        statement_timeout_ms: int,
    ) -> None:
        if connect_timeout_seconds < 2 or statement_timeout_ms < 1:
            raise ValueError("Database timeouts must be positive (connect timeout >= 2s).")
        self._url = url
        self._connect_timeout_seconds = connect_timeout_seconds
        self._statement_timeout_ms = statement_timeout_ms

    @contextmanager
    def connection(self) -> Iterator[psycopg.Connection]:
        """Commit on success, roll back on error, and close in both cases."""
        if self._url is None or not self._url.get_secret_value().strip():
            raise DatabaseNotConfigured("Database is not configured.")
        with psycopg.connect(
            self._url.get_secret_value(),
            connect_timeout=self._connect_timeout_seconds,
        ) as connection:
            connection.execute(
                "SELECT pg_catalog.set_config('statement_timeout', %s, false)",
                (str(self._statement_timeout_ms),),
            )
            yield connection

    def probe(self) -> DatabaseInfo:
        """Read server/extension metadata; do not create schema or install vector."""
        with self.connection() as connection:
            row = connection.execute(
                "SELECT pg_catalog.current_setting('server_version_num')::integer, "
                "(SELECT extversion FROM pg_catalog.pg_extension WHERE extname = 'vector')"
            ).fetchone()
        if row is None:
            raise DatabaseProbeError("Database probe returned no result.")
        return DatabaseInfo(postgresql_version=row[0], pgvector_version=row[1])
