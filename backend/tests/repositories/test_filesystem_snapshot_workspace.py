import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

import pytest

from app.artifacts.blob_models import BlobReference, content_digest
from app.artifacts.metadata_encoding import encode_metadata
from app.identity.control_authority import RepositoryScope
from app.repositories.filesystem_snapshot_workspace import (
    FileSystemSnapshotWorkspace,
    PreparedSnapshot,
    SnapshotWorkspaceUnavailable,
)
from app.repositories.snapshot_bundles import SnapshotBundle
from app.repositories.snapshot_models import (
    CapturedSourceFile,
    RepositorySnapshot,
    SnapshotFile,
    SnapshotIntegrityError,
    snapshot_manifest,
)
from app.repositories.source_profiles import SourceProfile


@pytest.fixture
def bundle():
    scope = RepositoryScope(uuid4(), uuid4())
    files = (
        CapturedSourceFile("app/validator.py", b"before\r\n\x00\xff"),
        CapturedSourceFile("empty.txt", b""),
    )
    refs = tuple(
        SnapshotFile(uuid4(), f.path, BlobReference(content_digest(f.content), len(f.content)))
        for f in files
    )
    profile = SourceProfile(scope, "test-source", tuple(f.path for f in files))
    raw_profile = encode_metadata(profile.metadata())
    raw_manifest = encode_metadata(snapshot_manifest(scope, "test-source", profile.digest, refs))
    snapshot = RepositorySnapshot(
        scope,
        uuid4(),
        "test-source",
        uuid4(),
        1,
        BlobReference(content_digest(raw_profile), len(raw_profile)),
        BlobReference(content_digest(raw_manifest), len(raw_manifest)),
        refs,
    )
    return SnapshotBundle(snapshot, raw_profile, files)


def test_saved_binary_newlines_and_empty_files_are_prepared_separately(bundle, tmp_path):
    store = FileSystemSnapshotWorkspace(tmp_path / "workspaces")
    first = store.prepare(bundle)
    second = store.prepare(bundle)
    assert first.directory != second.directory
    assert first.snapshot == second.snapshot == bundle.snapshot
    for item in bundle.files:
        assert (first.source_root / item.path).read_bytes() == item.content
        assert (second.source_root / item.path).read_bytes() == item.content
    assert (first.directory / "profile.json").read_bytes() == bundle.profile_content
    assert (first.directory / "manifest.json").read_bytes() == encode_metadata(
        bundle.snapshot.manifest()
    )
    store.verify(first)


@pytest.mark.parametrize(
    "change", ["missing", "extra", "reordered", "changed", "mutable", "profile"]
)
def test_invalid_bundle_fails_before_creating_workspace(bundle, tmp_path, change):
    root = tmp_path / "never-created"
    values = {
        "missing": bundle.files[:1],
        "extra": (*bundle.files, bundle.files[0]),
        "reordered": tuple(reversed(bundle.files)),
        "changed": (replace(bundle.files[0], content=b"altered"), bundle.files[1]),
        "mutable": (
            replace(bundle.files[0], content=bytearray(bundle.files[0].content)),
            bundle.files[1],
        ),
    }
    if change == "profile":
        object.__setattr__(bundle, "profile_content", bundle.profile_content + b"\n")
    else:
        object.__setattr__(bundle, "files", values[change])
    with pytest.raises(SnapshotIntegrityError):
        FileSystemSnapshotWorkspace(root).prepare(bundle)
    assert not root.exists()


@pytest.mark.parametrize(
    "change", ["content", "manifest", "profile", "extra", "missing", "directory"]
)
def test_workspace_verification_rejects_tampering(bundle, tmp_path, change):
    store = FileSystemSnapshotWorkspace(tmp_path / "workspaces")
    ready = store.prepare(bundle)
    if change == "content":
        (ready.source_root / "app/validator.py").write_bytes(b"altered")
    elif change in ("manifest", "profile"):
        (ready.directory / (change + ".json")).write_bytes(b"{}")
    elif change == "extra":
        (ready.source_root / "extra.py").write_bytes(b"unexpected")
    elif change == "directory":
        (ready.source_root / "extra").mkdir()
    else:
        (ready.source_root / "empty.txt").unlink()
    with pytest.raises((SnapshotIntegrityError, SnapshotWorkspaceUnavailable)):
        store.verify(ready)


def test_workspace_rejects_hard_links(bundle, tmp_path):
    store = FileSystemSnapshotWorkspace(tmp_path / "workspaces")
    ready = store.prepare(bundle)
    os.link(ready.source_root / "empty.txt", tmp_path / "alias.txt")
    with pytest.raises(SnapshotIntegrityError):
        store.verify(ready)


def junction_or_symlink(link: Path, target: Path):
    if os.name == "nt":
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "New-Item -ItemType Junction -Path $env:SNAPSHOT_TEST_LINK "
                "-Target $env:SNAPSHOT_TEST_TARGET -ErrorAction Stop | Out-Null",
            ],
            env={
                **os.environ,
                "SNAPSHOT_TEST_LINK": str(link),
                "SNAPSHOT_TEST_TARGET": str(target),
            },
            capture_output=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        assert result.returncode == 0, "Could not create a test-only Windows junction."
    else:
        link.symlink_to(target, target_is_directory=True)


def test_alias_root_does_not_write_into_another_directory(bundle, tmp_path):
    target = tmp_path / "other"
    target.mkdir()
    link = tmp_path / "alias"
    junction_or_symlink(link, target)
    with pytest.raises(SnapshotIntegrityError):
        FileSystemSnapshotWorkspace(link / "workspaces").prepare(bundle)
    assert list(target.iterdir()) == []


def test_alias_in_materialized_tree_is_not_followed(bundle, tmp_path):
    store = FileSystemSnapshotWorkspace(tmp_path / "workspaces")
    ready = store.prepare(bundle)
    target = tmp_path / "other"
    target.mkdir()
    junction_or_symlink(ready.source_root / "unexpected-link", target)
    with pytest.raises(SnapshotIntegrityError):
        store.verify(ready)
    assert list(target.iterdir()) == []


def test_unknown_locations_and_relative_roots_are_rejected(bundle, tmp_path):
    for root in (Path("relative"), Path(tmp_path.anchor), tmp_path / ".." / "outside"):
        with pytest.raises(ValueError):
            FileSystemSnapshotWorkspace(root)
    store = FileSystemSnapshotWorkspace(tmp_path / "workspaces")
    with pytest.raises(SnapshotIntegrityError):
        store.verify(PreparedSnapshot(tmp_path, bundle.snapshot))


def test_failure_has_no_receipt_and_does_not_overwrite_existing_workspace(
    bundle, tmp_path, monkeypatch
):
    import app.repositories.filesystem_snapshot_workspace as module

    store = FileSystemSnapshotWorkspace(tmp_path / "workspaces")
    ready = store.prepare(bundle)
    original = module._write

    def fail(path, content):
        if path.name == "manifest.json":
            raise OSError("test-only write failure")
        original(path, content)

    monkeypatch.setattr(module, "_write", fail)
    with pytest.raises(SnapshotWorkspaceUnavailable):
        store.prepare(bundle)
    assert (ready.source_root / "app/validator.py").read_bytes() == bundle.files[0].content
    store.verify(ready)
    # No automatic deletion: an unreferenced partial workspace is kept for scoped administration.
    assert len(list((tmp_path / "workspaces").iterdir())) == 2


def test_parallel_preparations_have_separate_directories(bundle, tmp_path):
    store = FileSystemSnapshotWorkspace(tmp_path / "workspaces")
    with ThreadPoolExecutor(max_workers=4) as workers:
        prepared = list(workers.map(lambda _: store.prepare(bundle), range(8)))
    assert len({item.directory for item in prepared}) == 8
    for item in prepared:
        store.verify(item)
