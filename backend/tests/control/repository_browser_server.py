"""Opt-in temporary HTTP server for the existing host browser smoke runner.

Creates/drops a fresh test DB; never provisions the database named by the source DSN.
Run only with CACHESEC_TEST_DATABASE_URL and a test-only browser token.
"""

import json
import os
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import psycopg
import uvicorn
from psycopg import sql
from psycopg.conninfo import make_conninfo
from pydantic import SecretStr

from app.control.configure_repository import configure_read_only_repository
from app.control.control_api import create_app
from app.control.control_settings import Settings
from app.control.database.control_migrations import apply_migrations
from app.control.repository_configuration import load_repository_binding
from app.identity.control_authority import ControlPrincipal, control_token_digest
from app.identity.postgres_authority_administration import PostgresAuthorityAdministration
from app.shared.postgres_connection import PostgresDatabase


def main():
    token = os.environ["CACHESEC_BROWSER_CONTROL_TOKEN"]
    if not token.startswith("test-only-"):
        raise ValueError("A test-only token is required.")
    database_name = "cachesec_test_control_browser_" + uuid4().hex
    with psycopg.connect(os.environ["CACHESEC_TEST_DATABASE_URL"], autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
        try:
            dsn = SecretStr(
                make_conninfo(os.environ["CACHESEC_TEST_DATABASE_URL"], dbname=database_name)
            )
            database = PostgresDatabase(dsn, connect_timeout_seconds=3, statement_timeout_ms=5000)
            with database.connection() as connection:
                apply_migrations(connection)
            with TemporaryDirectory() as temporary:
                root = Path(temporary)
                source = root / "source"
                source.mkdir()
                business = Path(__file__).resolve().parents[2] / "app/quotation_demo/business"
                for name in (
                    "quotation_models.py",
                    "quotation_service.py",
                    "quotation_validation.py",
                ):
                    shutil.copyfile(business / name, source / name)
                (source / "binary.bin").write_bytes(b"\x00\xff\n")
                config = root / "repository.json"
                config.write_text(
                    json.dumps(
                        {
                            "tenant_id": str(uuid4()),
                            "repo_id": str(uuid4()),
                            "repository_identity": "browser-test-quotation-source",
                            "root": str(source),
                            "paths": [
                                "binary.bin",
                                "quotation_models.py",
                                "quotation_service.py",
                                "quotation_validation.py",
                            ],
                        }
                    ),
                    encoding="utf-8",
                )
                binding = load_repository_binding(config)
                configure_read_only_repository(
                    database,
                    binding,
                    uuid4(),
                    token,
                    credential_version=1,
                    expected_epoch=0,
                )
                with database.connection() as connection:
                    PostgresAuthorityAdministration(connection).configure_principal(
                        ControlPrincipal(
                            binding.profile.scope,
                            uuid4(),
                            1,
                            control_token_digest(token + "-denied"),
                        ),
                        frozenset(),
                        expected_epoch=3,
                    )
                app = create_app(
                    Settings(
                        _env_file=None,
                        database_url=dsn,
                        control_repository_config=config,
                        control_artifact_root=root / "store",
                        cors_origins=["http://127.0.0.1:3100"],
                    )
                )
                uvicorn.run(
                    app,
                    host=os.environ.get("CACHESEC_BROWSER_BIND", "127.0.0.1"),
                    port=8000,
                    access_log=False,
                    log_level="warning",
                )
        finally:
            admin.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(database_name)))


if __name__ == "__main__":
    main()
