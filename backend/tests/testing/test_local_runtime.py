"""Bootstrap identity and dispatch ordering; Docker is a labelled command double here."""

import json
import time
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.artifacts.metadata_encoding import metadata_digest
from app.testing.docker_commands import DockerFailure
from app.workspace_runtime import docker_runtime
from app.workspace_runtime.docker_runtime import DockerLocalRuntime, runtime_configuration

BASELINE = "sha256:" + "a" * 64
RUNTIME = "sha256:" + "b" * 64


@pytest.fixture
def runtime(tmp_path):
    environment = tmp_path / "runtime.env"
    environment.write_text("TEST_ONLY=1\n")
    configuration = {
        "network": "test-internal",
        "port": 8001,
        "environment_file": str(environment),
        "baseline_image": BASELINE,
    }
    return DockerLocalRuntime(tmp_path, uuid4(), configuration)


def test_baseline_identity_is_part_of_target_configuration(runtime):
    profile = SimpleNamespace(digest="profile-test", runtime_image=RUNTIME)
    first = runtime_configuration(runtime.configuration, profile)
    assert first["baseline_image"] == BASELINE
    second = runtime_configuration(runtime.configuration | {"baseline_image": RUNTIME}, profile)
    assert metadata_digest(first) != metadata_digest(second)
    with pytest.raises(ValueError):
        runtime_configuration(runtime.configuration | {"baseline_image": "mutable:tag"}, profile)


@pytest.mark.parametrize(
    "image,mounts,accepted", [(BASELINE, [], True), (RUNTIME, [], False), (BASELINE, [{}], False)]
)
def test_previous_baseline_matches_registered_image_instead_of_candidate_image(
    runtime, monkeypatch, image, mounts, accepted
):
    monkeypatch.setattr(docker_runtime, "docker", lambda args: b"test-baseline\n")
    monkeypatch.setattr(runtime, "inspect", lambda name: {"Image": image, "Mounts": mounts})
    profile = SimpleNamespace(runtime_image=RUNTIME)
    if accepted:
        assert runtime.previous({"version": 0}, profile) == "test-baseline"
    else:
        with pytest.raises(DockerFailure, match="TARGET_MISMATCH"):
            runtime.previous({"version": 0}, profile)


@pytest.mark.parametrize("mismatch_at", ["preflight", "after_permit"])
def test_mismatch_never_stops_or_starts_app_and_permit_receipt_is_preserved(
    runtime, monkeypatch, tmp_path, mismatch_at
):
    profile = SimpleNamespace(runtime_image=RUNTIME, digest="profile-test")
    operation = {
        "id": str(uuid4()),
        "target_version": 0,
        "artifact_digest": "artifact-test",
        "ticket": "test-ticket",
    }
    receipt, commands, calls = {}, [], []
    prepared = SimpleNamespace(directory=tmp_path, source_root=tmp_path)
    runtime.workspace = SimpleNamespace(
        prepare=lambda candidate: prepared, verify=lambda value: None
    )
    monkeypatch.setattr(docker_runtime, "verify_images", lambda value: None)
    monkeypatch.setattr(
        docker_runtime,
        "docker",
        lambda args: commands.append(args) or json.dumps([{"Internal": True}]).encode(),
    )
    monkeypatch.setattr(runtime, "inspect", lambda name: {})
    monkeypatch.setattr(runtime, "verify", lambda *args: None)
    monkeypatch.setattr(runtime, "create_ingress", lambda *args: None)
    observations = []

    def previous(target, current_profile):
        observations.append(target)
        if mismatch_at == "preflight" or len(observations) == 2:
            raise DockerFailure("TARGET_MISMATCH")
        return "test-baseline"

    monkeypatch.setattr(runtime, "previous", previous)
    permit = {
        "artifact_digest": operation["artifact_digest"],
        "profile_digest": profile.digest,
        "target": {
            "version": 0,
            "config_digest": metadata_digest(runtime_configuration(runtime.configuration, profile)),
        },
        "permit_expires_at": time.time() + 30,
    }
    client = SimpleNamespace(post=lambda *args, **kwargs: calls.append(args) or permit)
    with pytest.raises(DockerFailure, match="TARGET_MISMATCH"):
        runtime.start(client, operation, profile, object(), receipt)
    assert not any(args[0] in {"start", "stop"} for args in commands)
    if mismatch_at == "preflight":
        assert calls == []
    else:
        assert len(calls) == 1
        persisted = json.loads(
            (tmp_path / ("operation-" + operation["id"].replace("-", "") + ".json")).read_text()
        )
        assert persisted["permit"] == permit
        assert persisted["prepared_directory"] == str(tmp_path)
