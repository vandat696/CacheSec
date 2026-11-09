"""CLI entrypoint: python -m app.control.migrate_control."""

import json

import psycopg
from pydantic import ValidationError

from app.control.control_settings import Settings
from app.control.database.control_migrations import apply_migrations
from app.shared.postgres_connection import DatabaseNotConfigured, PostgresDatabase
from app.shared.postgres_migrations import MigrationError


def main() -> int:
    try:
        settings = Settings()
        database = PostgresDatabase(
            settings.database_url,
            connect_timeout_seconds=settings.database_connect_timeout_seconds,
            statement_timeout_ms=settings.database_statement_timeout_ms,
        )
        with database.connection() as connection:
            applied = apply_migrations(connection)
    except ValidationError:
        code = "INVALID_CONFIGURATION"
    except DatabaseNotConfigured:
        code = "DATABASE_NOT_CONFIGURED"
    except MigrationError:
        code = "MIGRATION_HISTORY_MISMATCH"
    except psycopg.Error:
        code = "DATABASE_MIGRATION_FAILED"
    else:
        print(json.dumps({"status": "ok", "scope": "control", "applied": applied}))
        return 0
    print(json.dumps({"status": "error", "code": code}))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
