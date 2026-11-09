"""Transactional schema migrations owned by the quotation app."""

import psycopg

from app.shared.postgres_migrations import Migration as Migration
from app.shared.postgres_migrations import MigrationError as MigrationError
from app.shared.postgres_migrations import apply_schema_migrations, load_sql_migrations

_LOCK_ID = 87520261107
_MIGRATION_NAMES = ("001_create_quotations.sql", "002_creation_requests.sql")


def load_migrations() -> tuple[Migration, ...]:
    return load_sql_migrations("app.quotation_demo.database", _MIGRATION_NAMES)


def apply_migrations(connection: psycopg.Connection) -> tuple[str, ...]:
    """Apply one atomic batch; an existing outer transaction remains caller-owned."""
    return apply_schema_migrations(
        connection, schema="quotation_demo", lock_id=_LOCK_ID, migrations=load_migrations()
    )
