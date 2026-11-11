import base64
import json
from dataclasses import replace
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.control import control_api
from app.control.configure_repository import configure_read_only_repository
from app.control.control_settings import Settings
from app.control.database.control_migrations import apply_migrations
from app.control.repository_configuration import load_repository_binding
from app.identity.control_authority import (
    AuthorityConflict,
    ControlCapability,
    ControlPrincipal,
    RepositoryAccessService,
    control_token_digest,
)
from app.identity.postgres_authority_administration import PostgresAuthorityAdministration
from app.repositories.filesystem_repository_source import FileSystemRepositorySource
from app.repositories.postgres_source_profiles import PostgresSourceProfileAdministration

TOKEN = "test-only-control-http-" + "a" * 32
BASE = "/api/v1/repository"
AUTH = {"Authorization": f"Bearer {TOKEN}", "Origin": "http://127.0.0.1:3000"}


@pytest.fixture
def http_setup(control_database, tmp_path, monkeypatch):
    root = tmp_path / "source"
    root.mkdir()
    (root / "code.py").write_bytes(b"print('snapshot')\r\n\x00\xff")
    config = tmp_path / "repository.json"
    config.write_text(
        json.dumps(
            {
                "tenant_id": str(uuid4()),
                "repo_id": str(uuid4()),
                "repository_identity": "http-test-repository",
                "root": str(root),
                "paths": ["code.py"],
            }
        ),
        encoding="utf-8",
    )
    binding = load_repository_binding(config)
    principal_id = uuid4()
    with control_database.connection() as connection:
        apply_migrations(connection)
    assert (
        configure_read_only_repository(
            control_database,
            binding,
            principal_id,
            TOKEN,
            credential_version=1,
            expected_epoch=0,
        )
        == 3
    )
    monkeypatch.setattr(control_api, "PostgresDatabase", lambda *args, **kwargs: control_database)
    # Snapshot composition uses its own database constructor.
    from app.control import control_snapshots

    monkeypatch.setattr(control_snapshots, "PostgresDatabase", lambda *a, **k: control_database)
    settings = Settings(
        _env_file=None,
        database_url="postgresql://test-only-unused",
        control_artifact_root=tmp_path / "store",
        control_repository_config=config,
    )
    app = control_api.create_app(settings)
    with TestClient(app) as client:
        yield SimpleNamespace(
            client=client,
            database=control_database,
            binding=binding,
            principal_id=principal_id,
            root=root,
            config=config,
            app=app,
        )


def capture(env):
    response = env.client.post(BASE + "/snapshots", headers=AUTH)
    assert response.status_code == 201, response.text
    return response.json()["data"]


def routes(snapshot):
    return [
        BASE,
        f"{BASE}/snapshots/{snapshot['snapshot_id']}",
        f"{BASE}/snapshots/{snapshot['snapshot_id']}/files/{snapshot['files'][0]['file_id']}",
    ]


def test_http_saved_bytes_no_store_scope_and_cors(http_setup):
    env = http_setup
    description = env.client.get(BASE, headers=AUTH)
    assert description.json()["data"]["repo_id"] == str(env.binding.profile.scope.repo_id)
    saved = capture(env)
    (env.root / "code.py").write_bytes(b"changed\n")
    for path in routes(saved):
        response = env.client.get(path, headers=AUTH)
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-request-id"] == response.json()["meta"]["request_id"]
        assert response.headers["access-control-allow-origin"] == AUTH["Origin"]
        assert TOKEN not in response.text and str(env.root) not in response.text
    content = response.json()["data"]
    assert content["encoding"] == "base64"
    assert base64.b64decode(content["content"]) == b"print('snapshot')\r\n\x00\xff"
    assert capture(env)["manifest_digest"] != saved["manifest_digest"]
    assert env.client.get(routes(saved)[1], headers=AUTH).json()["data"] == saved


def test_http_rechecks_revoke_disable_rotation_and_never_uses_app_token(http_setup, monkeypatch):
    env = http_setup
    saved = capture(env)

    def forbidden_io(*args):
        pytest.fail("Denied HTTP request must not capture source.")

    monkeypatch.setattr(FileSystemRepositorySource, "capture", forbidden_io)
    for token in (None, "quotation-test-token", "Basic abc", "Bearer short", "Bearer " + "x" * 40):
        headers = {} if token is None else {"Authorization": token}
        for path in routes(saved):
            response = env.client.get(path, headers=headers)
            assert response.status_code == 401
            assert response.headers["www-authenticate"] == "Bearer"
    principal = ControlPrincipal(
        env.binding.profile.scope,
        env.principal_id,
        1,
        control_token_digest(TOKEN),
    )
    with env.database.connection() as connection:
        admin = PostgresAuthorityAdministration(connection)
        assert admin.configure_principal(principal, frozenset(), expected_epoch=3) == 4
    for path in routes(saved):
        assert env.client.get(path, headers=AUTH).status_code == 403
    assert env.client.post(BASE + "/snapshots", headers=AUTH).status_code == 403
    with env.database.connection() as connection:
        admin = PostgresAuthorityAdministration(connection)
        admin.configure_principal(
            replace(principal, credential_version=2, token_digest=control_token_digest("b" * 40)),
            frozenset({ControlCapability.REPOSITORY_READ}),
            expected_epoch=4,
        )
    assert env.client.get(BASE, headers=AUTH).status_code == 401


def test_http_rejects_scope_path_role_and_body_injection(http_setup):
    env = http_setup
    for query in ("?tenant_id=" + str(uuid4()), "?root=C:/", "?role=reviewer", "?path=../.env"):
        assert env.client.post(BASE + "/snapshots" + query, headers=AUTH).status_code == 400
    for payload in (b"null", b"{}", b'{"path":"code.py"}', b"x" * 65537):
        response = env.client.post(BASE + "/snapshots", headers=AUTH, content=payload)
        assert response.status_code == (413 if len(payload) > 65536 else 400)
    assert (
        env.client.post(
            BASE + "/snapshots",
            headers=AUTH,
            content=iter([b'{"root":', b'"arbitrary"}']),
        ).status_code
        == 400
    )
    schema = env.client.get("/openapi.json").json()
    assert "FileContentResponse" in schema["components"]["schemas"]
    with env.database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM control.snapshots").fetchone() == (0,)
    saved = capture(env)
    assert env.client.get(BASE + "/snapshots/not-a-uuid", headers=AUTH).status_code == 400
    unknown = f"{BASE}/snapshots/{saved['snapshot_id']}/files/{uuid4()}"
    assert env.client.get(unknown, headers=AUTH).status_code == 404


def test_revocation_between_http_scope_resolution_and_capture_is_rechecked(http_setup, monkeypatch):
    env = http_setup
    original = RepositoryAccessService.describe_current

    def resolve_then_revoke(self, token):
        repository = original(self, token)
        with env.database.connection() as connection:
            PostgresAuthorityAdministration(connection).configure_principal(
                ControlPrincipal(
                    env.binding.profile.scope, env.principal_id, 1, control_token_digest(TOKEN)
                ),
                frozenset(),
                expected_epoch=3,
            )
        return repository

    def forbidden_io(*args):
        pytest.fail("Snapshot must recheck revoke committed after HTTP scope resolution.")

    monkeypatch.setattr(RepositoryAccessService, "describe_current", resolve_then_revoke)
    monkeypatch.setattr(FileSystemRepositorySource, "capture", forbidden_io)
    assert env.client.post(BASE + "/snapshots", headers=AUTH).status_code == 403
    with env.database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM control.snapshots").fetchone() == (0,)


def test_http_other_scope_cannot_read_ids_even_with_valid_token(http_setup):
    env = http_setup
    saved = capture(env)
    profile = replace(env.binding.profile, scope=type(env.binding.profile.scope)(uuid4(), uuid4()))
    other_binding = replace(env.binding, profile=profile)
    configure_read_only_repository(
        env.database,
        other_binding,
        uuid4(),
        "b" * 40,
        credential_version=1,
        expected_epoch=0,
    )
    for path in routes(saved)[1:]:
        response = env.client.get(path, headers={"Authorization": "Bearer " + "b" * 40})
        assert response.status_code == 404
        assert saved["snapshot_id"] not in response.text


def test_http_stale_profile_tamper_and_unexpected_errors_fail_closed(http_setup, monkeypatch):
    env = http_setup
    saved = capture(env)
    from app.artifacts.filesystem_blob_store import FileSystemBlobStore

    original = FileSystemBlobStore.get
    target = saved["files"][0]["digest"]
    monkeypatch.setattr(
        FileSystemBlobStore,
        "get",
        lambda self, digest: b"tampered" if digest == target else original(self, digest),
    )
    assert env.client.get(routes(saved)[2], headers=AUTH).status_code == 503
    monkeypatch.setattr(FileSystemBlobStore, "get", original)
    with env.database.connection() as connection:
        PostgresSourceProfileAdministration(connection).set_profile(
            replace(env.binding.profile, max_file_bytes=100),
            expected_epoch=3,
        )
    assert env.client.get(routes(saved)[1], headers=AUTH).status_code == 404

    def bug(*args):
        raise TypeError("secret-path-and-token-must-not-leak")

    monkeypatch.setattr(FileSystemRepositorySource, "profile", bug)
    response = env.client.post(BASE + "/snapshots", headers=AUTH)
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "secret-path" not in response.text
    assert response.headers["access-control-allow-origin"] == AUTH["Origin"]


def test_read_only_provisioning_epoch_cas_and_atomic_rollback(http_setup):
    env = http_setup
    with pytest.raises(AuthorityConflict):
        configure_read_only_repository(
            env.database,
            env.binding,
            env.principal_id,
            TOKEN,
            credential_version=1,
            expected_epoch=0,
        )
    with pytest.raises(AuthorityConflict):
        configure_read_only_repository(
            env.database,
            env.binding,
            env.principal_id,
            "b" * 40,
            credential_version=1,
            expected_epoch=3,
        )
    other_profile = replace(
        env.binding.profile,
        scope=type(env.binding.profile.scope)(uuid4(), uuid4()),
    )
    with pytest.raises(AuthorityConflict):
        # New-scope registration must roll back when the credential is already owned.
        configure_read_only_repository(
            env.database,
            replace(env.binding, profile=other_profile),
            uuid4(),
            TOKEN,
            credential_version=1,
            expected_epoch=0,
        )
    assert env.client.get(BASE, headers=AUTH).json()["data"]["authority_epoch"] == 3
    with env.database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM control.repositories").fetchone() == (1,)
        grants = connection.execute("SELECT capability FROM control.principal_grants").fetchall()
        assert grants == [("repository.read",)]


def test_missing_source_config_is_explicit_after_authentication(http_setup):
    app = control_api.create_app(Settings(_env_file=None, database_url=None))
    client = TestClient(app)
    assert client.post(BASE + "/snapshots").status_code == 401
    response = client.post(BASE + "/snapshots", headers=AUTH)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SOURCE_NOT_CONFIGURED"
