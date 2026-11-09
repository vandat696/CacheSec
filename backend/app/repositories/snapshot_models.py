"""Immutable scoped snapshot records, not an artifact or approval attestation."""

from dataclasses import dataclass
from uuid import UUID

from app.artifacts.blob_models import BlobReference
from app.artifacts.metadata_encoding import MAX_METADATA_BYTES
from app.identity.control_authority import RepositoryScope
from app.repositories.source_profiles import (
    MAX_SOURCE_BYTES,
    MAX_SOURCE_FILES,
    require_repository_identity,
    require_source_path,
)


class SnapshotIntegrityError(Exception):
    pass


class SnapshotStorageUnavailable(Exception):
    pass


class SourceUnavailable(Exception):
    pass


class SourceChanged(Exception):
    pass


class SourceLimitExceeded(Exception):
    pass


@dataclass(frozen=True)
class CapturedSourceFile:
    path: str
    content: bytes


@dataclass(frozen=True)
class SnapshotFile:
    file_id: UUID
    path: str
    blob: BlobReference

    def __post_init__(self) -> None:
        require_source_path(self.path)
        if not isinstance(self.file_id, UUID) or not isinstance(self.blob, BlobReference):
            raise ValueError("Invalid snapshot file reference.")


@dataclass(frozen=True)
class RepositorySnapshot:
    scope: RepositoryScope
    snapshot_id: UUID
    repository_identity: str
    created_by: UUID
    authority_epoch: int
    profile_blob: BlobReference
    manifest_blob: BlobReference
    files: tuple[SnapshotFile, ...]

    def __post_init__(self) -> None:
        require_repository_identity(self.repository_identity)
        if (
            not isinstance(self.scope, RepositoryScope)
            or not isinstance(self.snapshot_id, UUID)
            or not isinstance(self.created_by, UUID)
            or type(self.authority_epoch) is not int
            or self.authority_epoch < 1
            or not isinstance(self.profile_blob, BlobReference)
            or not isinstance(self.manifest_blob, BlobReference)
            or self.profile_blob.byte_size > MAX_METADATA_BYTES
            or self.manifest_blob.byte_size > MAX_METADATA_BYTES
            or type(self.files) is not tuple
            or not 1 <= len(self.files) <= MAX_SOURCE_FILES
            or any(not isinstance(item, SnapshotFile) for item in self.files)
        ):
            raise ValueError("Invalid repository snapshot.")
        paths = [item.path for item in self.files]
        if (
            paths != sorted(paths)
            or len({path.lower() for path in paths}) != len(paths)
            or len({item.file_id for item in self.files}) != len(paths)
            or sum(item.blob.byte_size for item in self.files) > MAX_SOURCE_BYTES
        ):
            raise ValueError("Invalid snapshot file set.")

    def manifest(self) -> dict:
        return snapshot_manifest(
            self.scope, self.repository_identity, self.profile_blob.digest, self.files
        )


def snapshot_manifest(
    scope: RepositoryScope, identity: str, profile_digest: str, files: tuple[SnapshotFile, ...]
) -> dict:
    return {
        "kind": "repository-snapshot",
        "schema_version": 1,
        "tenant_id": str(scope.tenant_id),
        "repo_id": str(scope.repo_id),
        "repository_identity": identity,
        "source_profile_digest": profile_digest,
        "files": [
            {"path": item.path, "digest": item.blob.digest, "byte_size": item.blob.byte_size}
            for item in files
        ],
    }
