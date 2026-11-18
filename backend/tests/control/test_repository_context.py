"""Context boundary tests with source/authority/model doubles; no provider calls."""

from dataclasses import replace
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.agent_assistance.assistance_service import AgentAssistanceService
from app.agent_assistance.generation import AgentError, GenerationResult
from app.artifacts.blob_models import BlobReference, content_digest
from app.artifacts.metadata_encoding import encode_metadata
from app.change_workflow.test_profiles import EDITABLE_PATH, OVERLAY_PATHS
from app.identity.control_authority import (
    ControlAccessDenied,
    ControlAuthorityUnavailable,
    RegisteredRepository,
    RepositoryScope,
)
from app.repositories.snapshot_bundles import SnapshotBundle
from app.repositories.snapshot_models import (
    CapturedSourceFile,
    RepositorySnapshot,
    SnapshotFile,
    snapshot_manifest,
)
from app.repositories.source_profiles import SourceProfile


def bundle_for(scope, contents):
    profile = SourceProfile(scope, "test-only-repository", tuple(path for path, _ in contents))
    profile_bytes = encode_metadata(profile.metadata())
    files = tuple(
        SnapshotFile(uuid4(), path, BlobReference(content_digest(content), len(content)))
        for path, content in contents
    )
    manifest = encode_metadata(
        snapshot_manifest(scope, profile.repository_identity, profile.digest, files)
    )
    snapshot = RepositorySnapshot(
        scope,
        uuid4(),
        profile.repository_identity,
        uuid4(),
        1,
        BlobReference(profile.digest, len(profile_bytes)),
        BlobReference(content_digest(manifest), len(manifest)),
        files,
    )
    return SnapshotBundle(
        snapshot, profile_bytes, tuple(CapturedSourceFile(*item) for item in contents)
    )


@pytest.fixture
def context_env():
    scope = RepositoryScope(uuid4(), uuid4())
    bundle = bundle_for(scope, tuple((path, b"\xef\xbb\xbforiginal\r\n") for path in OVERLAY_PATHS))
    state = SimpleNamespace(
        bundle=bundle,
        current=bundle.snapshot,
        repository=RegisteredRepository(scope, bundle.snapshot.repository_identity, 1),
        denied=False,
        unavailable=False,
        calls=[],
        after_generate=lambda: None,
    )

    class Access:
        def describe_current(self, token):
            if state.denied:
                raise ControlAccessDenied()
            if state.unavailable:
                raise ControlAuthorityUnavailable()
            return state.repository

    class Snapshots:
        def read_bundle(self, token, requested_scope, snapshot_id):
            Access().describe_current(token)
            assert requested_scope == scope and snapshot_id == state.bundle.snapshot.snapshot_id
            return state.bundle

        def capture(self, token, requested_scope):
            Access().describe_current(token)
            assert requested_scope == scope
            return state.current

    class Model:
        model_id = "test-only-model"

        def configured(self):
            return True

        def generate(self, prompt, files, history):
            state.calls.append(files)
            state.after_generate()
            return GenerationResult("test-only answer", None, self.model_id, None)

    state.service = AgentAssistanceService(Access(), Snapshots(), Model())
    state.ask = lambda candidate=None: state.service.ask(
        "test-only-token", state.bundle.snapshot.snapshot_id, "explain", [], candidate
    )
    return state


def test_context_preserves_files_and_internal_candidate_only_overlays_editable_path(context_env):
    env = context_env
    env.ask("candidate\r\n")
    assert env.calls == [
        tuple(
            (path, "candidate\r\n" if path == EDITABLE_PATH else "original\r\n")
            for path in OVERLAY_PATHS
        )
    ]
    assert all(item.content == b"\xef\xbb\xbforiginal\r\n" for item in env.bundle.files)
    assert "original" not in repr(
        env.service.contexts.prepare("token", env.repository, env.bundle.snapshot.snapshot_id)
    )


@pytest.mark.parametrize("during", [False, True])
@pytest.mark.parametrize("path", OVERLAY_PATHS)
def test_change_in_any_dependency_blocks_or_discards_generation(context_env, during, path):
    env = context_env

    def change():
        files = tuple(
            replace(item, blob=BlobReference(content_digest(b"changed"), 7))
            if item.path == path
            else item
            for item in env.current.files
        )
        env.current = replace(env.current, files=files)

    if during:
        env.after_generate = change
    else:
        change()
    with pytest.raises(AgentError, match="STALE_SNAPSHOT"):
        env.ask()
    assert len(env.calls) == int(during)


@pytest.mark.parametrize("during", [False, True])
@pytest.mark.parametrize(
    "failure,error", [("denied", ControlAccessDenied), ("unavailable", ControlAuthorityUnavailable)]
)
def test_authority_denial_and_outage_never_release_result(context_env, during, failure, error):
    env = context_env
    if during:
        env.after_generate = lambda: setattr(env, failure, True)
    else:
        setattr(env, failure, True)
    with pytest.raises(error):
        env.ask()
    assert len(env.calls) == int(during)


@pytest.mark.parametrize(
    "attribute,value",
    [
        ("identity", "another-repository"),
        ("scope", RepositoryScope(uuid4(), uuid4())),
    ],
)
def test_repository_binding_change_during_model_discards_response(context_env, attribute, value):
    env = context_env
    env.after_generate = lambda: setattr(
        env, "repository", replace(env.repository, **{attribute: value})
    )
    with pytest.raises(AgentError, match="AGENT_CONTEXT_CHANGED"):
        env.ask()
    assert len(env.calls) == 1


@pytest.mark.parametrize(
    "candidate",
    [1, "\x00", "x" * 65537, "ế" * 22000],
    ids=["type", "nul", "ascii-size", "utf8-size"],
)
def test_invalid_internal_candidate_never_reaches_model(context_env, candidate):
    with pytest.raises(AgentError, match="AGENT_CONTEXT_TOO_LARGE"):
        context_env.ask(candidate)
    assert not context_env.calls


@pytest.mark.parametrize(
    "contents,error",
    [
        (((OVERLAY_PATHS[0], b"source"),), "AGENT_SOURCE_PROFILE_UNSUPPORTED"),
        (tuple((path, b"\xff") for path in OVERLAY_PATHS), "AGENT_SOURCE_NOT_TEXT"),
        (tuple((path, b"x" * 50000) for path in OVERLAY_PATHS), "AGENT_CONTEXT_TOO_LARGE"),
    ],
)
def test_unsupported_or_invalid_source_never_reaches_model(context_env, contents, error):
    env = context_env
    env.bundle = bundle_for(env.repository.scope, contents)
    env.current = env.bundle.snapshot
    with pytest.raises(AgentError, match=error):
        env.ask()
    assert not env.calls
