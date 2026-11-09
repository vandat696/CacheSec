from contextlib import AbstractContextManager
from typing import Protocol

from app.artifacts.blob_models import (
    BlobIntegrityError,
    BlobNotRegistered,
    BlobReference,
    content_digest,
    require_blob_digest,
)


class BlobBytesStore(Protocol):
    def put(self, content: bytes) -> BlobReference: ...

    def get(self, digest: str) -> bytes: ...


class BlobMetadataRepository(Protocol):
    def register(self, reference: BlobReference) -> None: ...

    def get(self, digest: str) -> BlobReference | None: ...


class BlobMetadataTransactions(Protocol):
    def open(self) -> AbstractContextManager[BlobMetadataRepository]: ...


class ArtifactBlobStorage:
    """Internal raw-object storage. No provenance, permission, artifact-ready or gate decision."""

    def __init__(self, store: BlobBytesStore, metadata: BlobMetadataTransactions) -> None:
        self._store = store
        self._metadata = metadata

    def store(self, content: bytes) -> BlobReference:
        if type(content) is not bytes:
            raise TypeError("Blob content must be bytes.")
        reference = self._store.put(content)
        if reference.digest != content_digest(content) or reference.byte_size != len(content):
            raise BlobIntegrityError("Blob adapter returned inconsistent metadata.")
        with self._metadata.open() as repository:
            repository.register(reference)
        # Failed/unknown commits never report success; retry reconciles the immutable index row.
        return reference

    def read(self, digest: str) -> bytes:
        require_blob_digest(digest)
        with self._metadata.open() as repository:
            reference = repository.get(digest)
        if reference is None:
            raise BlobNotRegistered("Blob is not registered.")
        content = self._store.get(digest)
        if (
            reference.digest != digest
            or type(content) is not bytes
            or content_digest(content) != digest
            or len(content) != reference.byte_size
        ):
            raise BlobIntegrityError("Blob bytes do not match registered metadata.")
        return content
