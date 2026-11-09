"""CLI entrypoint: python -m app.quotation_demo.migrate_quotations."""

import json

import psycopg
from pydantic import ValidationError

from app.quotation_demo.database.quotation_migrations import MigrationError, apply_migrations
from app.quotation_demo.quotation_settings import QuotationSettings
from app.shared.postgres_connection import DatabaseNotConfigured, PostgresDatabase


def main() -> int:
    try:
        settings = QuotationSettings()
        database = PostgresDatabase(
            settings.database_url,
            connect_timeout_seconds=settings.database_connect_timeout_seconds,
            statement_timeout_ms=settings.database_statement_timeout_ms,
        )
        with database.connection() as connection:
            applied = apply_migrations(connection)
    except ValidationError:
        print(json.dumps({"status": "error", "code": "INVALID_CONFIGURATION"}))
        return 1
    except DatabaseNotConfigured:
        print(json.dumps({"status": "error", "code": "DATABASE_NOT_CONFIGURED"}))
        return 1
    except MigrationError:
        print(json.dumps({"status": "error", "code": "MIGRATION_HISTORY_MISMATCH"}))
        return 1
    except psycopg.Error:
        print(json.dumps({"status": "error", "code": "DATABASE_MIGRATION_FAILED"}))
        return 1
    print(json.dumps({"status": "ok", "scope": "quotation_demo", "applied": applied}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
