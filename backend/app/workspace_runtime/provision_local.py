"""Explicit administrator command over stdin; never invoked by API/worker startup."""

import json
import sys
import traceback

from psycopg import sql

from app.artifacts.filesystem_blob_store import FileSystemBlobStore
from app.change_workflow.postgres_test_profile_administration import (
    PostgresTestProfileAdministration,
)
from app.change_workflow.test_profiles import TechnicalTestProfile
from app.control.control_settings import settings
from app.control.database.control_migrations import apply_migrations
from app.control.repository_configuration import load_repository_binding
from app.identity.control_authority import ControlCapability as Cap
from app.identity.postgres_authority_administration import PostgresAuthorityAdministration
from app.identity.postgres_control_authority import PostgresControlAuthorityRepository
from app.shared.postgres_connection import PostgresDatabase
from app.workspace_runtime.postgres_operations import PostgresOperations
from app.workspace_runtime.source_operations import TARGET_ID


def provision(payload):
    binding = load_repository_binding(settings.control_repository_config)
    scope = binding.profile.scope
    profile = TechnicalTestProfile.from_metadata(payload["profile"])
    database = PostgresDatabase(
        settings.database_url,
        connect_timeout_seconds=settings.database_connect_timeout_seconds,
        statement_timeout_ms=settings.database_statement_timeout_ms,
    )
    with database.connection() as connection:
        apply_migrations(connection)
        authority = PostgresControlAuthorityRepository(connection)
        repository = authority.lock_scope(scope)
        if repository.authority_epoch != payload["expected_epoch"]:
            raise ValueError("Authority changed; reload before provisioning")
        caller = authority.find_credential(bytes.fromhex(payload["credential_digest"]))
        if caller is None or caller.scope != scope or not caller.active:
            raise ValueError("Existing local principal required")
        operations = PostgresOperations(connection)
        target = operations.get(scope, TARGET_ID)
        if target and (target.get("pending_id") or target["version"] != 0):
            raise ValueError("Do not replace an active/pending target profile")
        existing = connection.execute(
            "SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,"
            "shobj_description(r.oid,'pg_authid') FROM pg_roles r "
            "WHERE rolname='cachesec_workspace_app'"
        ).fetchone()
        if existing and (any(existing[:4]) or existing[4] != "CacheSec local runtime"):
            raise ValueError("Runtime role exists with a different owner/purpose")
        if not existing:
            connection.execute(
                "CREATE ROLE cachesec_workspace_app LOGIN NOSUPERUSER "
                "NOCREATEDB NOCREATEROLE NOINHERIT"
            )
            connection.execute("COMMENT ON ROLE cachesec_workspace_app IS 'CacheSec local runtime'")
        connection.execute(
            sql.SQL("ALTER ROLE cachesec_workspace_app PASSWORD {}").format(
                sql.Literal(payload["runtime_password"])
            )
        )
        connection.execute("GRANT USAGE ON SCHEMA quotation_demo TO cachesec_workspace_app")
        connection.execute(
            "GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA quotation_demo TO cachesec_workspace_app"
        )
        epoch = PostgresAuthorityAdministration(connection).configure_principal(
            caller,
            authority.capabilities(scope, caller.principal_id)
            | {
                Cap.REPOSITORY_WRITE,
                Cap.DEPLOYMENT_READ,
                Cap.CHANGE_REVIEW,
                Cap.DEPLOYMENT_ACTIVATE,
            },
            expected_epoch=repository.authority_epoch,
        )
        epoch = PostgresTestProfileAdministration(
            connection, FileSystemBlobStore(settings.control_artifact_root)
        ).set_profile(scope, profile, expected_epoch=epoch)
        record = {
            "id": str(TARGET_ID),
            "kind": "target",
            "status": "baseline",
            "version": 0,
            "pending_id": None,
            "profile_digest": profile.digest,
            "config_digest": payload["config_digest"],
            "active_artifact": None,
            "container_name": None,
        }
        if target:
            operations.update(scope, record)
        else:
            operations.add(scope, record)
    return {"authority_epoch": epoch, "profile_digest": profile.digest, "target_version": 0}


def main():
    try:
        raw = sys.stdin.buffer.read(131073)
        if len(raw) > 131072:
            raise ValueError("Provision request too large")
        print(json.dumps(provision(json.loads(raw))))
    except Exception as error:
        locations = [
            (frame.name, frame.lineno) for frame in traceback.extract_tb(error.__traceback__)
        ]
        print(
            json.dumps({"error_type": type(error).__name__, "locations": locations}),
            file=sys.stderr,
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
