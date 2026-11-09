import os
import subprocess
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

import pytest

from app.identity.control_authority import RepositoryScope
from app.repositories.filesystem_repository_source import (
    FileSystemRepositorySource,
    RepositorySourceBinding,
)
from app.repositories.snapshot_models import SourceChanged, SourceLimitExceeded, SourceUnavailable
from app.repositories.source_profiles import SourceProfile


def profile(paths, **limits):
    return SourceProfile(
        RepositoryScope(uuid4(), uuid4()), "test-repository", tuple(paths), **limits
    )


@pytest.mark.parametrize(
    "path",
    [
        "../outside.py",
        "a/../outside.py",
        "/outside.py",
        "a//b.py",
        "a/./b.py",
        "C:/secret.py",
        "a\\secret.py",
        "a.py:stream",
        "a.py.",
        "a.py ",
        ".env",
        "app/.env.local",
        ".git/config",
        "app/secrets.json",
        "credentials/token.txt",
        "private.key",
        "node_modules/a.js",
        "CON",
        "con.py",
        "AUX.txt",
        "lpt1.py",
        "é.py",
        "app/FILE~1.PY",
    ],
)
def test_profile_rejects_traversal_secrets_and_portable_aliases(path):
    with pytest.raises(ValueError):
        profile([path])


@pytest.mark.parametrize("paths", [[], ["a.py", "a.py"], ["A.py", "a.py"], ["a.py", "a.py/b.py"]])
def test_profile_requires_nonempty_unambiguous_exact_file_set(paths):
    with pytest.raises(ValueError):
        profile(paths)


def test_profile_order_is_stable_and_limits_only_lowered():
    first = profile(["z.py", "a.py"])
    assert first.digest == replace(first, paths=("a.py", "z.py")).digest
    for limits in ({"max_files": 257}, {"max_file_bytes": 1048577}, {"max_total_bytes": 20971521}):
        with pytest.raises(ValueError):
            replace(first, **limits)


def test_capture_keeps_binary_newlines_and_does_not_read_excluded_files(tmp_path):
    (tmp_path / "z.py").write_bytes(b"first\r\nsecond\n\x00\xff")
    (tmp_path / "a.py").write_bytes(b"")
    (tmp_path / ".env").write_bytes(b"test-only-excluded-secret")
    config = profile(["z.py", "a.py"])
    source = FileSystemRepositorySource((RepositorySourceBinding(config, tmp_path),))
    result = source.capture(config)
    assert [(item.path, item.content) for item in result] == [
        ("a.py", b""),
        ("z.py", b"first\r\nsecond\n\x00\xff"),
    ]


def test_missing_directory_and_case_alias_fail_closed(tmp_path):
    config = profile(["a.py"])
    source = FileSystemRepositorySource((RepositorySourceBinding(config, tmp_path),))
    with pytest.raises(SourceUnavailable):
        source.capture(config)
    (tmp_path / "A.py").write_bytes(b"a")
    with pytest.raises(SourceUnavailable):
        source.capture(config)


def test_hard_link_and_non_regular_file_are_rejected(tmp_path):
    (tmp_path / "a.py").write_bytes(b"test-only")
    os.link(tmp_path / "a.py", tmp_path / "alias.py")
    config = profile(["a.py"])
    source = FileSystemRepositorySource((RepositorySourceBinding(config, tmp_path),))
    with pytest.raises(SourceUnavailable):
        source.capture(config)
    (tmp_path / "directory.py").mkdir()
    other = profile(["directory.py"])
    with pytest.raises(SourceUnavailable):
        FileSystemRepositorySource((RepositorySourceBinding(other, tmp_path),)).capture(other)


def test_reparse_directory_metadata_is_rejected_before_open(tmp_path, monkeypatch):
    import app.repositories.filesystem_repository_source as module

    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "a.py").write_bytes(b"test-only")
    config = profile(["app/a.py"])
    source = FileSystemRepositorySource((RepositorySourceBinding(config, tmp_path),))
    original = module._reparse
    directory_inode = (tmp_path / "app").lstat().st_ino
    monkeypatch.setattr(
        module, "_reparse", lambda info: info.st_ino == directory_inode or original(info)
    )
    with pytest.raises(SourceUnavailable):
        source.capture(config)


def test_directory_alias_to_outside_root_is_rejected(tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "a.py").write_bytes(b"test-only-outside")
    root = tmp_path / "repo"
    root.mkdir()
    if os.name == "nt":
        # Junction creation needs no symlink privilege. Both paths belong to this test.
        env = os.environ.copy()
        env["CACHESEC_TEST_LINK_PATH"] = str(root / "alias")
        env["CACHESEC_TEST_LINK_TARGET"] = str(outside)
        subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "New-Item -ItemType Junction -Path $env:CACHESEC_TEST_LINK_PATH "
                "-Target $env:CACHESEC_TEST_LINK_TARGET -ErrorAction Stop | Out-Null",
            ],
            env=env,
            check=True,
            capture_output=True,
        )
    else:
        (root / "alias").symlink_to(outside, target_is_directory=True)
    config = profile(["alias/a.py"])
    with pytest.raises(SourceUnavailable):
        FileSystemRepositorySource((RepositorySourceBinding(config, root),)).capture(config)


def test_edits_between_read_passes_are_rejected(tmp_path, monkeypatch):
    (tmp_path / "a.py").write_bytes(b"before")
    config = profile(["a.py"])
    source = FileSystemRepositorySource((RepositorySourceBinding(config, tmp_path),))
    original = source._read
    reads = 0

    def read(binding, relative):
        nonlocal reads
        result = original(binding, relative)
        reads += 1
        if reads == 1:
            (tmp_path / "a.py").write_bytes(b"after!")
        return result

    monkeypatch.setattr(source, "_read", read)
    with pytest.raises(SourceChanged):
        source.capture(config)


def test_file_and_aggregate_limits_are_enforced(tmp_path):
    (tmp_path / "a.py").write_bytes(b"123")
    (tmp_path / "b.py").write_bytes(b"456")
    for config in (
        profile(["a.py"], max_file_bytes=2),
        profile(["a.py", "b.py"], max_total_bytes=5),
    ):
        with pytest.raises(SourceLimitExceeded):
            FileSystemRepositorySource((RepositorySourceBinding(config, tmp_path),)).capture(config)


def test_root_and_duplicate_scope_configuration_are_explicit(tmp_path):
    config = profile(["a.py"])
    for root in (Path("relative"), Path(tmp_path.anchor), tmp_path / "x" / ".."):
        with pytest.raises(ValueError):
            RepositorySourceBinding(config, root)
    binding = RepositorySourceBinding(config, tmp_path)
    with pytest.raises(ValueError):
        FileSystemRepositorySource((binding, binding))
