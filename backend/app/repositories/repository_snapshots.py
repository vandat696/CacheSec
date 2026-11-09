"""Authorized capture and reads of immutable scoped source bytes."""

import json
from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID, uuid4

from app.artifacts.blob_models import BlobReference, content_digest
from app.artifacts.blob_storage_service import BlobBytesStore, BlobMetadataRepository
from app.artifacts.metadata_encoding import encode_metadata
from app.identity.control_authority import (
    ControlAuthorityRepository,
    ControlAuthorizer,
    ControlCapability,
    ControlResourceUnavailable,
    RepositoryScope,
)
from app.repositories.snapshot_models import (
    CapturedSourceFile,
    RepositorySnapshot,
    SnapshotFile,
    SnapshotIntegrityError,
    SourceLimitExceeded,
    snapshot_manifest,
)
from app.repositories.source_profiles import SourceProfile


class RepositorySource(Protocol):
    def profile(self, scope: RepositoryScope) -> SourceProfile: ...

    def capture(self, profile: SourceProfile) -> tuple[CapturedSourceFile, ...]: ...


class SnapshotRepository(Protocol):
    def active_profile(self, scope: RepositoryScope) -> str | None: ...

    def add(self, snapshot: RepositorySnapshot) -> None: ...

    def get(self, scope: RepositoryScope, snapshot_id: UUID) -> RepositorySnapshot | None: ...


@dataclass(frozen=True)
class SnapshotSession:
    authority: ControlAuthorityRepository
    blobs: BlobMetadataRepository
    snapshots: SnapshotRepository


class SnapshotTransactions(Protocol):
    def open(self) -> AbstractContextManager[SnapshotSession]: ...


def _decode_profile(content: bytes, snapshot: RepositorySnapshot) -> SourceProfile:
    try:
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


class RepositorySnapshotService:
    def __init__(
        self, transactions: SnapshotTransactions, source: RepositorySource, blobs: BlobBytesStore
    ) -> None:
        self._transactions = transactions
        self._source = source
        self._blobs = blobs
        self._authorizer = ControlAuthorizer()

    def _authorize(self, session: SnapshotSession, token: str | None, scope: RepositoryScope):
        caller = self._authorizer.authenticate(session.authority, token)
        repository = self._authorizer.require(
            session.authority, caller, scope, frozenset({ControlCapability.REPOSITORY_READ})
        )
        return caller, repository

    def _publish(self, session: SnapshotSession, content: bytes) -> BlobReference:
        expected = BlobReference(content_digest(content), len(content))
        actual = self._blobs.put(content)
        published = self._blobs.get(expected.digest)
        if actual != expected or type(published) is not bytes or published != content:
            raise SnapshotIntegrityError("Blob publication did not preserve snapshot bytes.")
        session.blobs.register(expected)
        return expected

    def capture(self, token: str | None, scope: RepositoryScope) -> RepositorySnapshot:
        with self._transactions.open() as session:
            caller, repository = self._authorize(session, token, scope)
            profile = self._source.profile(scope)
            if (
                profile.scope != scope
                or profile.repository_identity != repository.identity
                or session.snapshots.active_profile(scope) != profile.digest
            ):
                raise ControlResourceUnavailable()
            captured = self._source.capture(profile)
            if (
                type(captured) is not tuple
                or any(not isinstance(item, CapturedSourceFile) for item in captured)
                or tuple(item.path for item in captured) != profile.paths
                or any(type(item.content) is not bytes for item in captured)
            ):
                raise SnapshotIntegrityError("Source adapter returned a different file set.")
            if (
                any(len(item.content) > profile.max_file_bytes for item in captured)
                or sum(len(item.content) for item in captured) > profile.max_total_bytes
            ):
                raise SourceLimitExceeded("Captured source exceeds its profile limits.")
            files = tuple(
                SnapshotFile(
                    uuid4(),
                    item.path,
                    BlobReference(content_digest(item.content), len(item.content)),
                )
                for item in captured
            )
            profile_bytes = encode_metadata(profile.metadata())
            manifest_bytes = encode_metadata(
                snapshot_manifest(scope, repository.identity, profile.digest, files)
            )
            for item in captured:
                self._publish(session, item.content)
            profile_blob = self._publish(session, profile_bytes)
            manifest_blob = self._publish(session, manifest_bytes)
            snapshot = RepositorySnapshot(
                scope,
                uuid4(),
                repository.identity,
                caller.principal_id,
                repository.authority_epoch,
                profile_blob,
                manifest_blob,
                files,
            )
            session.snapshots.add(snapshot)
        return snapshot

    def _read_blob(self, session: SnapshotSession, reference: BlobReference) -> bytes:
        if session.blobs.get(reference.digest) != reference:
            raise SnapshotIntegrityError("Snapshot blob metadata does not match.")
        content = self._blobs.get(reference.digest)
        if (
            type(content) is not bytes
            or len(content) != reference.byte_size
            or content_digest(content) != reference.digest
        ):
            raise SnapshotIntegrityError("Snapshot blob content does not match.")
        return content

    def _load(
        self, session: SnapshotSession, scope: RepositoryScope, snapshot_id: UUID, identity: str
    ) -> RepositorySnapshot:
        snapshot = session.snapshots.get(scope, snapshot_id)
        if snapshot is None:
            raise ControlResourceUnavailable()
        if (
            snapshot.scope != scope
            or snapshot.snapshot_id != snapshot_id
            or snapshot.repository_identity != identity
        ):
            raise SnapshotIntegrityError("Snapshot adapter returned a different resource.")
        current_profile = self._source.profile(scope)
        if (
            current_profile.scope != scope
            or current_profile.repository_identity != identity
            or current_profile.digest != snapshot.profile_blob.digest
            or session.snapshots.active_profile(scope) != current_profile.digest
        ):
            raise ControlResourceUnavailable()
        _decode_profile(self._read_blob(session, snapshot.profile_blob), snapshot)
        if self._read_blob(session, snapshot.manifest_blob) != encode_metadata(snapshot.manifest()):
            raise SnapshotIntegrityError("Snapshot records do not match their manifest.")
        return snapshot

    def get(
        self, token: str | None, scope: RepositoryScope, snapshot_id: UUID
    ) -> RepositorySnapshot:
        with self._transactions.open() as session:
            _, repository = self._authorize(session, token, scope)
            snapshot = self._load(session, scope, snapshot_id, repository.identity)
        return snapshot

    def read_file(
        self, token: str | None, scope: RepositoryScope, snapshot_id: UUID, file_id: UUID
    ) -> bytes:
        with self._transactions.open() as session:
            _, repository = self._authorize(session, token, scope)
            snapshot = self._load(session, scope, snapshot_id, repository.identity)
            item = next((item for item in snapshot.files if item.file_id == file_id), None)
            if item is None:
                raise ControlResourceUnavailable()
            content = self._read_blob(session, item.blob)
        return content
