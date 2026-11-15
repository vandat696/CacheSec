"""Trusted initializer executed only inside the disposable Docker test server."""

import json
import sys
from pathlib import Path
from uuid import UUID

from pydantic import SecretStr

from app.artifacts.filesystem_blob_store import FileSystemBlobStore
from app.change_workflow.postgres_test_profile_administration import (
    PostgresTestProfileAdministration,
)
from app.change_workflow.test_profiles import load_test_profile
from app.control.database.control_migrations import apply_migrations
from app.control.repository_configuration import load_repository_binding
from app.identity.control_authority import ControlCapability, ControlPrincipal, control_token_digest
from app.identity.postgres_authority_administration import PostgresAuthorityAdministration
from app.quotation_demo.database.quotation_migrations import apply_migrations as app_migrations
from app.repositories.postgres_source_profiles import PostgresSourceProfileAdministration
from app.shared.postgres_connection import PostgresDatabase
from app.workspace_runtime.postgres_operations import PostgresOperations
from app.workspace_runtime.source_operations import TARGET_ID


def main():
    payload = json.load(sys.stdin)
    binding = load_repository_binding(Path("/config/repository.json"))
    database = PostgresDatabase(
        SecretStr(payload["dsn"]), connect_timeout_seconds=3, statement_timeout_ms=5000
    )
    profile = load_test_profile(Path("/config/profile.json"))
    scope = binding.profile.scope
    with database.connection() as connection:
        apply_migrations(connection)
        app_migrations(connection)
        admin = PostgresAuthorityAdministration(connection)
        admin.register_repository(scope, binding.profile.repository_identity)
        caller = ControlPrincipal(
            scope, UUID(payload["principal"]), 1, control_token_digest(payload["token"])
        )
        epoch = admin.configure_principal(caller, frozenset(ControlCapability), expected_epoch=1)
        epoch = PostgresSourceProfileAdministration(connection).set_profile(
            binding.profile, expected_epoch=epoch
        )
        PostgresTestProfileAdministration(
            connection, FileSystemBlobStore(Path("/store"))
        ).set_profile(scope, profile, expected_epoch=epoch)
        if not connection.execute(
            "SELECT 1 FROM pg_roles WHERE rolname='workspace_e2e_runtime'"
        ).fetchone():
            connection.execute(
                "CREATE ROLE workspace_e2e_runtime LOGIN PASSWORD 'isolated-test-only' "
                "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT"
            )
        connection.execute("GRANT USAGE ON SCHEMA quotation_demo TO workspace_e2e_runtime")
        connection.execute(
            "GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA quotation_demo TO workspace_e2e_runtime"
        )
        PostgresOperations(connection).add(
            scope,
            {
                "id": str(TARGET_ID),
                "kind": "target",
                "status": "baseline",
                "version": 0,
                "pending_id": None,
                "profile_digest": profile.digest,
                "config_digest": payload["config_digest"],
                "active_artifact": None,
                "container_name": None,
            },
        )
    print("Isolated authority/profile/target ready")


if __name__ == "__main__":
    main()
