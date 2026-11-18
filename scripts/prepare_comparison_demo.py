"""Prepare an isolated, persistent technical demo; never approve or activate a change.

Run from the repository: backend/.venv/Scripts/python scripts/prepare_comparison_demo.py ROOT
ROOT must be a new child of backend/.local. Dev source, target and credentials stay intact.
"""

# ruff: noqa: E402

import json
import os
import secrets
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from uuid import uuid4

from check_comparison_baseline import check_baseline

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import psycopg
from app.artifacts.filesystem_blob_store import FileSystemBlobStore
from app.artifacts.metadata_encoding import metadata_digest
from app.change_workflow.postgres_test_profile_administration import (
    PostgresTestProfileAdministration,
)
from app.change_workflow.test_profiles import (
    EDITABLE_PATH,
    OVERLAY_PATHS,
    load_test_profile,
)
from app.control.control_settings import Settings
from app.control.database.control_migrations import apply_migrations
from app.identity.control_authority import (
    ControlCapability,
    ControlPrincipal,
    RepositoryScope,
    control_token_digest,
)
from app.identity.postgres_authority_administration import (
    PostgresAuthorityAdministration,
)
from app.quotation_demo.database.quotation_migrations import (
    apply_migrations as app_migrations,
)
from app.repositories.postgres_source_profiles import (
    PostgresSourceProfileAdministration,
)
from app.repositories.source_profiles import SourceProfile
from app.shared.postgres_connection import PostgresDatabase
from app.testing.docker_commands import docker
from app.testing.image_inventory import verify_images
from app.workspace_runtime.docker_runtime import runtime_configuration
from app.workspace_runtime.postgres_operations import PostgresOperations
from app.workspace_runtime.source_operations import TARGET_ID
from psycopg import sql
from psycopg.conninfo import make_conninfo
from pydantic import SecretStr

BASELINE_COMMIT = "4924398"


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def start_process(arguments, cwd, environment, log):
    with log.open("ab") as output:
        process = subprocess.Popen(
            arguments,
            cwd=cwd,
            env={**os.environ, **environment},
            stdin=subprocess.DEVNULL,
            stdout=output,
            stderr=output,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
    return process.pid


def wait_http(url, headers=None):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(80):
        try:
            with opener.open(
                urllib.request.Request(url, headers=headers or {}), timeout=2
            ) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.25)
    raise RuntimeError("Demo service did not become ready; inspect its private log")


def main():
    root = Path(sys.argv[1]).resolve()
    local = (ROOT / "backend/.local").resolve()
    if not root.is_relative_to(local) or root == local:
        raise ValueError("Demo must use a new directory below backend/.local")
    for port in (18000, 18001, 3100):
        with socket.socket() as check:
            check.bind(("127.0.0.1", port))
    profile = load_test_profile(local / "test-profile.json")
    verify_images(profile)
    key_file = local / "agent-config/gemini.env"
    if not key_file.is_file():
        raise ValueError("Private Gemini configuration is required")
    settings = Settings(_env_file=ROOT / "backend/.env")
    if settings.database_url is None:
        raise ValueError("Database configuration is required")
    baseline = subprocess.run(
        ["git", "show", f"{BASELINE_COMMIT}:{EDITABLE_PATH}"],
        cwd=ROOT,
        capture_output=True,
        check=True,
    ).stdout
    baseline_commit = (
        subprocess.run(
            ["git", "rev-parse", BASELINE_COMMIT],
            cwd=ROOT,
            capture_output=True,
            check=True,
        )
        .stdout.decode()
        .strip()
    )
    if b"flags=()," not in baseline or b"evaluated_rules=()," not in baseline:
        raise ValueError("The pinned baseline is not the expected original validator")
    root.mkdir(parents=True, exist_ok=False)
    source, store, worker = (root / name for name in ("project", "store", "worker"))
    frozen_baseline = root / "baseline"
    store.mkdir()
    worker.mkdir()
    for path in OVERLAY_PATHS:
        target = source / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(
            baseline if path == EDITABLE_PATH else (ROOT / path).read_bytes()
        )
        frozen = frozen_baseline / path
        frozen.parent.mkdir(parents=True, exist_ok=True)
        frozen.write_bytes(target.read_bytes())
    suffix = uuid4().hex[:12]
    database_name, role = "cachesec_demo_" + suffix, "cachesec_demo_app_" + suffix
    network = "cachesec-comparison-" + suffix
    token, worker_key, app_token, reader_token, app_password = (
        secrets.token_hex(32) for _ in range(5)
    )
    scope, principal_id, worker_id = RepositoryScope(uuid4(), uuid4()), uuid4(), uuid4()
    configuration = {
        "tenant_id": str(scope.tenant_id),
        "repo_id": str(scope.repo_id),
        "repository_identity": "comparison-demo-" + suffix,
        "root": str(source),
        "paths": list(OVERLAY_PATHS),
    }
    write_json(root / "repository.json", configuration)
    write_json(root / "profile.json", profile.metadata())
    (root / "worker.key").write_text(worker_key, encoding="ascii")
    app_environment = {
        "QUOTATION_DATABASE_URL": make_conninfo(
            host="db", port=5432, dbname=database_name, user=role, password=app_password
        ),
        "QUOTATION_FIXTURE_READER_TOKEN": reader_token,
        "QUOTATION_FIXTURE_OPERATOR_TOKEN": app_token,
        "QUOTATION_REFERENCE_DATE": "2026-11-07",
        "QUOTATION_CORS_ORIGINS": '["http://127.0.0.1:3100"]',
    }
    app_env_file = root / "app.env"
    app_env_file.write_text(
        "".join(f"{name}={value}\n" for name, value in app_environment.items()),
        encoding="utf-8",
    )
    runtime = {
        "network": network,
        "port": 18001,
        "environment_file": str(app_env_file),
        "baseline_image": profile.runtime_image,
    }
    dsn = make_conninfo(settings.database_url.get_secret_value(), dbname=database_name)
    manifest = {
        "root": str(root),
        "database": database_name,
        "runtime_role": role,
        "network": network,
        "baseline_commit": baseline_commit,
        "source_paths": list(OVERLAY_PATHS),
        "status": "preparing",
        "processes": {},
    }
    write_json(root / "manifest.json", manifest)
    with psycopg.connect(
        settings.database_url.get_secret_value(), autocommit=True
    ) as admin:
        admin.execute(
            sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name))
        )
        admin.execute(
            sql.SQL(
                "CREATE ROLE {} LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT"
            ).format(sql.Identifier(role), sql.Literal(app_password))
        )
    database = PostgresDatabase(
        SecretStr(dsn), connect_timeout_seconds=3, statement_timeout_ms=5000
    )
    source_profile = SourceProfile(
        scope, configuration["repository_identity"], OVERLAY_PATHS
    )
    with database.connection() as connection:
        apply_migrations(connection)
        app_migrations(connection)
        admin = PostgresAuthorityAdministration(connection)
        admin.register_repository(scope, source_profile.repository_identity)
        epoch = admin.configure_principal(
            ControlPrincipal(scope, principal_id, 1, control_token_digest(token)),
            frozenset(ControlCapability),
            expected_epoch=1,
        )
        epoch = PostgresSourceProfileAdministration(connection).set_profile(
            source_profile, expected_epoch=epoch
        )
        PostgresTestProfileAdministration(
            connection, FileSystemBlobStore(store)
        ).set_profile(scope, profile, expected_epoch=epoch)
        connection.execute(
            sql.SQL("GRANT USAGE ON SCHEMA quotation_demo TO {}").format(
                sql.Identifier(role)
            )
        )
        connection.execute(
            sql.SQL(
                "GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA quotation_demo TO {}"
            ).format(sql.Identifier(role))
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
                "config_digest": metadata_digest(
                    runtime_configuration(runtime, profile)
                ),
                "active_artifact": None,
                "container_name": None,
            },
        )
    docker(
        [
            "network",
            "create",
            "--internal",
            "--label",
            "cachesec.demo=" + suffix,
            network,
        ]
    )
    docker(["network", "connect", "--alias", "db", network, "cachesec-db-1"])
    if check_baseline(root) != {"ready": True}:
        raise ValueError("Baseline did not pass its readiness check")
    env = {
        "DATABASE_URL": dsn,
        "CONTROL_ARTIFACT_ROOT": str(store),
        "CONTROL_REPOSITORY_CONFIG": str(root / "repository.json"),
        "CONTROL_TEST_PROFILE_CONFIG": str(root / "profile.json"),
        "CONTROL_TEST_WORKER_TOKEN": worker_key,
        "CONTROL_AGENT_CONFIG": str(key_file),
        "CONTROL_AGENT_PROVIDER": "gemini",
        "DATABASE_STATEMENT_TIMEOUT_MS": "5000",
        "CORS_ORIGINS": '["http://127.0.0.1:3100"]',
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    write_json(root / "control-environment.json", env)
    write_json(
        root / "access.json", {"control_token": token, "quotation_token": app_token}
    )
    write_json(
        root / "worker.json",
        {
            "api_url": "http://127.0.0.1:18000",
            "worker_id": str(worker_id),
            "workspace_root": str(worker),
            "credential_file": str(root / "worker.key"),
            "source_root": str(source),
            "runtime": runtime,
        },
    )
    python = str(ROOT / "backend/.venv/Scripts/python.exe")
    manifest["processes"]["control"] = start_process(
        [
            python,
            "-m",
            "uvicorn",
            "app.control.control_api:app",
            "--host",
            "127.0.0.1",
            "--port",
            "18000",
            "--no-access-log",
        ],
        ROOT / "backend",
        env,
        root / "control.log",
    )
    write_json(root / "manifest.json", manifest)
    wait_http("http://127.0.0.1:18000/health")
    manifest["processes"]["worker"] = start_process(
        [python, "-m", "app.testing.test_worker", str(root / "worker.json")],
        ROOT / "backend",
        {},
        root / "worker.log",
    )
    write_json(root / "manifest.json", manifest)
    node = (
        subprocess.run(["where.exe", "node"], capture_output=True, check=True)
        .stdout.decode()
        .splitlines()[0]
    )
    frontend_env = {
        "NEXT_PUBLIC_CONTROL_API_URL": "http://127.0.0.1:18000",
        "NEXT_PUBLIC_QUOTATION_API_URL": "http://127.0.0.1:18001",
    }
    manifest["processes"]["frontend"] = start_process(
        [
            node,
            str(ROOT / "frontend/node_modules/next/dist/bin/next"),
            "dev",
            "--hostname",
            "127.0.0.1",
            "--port",
            "3100",
        ],
        ROOT / "frontend",
        frontend_env,
        root / "frontend.log",
    )
    write_json(root / "manifest.json", manifest)
    wait_http("http://127.0.0.1:3100/workspace")
    manifest["status"] = "ready-awaiting-human-approval"
    write_json(root / "manifest.json", manifest)
    print(
        json.dumps(
            {
                "status": manifest["status"],
                "root": str(root),
                "workspace": "http://127.0.0.1:3100/workspace",
                "approval_target_port": 18001,
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 -- sanitize failures containing private configuration
        print(
            json.dumps(
                {
                    "status": "error",
                    "error_type": type(error).__name__,
                    "message": (
                        "Demo preparation stopped; inspect the private manifest/logs. "
                        "No approval or activation was requested."
                    ),
                }
            )
        )
        raise SystemExit(1) from None
