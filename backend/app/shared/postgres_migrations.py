"""SQL migration mechanics shared by independent application schemas."""

import hashlib
from dataclasses import dataclass
from importlib.resources import files

import psycopg
from psycopg import sql


class MigrationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Migration:
    name: str
    sql: str
    checksum: str


def load_sql_migrations(package: str, names: tuple[str, ...]) -> tuple[Migration, ...]:
    directory = files(package).joinpath("migrations")
    result = []
    for name in names:
        content = directory.joinpath(name).read_bytes().decode("utf-8").replace("\r\n", "\n")
        result.append(Migration(name, content, hashlib.sha256(content.encode("utf-8")).hexdigest()))
    return tuple(result)


def apply_schema_migrations(
    connection: psycopg.Connection,
    *,
    schema: str,
    lock_id: int,
    migrations: tuple[Migration, ...],
) -> tuple[str, ...]:
    """Apply one atomic batch; any outer transaction remains owned by the caller."""
    history = sql.Identifier(schema, "schema_migrations")
    with connection.transaction():
        connection.execute("SELECT pg_catalog.pg_advisory_xact_lock(%s)", (lock_id,))
        connection.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(schema)))
        connection.execute(
            sql.SQL(
                "CREATE TABLE IF NOT EXISTS {} (name text PRIMARY KEY, checksum text NOT NULL, "
                "applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)"
            ).format(history)
        )
        installed = dict(
            connection.execute(sql.SQL("SELECT name, checksum FROM {}").format(history)).fetchall()
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
                sql.SQL("INSERT INTO {} (name, checksum) VALUES (%s, %s)").format(history),
                (migration.name, migration.checksum),
            )
            applied.append(migration.name)
    return tuple(applied)
