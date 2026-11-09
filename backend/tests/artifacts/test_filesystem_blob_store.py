import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from app.artifacts.blob_models import (
    BlobBytesUnavailable,
    BlobIntegrityError,
    BlobTooLarge,
    InvalidBlobDigest,
    content_digest,
)
from app.artifacts.filesystem_blob_store import FileSystemBlobStore


def test_bytes_are_exact_and_repeated_publication_does_not_rewrite(tmp_path):
    store = FileSystemBlobStore(tmp_path)
    for content in (b"", b"x\n", b"x\r\n", b"\x00\xff\x80"):
        reference = store.put(content)
        path = tmp_path / "blobs" / "sha256" / reference.digest[7:]
        before = path.stat()
        assert store.put(content) == reference
        assert store.get(reference.digest) == content
        assert (path.stat().st_ino, path.stat().st_mtime_ns) == (before.st_ino, before.st_mtime_ns)
    assert list((tmp_path / "staging").iterdir()) == []


def test_parallel_publish_is_complete_and_deduplicated(tmp_path):
    store = FileSystemBlobStore(tmp_path)
    content = b"parallel bytes" * 1000
    with ThreadPoolExecutor(max_workers=8) as workers:
        references = list(workers.map(lambda _: store.put(content), range(16)))
    assert len(set(references)) == 1
    assert store.get(references[0].digest) == content
    assert len(list((tmp_path / "blobs" / "sha256").iterdir())) == 1
    assert list((tmp_path / "staging").iterdir()) == []


@pytest.mark.parametrize(
    "digest", ["../other", "sha256:" + "A" * 64, "sha256:" + "a" * 64 + "\n", "a" * 64]
)
def test_invalid_digest_cannot_be_used_as_a_path(tmp_path, digest):
    store = FileSystemBlobStore(tmp_path / "unused")
    with pytest.raises(InvalidBlobDigest):
        store.get(digest)
    assert not (tmp_path / "unused").exists()


def test_tampered_or_missing_bytes_are_not_repaired_as_if_valid(tmp_path):
    store = FileSystemBlobStore(tmp_path)
    reference = store.put(b"original")
    path = tmp_path / "blobs" / "sha256" / reference.digest[7:]
    path.write_bytes(b"tampered")
    for operation in (lambda: store.get(reference.digest), lambda: store.put(b"original")):
        with pytest.raises(BlobIntegrityError):
            operation()
    assert path.read_bytes() == b"tampered"
    path.unlink()
    with pytest.raises(BlobBytesUnavailable):
        store.get(reference.digest)


def test_failed_atomic_publish_leaves_no_partial_destination_or_staging(tmp_path, monkeypatch):
    store = FileSystemBlobStore(tmp_path)

    def fail(*args, **kwargs):
        raise OSError("simulated unsupported filesystem")

    monkeypatch.setattr(os, "link", fail)
    with pytest.raises(BlobBytesUnavailable):
        store.put(b"not published")
    assert list((tmp_path / "blobs" / "sha256").iterdir()) == []
    assert list((tmp_path / "staging").iterdir()) == []


def test_size_limit_and_explicit_root_are_checked_before_writing(tmp_path):
    root = tmp_path / "unused"
    with pytest.raises(BlobTooLarge):
        FileSystemBlobStore(root, max_blob_bytes=3).put(b"four")
    assert not root.exists()
    for path in (Path("relative"), Path(tmp_path.anchor)):
        with pytest.raises(ValueError):
            FileSystemBlobStore(path)


def test_non_regular_blob_files_are_refused(tmp_path):
    store = FileSystemBlobStore(tmp_path)
    reference = store.put(b"content")
    path = tmp_path / "blobs" / "sha256" / reference.digest[7:]
    path.unlink()
    path.mkdir()
    with pytest.raises(BlobIntegrityError):
        store.get(content_digest(b"content"))


def test_reparse_directory_metadata_blocks_publication(tmp_path, monkeypatch):
    from types import SimpleNamespace

    original = Path.lstat

    def reparse(path, *args, **kwargs):
        if path == tmp_path:
            return SimpleNamespace(st_mode=0o120777, st_file_attributes=0x400)
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "lstat", reparse)
    with pytest.raises(BlobIntegrityError):
        FileSystemBlobStore(tmp_path).put(b"must not publish")
    assert not (tmp_path / "blobs").exists()


def test_existing_path_must_contain_the_same_input_bytes(tmp_path, monkeypatch):
    from app.artifacts import filesystem_blob_store

    # Force a digest collision to exercise the byte comparison independently of SHA-256.
    monkeypatch.setattr(filesystem_blob_store, "content_digest", lambda _: "sha256:" + "a" * 64)
    store = FileSystemBlobStore(tmp_path)
    reference = store.put(b"one")
    with pytest.raises(BlobIntegrityError):
        store.put(b"two")
    assert store.get(reference.digest) == b"one"
