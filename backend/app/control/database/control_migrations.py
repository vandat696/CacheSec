"""Control owns its history and lock independently of the quotation application."""

import psycopg

from app.shared.postgres_migrations import Migration, apply_schema_migrations, load_sql_migrations

_LOCK_ID = 87520261109


def load_migrations() -> tuple[Migration, ...]:
    return load_sql_migrations(
        "app.control.database", ("001_artifact_blobs.sql", "002_control_authority.sql")
    )


def apply_migrations(connection: psycopg.Connection) -> tuple[str, ...]:
    return apply_schema_migrations(
        connection, schema="control", lock_id=_LOCK_ID, migrations=load_migrations()
    )
