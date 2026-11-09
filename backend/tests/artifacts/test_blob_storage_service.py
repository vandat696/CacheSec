from contextlib import contextmanager

import pytest

from app.artifacts.blob_models import (
    BlobIntegrityError,
    BlobMetadataUnavailable,
    BlobNotRegistered,
    BlobReference,
    content_digest,
)
from app.artifacts.blob_storage_service import ArtifactBlobStorage
from app.artifacts.filesystem_blob_store import FileSystemBlobStore


class MemoryMetadata:
    def __init__(self, *, commit_failure=False):
        self.rows = {}
        self.commit_failure = commit_failure

    @contextmanager
    def open(self):
        before = self.rows.copy()
        try:
            yield self
            if self.commit_failure:
                raise BlobMetadataUnavailable("simulated metadata commit failure")
        except BaseException:
            self.rows = before
            raise

    def register(self, reference):
        self.rows[reference.digest] = reference

    def get(self, digest):
        return self.rows.get(digest)


def test_failed_commit_leaves_only_an_orphan_and_retry_registers_it(tmp_path):
    store, metadata = FileSystemBlobStore(tmp_path), MemoryMetadata(commit_failure=True)
    service = ArtifactBlobStorage(store, metadata)
    content = b"test only"
    digest = content_digest(content)
    with pytest.raises(BlobMetadataUnavailable):
        service.store(content)
    assert metadata.rows == {}
    assert store.get(digest) == content
    metadata.commit_failure = False
    with pytest.raises(BlobNotRegistered):
        service.read(digest)
    assert service.store(content) == BlobReference(digest, len(content))
    assert service.read(digest) == content


def test_inconsistent_replacement_adapter_is_not_registered_or_returned():
    class WrongStore:
        def put(self, content):
            return BlobReference(content_digest(b"wrong"), len(content))

        def get(self, digest):
            return b"wrong"

    metadata = MemoryMetadata()
    service = ArtifactBlobStorage(WrongStore(), metadata)
    with pytest.raises(BlobIntegrityError):
        service.store(b"right")
    assert metadata.rows == {}
    digest = content_digest(b"right")
    metadata.rows[digest] = BlobReference(digest, 5)
    with pytest.raises(BlobIntegrityError):
        service.read(digest)


def test_unknown_blob_is_not_read_from_an_alternate_store():
    class Unreadable:
        def get(self, digest):
            raise AssertionError("Unregistered bytes must not be read.")

    with pytest.raises(BlobNotRegistered):
        ArtifactBlobStorage(Unreadable(), MemoryMetadata()).read(content_digest(b"missing"))
