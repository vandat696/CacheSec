"""Complete immutable snapshot bytes for trusted preparation, never runtime readiness."""

import json
from dataclasses import dataclass, field
from uuid import UUID

from app.artifacts.blob_models import content_digest
from app.artifacts.metadata_encoding import MAX_METADATA_BYTES, encode_metadata
from app.identity.control_authority import RepositoryScope
from app.repositories.snapshot_models import (
    CapturedSourceFile,
    RepositorySnapshot,
    SnapshotIntegrityError,
)
from app.repositories.source_profiles import SourceProfile


def decode_snapshot_profile(content: bytes, snapshot: RepositorySnapshot) -> SourceProfile:
    try:
        if (
            type(content) is not bytes
            or len(content) > MAX_METADATA_BYTES
            or len(content) != snapshot.profile_blob.byte_size
            or content_digest(content) != snapshot.profile_blob.digest
        ):
            raise ValueError("Profile bytes do not match their reference.")
        data = json.loads(content)
        if (
            type(data) is not dict
            or type(data.get("paths")) is not list
            or any(
                type(data.get(key)) is not str
                for key in ("tenant_id", "repo_id", "repository_identity")
            )
        ):
            raise ValueError("Invalid profile schema.")
        profile = SourceProfile(
            RepositoryScope(UUID(data["tenant_id"]), UUID(data["repo_id"])),
            data["repository_identity"],
            tuple(data["paths"]),
            data["max_file_bytes"],
            data["max_files"],
            data["max_total_bytes"],
        )
        if (
            content != encode_metadata(profile.metadata())
            or profile.scope != snapshot.scope
            or profile.repository_identity != snapshot.repository_identity
            or profile.paths != tuple(item.path for item in snapshot.files)
            or any(item.blob.byte_size > profile.max_file_bytes for item in snapshot.files)
            or sum(item.blob.byte_size for item in snapshot.files) > profile.max_total_bytes
        ):
            raise ValueError("Profile does not match its snapshot.")
        return profile
    except (KeyError, TypeError, ValueError, UnicodeError) as error:
        raise SnapshotIntegrityError("Stored source profile is invalid.") from error


@dataclass(frozen=True)
class SnapshotBundle:
    snapshot: RepositorySnapshot
    profile_content: bytes = field(repr=False)
    files: tuple[CapturedSourceFile, ...] = field(repr=False)

    def __post_init__(self) -> None:
        self.verify()

    def verify(self) -> None:
        if not isinstance(self.snapshot, RepositorySnapshot):
            raise SnapshotIntegrityError("Bundle requires snapshot metadata.")
        decode_snapshot_profile(self.profile_content, self.snapshot)
        manifest = encode_metadata(self.snapshot.manifest())
        if (
            len(manifest) != self.snapshot.manifest_blob.byte_size
            or content_digest(manifest) != self.snapshot.manifest_blob.digest
            or type(self.files) is not tuple
            or len(self.files) != len(self.snapshot.files)
        ):
            raise SnapshotIntegrityError("Bundle metadata does not match its snapshot.")
        for content, reference in zip(self.files, self.snapshot.files, strict=True):
            if (
                not isinstance(content, CapturedSourceFile)
                or content.path != reference.path
                or type(content.content) is not bytes
                or len(content.content) != reference.blob.byte_size
                or content_digest(content.content) != reference.blob.digest
            ):
                raise SnapshotIntegrityError("Bundle bytes do not match their snapshot.")
