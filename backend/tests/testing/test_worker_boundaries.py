import subprocess
import sys
import time
from pathlib import Path
from uuid import uuid4

import pytest

from app.change_workflow.test_profiles import OVERLAY_PATHS, TechnicalTestProfile
from app.testing.docker_commands import OUTPUT_LIMIT, BoundedProcess, DockerFailure
from app.testing.docker_test_executor import DockerTestExecutor
from app.testing.test_worker import WorkerLock
from app.testing.worker_client import WorkerClient


def profile():
    digest = "sha256:" + "0" * 64
    return TechnicalTestProfile(
        *(digest for _ in range(6)), protected_files=tuple((p, digest) for p in OVERLAY_PATHS[:2])
    )


def test_recipe_rejects_unpinned_images_extra_options_and_altered_limits():
    p = profile()
    assert TechnicalTestProfile.from_metadata(p.metadata()) == p
    for change in (
        {"runtime_image": "runtime:latest"},
        {"cpu": 2},
        {"command": "run.py"},
        {"memory_mib": 1024},
        {"deadline_seconds": True},
        {"cpu": True},
        {"platform": "linux/arm64"},
        {"protected_files": {}},
    ):
        with pytest.raises((ValueError, TypeError)):
            TechnicalTestProfile.from_metadata(p.metadata() | change)


@pytest.mark.parametrize("stream", ["stdout", "stderr"])
def test_output_is_bounded_and_overflow_never_becomes_a_verdict(monkeypatch, stream):
    original = subprocess.Popen
    code = f"import sys;sys.{stream}.buffer.write(b'x'*{OUTPUT_LIMIT + 1});sys.{stream}.flush()"
    monkeypatch.setattr(
        subprocess, "Popen", lambda *args, **kw: original([sys.executable, "-c", code], **kw)
    )
    process = BoundedProcess.start(["ignored"])
    with pytest.raises(DockerFailure, match="OUTPUT_LIMIT"):
        process.wait(time.monotonic() + 10)
    assert len(process.stdout) <= OUTPUT_LIMIT and len(process.stderr) <= OUTPUT_LIMIT
    assert process.process.poll() is not None


def test_deadline_stops_cli_and_waits_for_exit(monkeypatch):
    original = subprocess.Popen
    monkeypatch.setattr(
        subprocess,
        "Popen",
        lambda *args, **kw: original([sys.executable, "-c", "import time; time.sleep(30)"], **kw),
    )
    process = BoundedProcess.start(["ignored"])
    with pytest.raises(DockerFailure, match="TEST_DEADLINE"):
        process.wait(time.monotonic() + 0.1)
    assert process.process.poll() is not None


def test_worker_requires_private_loopback_channel_and_exclusive_host_root(tmp_path):
    for url in (
        "https://example.com",
        "http://127.0.0.1@external.invalid",
        "http://127.0.0.1/path",
        "http://127.0.0.1?credential=value",
    ):
        with pytest.raises(ValueError):
            WorkerClient(url, "private-test-key", uuid4())
    first = WorkerLock(tmp_path)
    try:
        with pytest.raises(OSError):
            WorkerLock(tmp_path)
    finally:
        first.stream.close()


def test_resource_names_reject_injection_before_docker_calls(tmp_path):
    executor = DockerTestExecutor(Path(tmp_path), uuid4())
    with pytest.raises(ValueError):
        executor.names("../other-container")
