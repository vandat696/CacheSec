"""Transactional schema migrations owned by the quotation app."""

import hashlib
from dataclasses import dataclass
from importlib.resources import files

import psycopg

_LOCK_ID = 87520261107
_MIGRATION_NAMES = ("001_create_quotations.sql", "002_creation_requests.sql")


class MigrationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Migration:
    name: str
    sql: str
    checksum: str


def load_migrations() -> tuple[Migration, ...]:
    directory = files("app.quotation_demo.persistence").joinpath("sql")
    migrations = []
    for name in _MIGRATION_NAMES:
        content = directory.joinpath(name).read_bytes().decode("utf-8").replace("\r\n", "\n")
        migrations.append(
            Migration(name, content, hashlib.sha256(content.encode("utf-8")).hexdigest())
        )
    return tuple(migrations)


def apply_migrations(connection: psycopg.Connection) -> tuple[str, ...]:
    """Apply one atomic batch; an existing outer transaction remains caller-owned."""
    migrations = load_migrations()
    with connection.transaction():
        connection.execute("SELECT pg_catalog.pg_advisory_xact_lock(%s)", (_LOCK_ID,))
        connection.execute("CREATE SCHEMA IF NOT EXISTS quotation_demo")
        connection.execute(
            "CREATE TABLE IF NOT EXISTS quotation_demo.schema_migrations ("
            "name text PRIMARY KEY, checksum text NOT NULL, "
            "applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
        installed = dict(
            connection.execute(
                "SELECT name, checksum FROM quotation_demo.schema_migrations"
            ).fetchall()
        )
        expected = {migration.name: migration.checksum for migration in migrations}
        if installed.keys() - expected.keys():
            raise MigrationError("Database has migrations unknown to this application version.")
        if any(expected[name] != checksum for name, checksum in installed.items()):
            raise MigrationError("An applied migration checksum has changed.")
        applied = []
        for migration in migrations:
            if migration.name in installed:
                continue
            connection.execute(migration.sql)
            connection.execute(
                "INSERT INTO quotation_demo.schema_migrations (name, checksum) VALUES (%s, %s)",
                (migration.name, migration.checksum),
            )
            applied.append(migration.name)
    return tuple(applied)
