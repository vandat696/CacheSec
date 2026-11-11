from contextlib import contextmanager
from dataclasses import replace
from uuid import uuid4

import pytest

from app.artifacts.blob_models import BlobReference, content_digest
from app.identity.control_authority import (
    ControlAccessDenied,
    ControlCapability,
    ControlIdentityRequired,
    ControlPrincipal,
    ControlResourceUnavailable,
    RegisteredRepository,
    RepositoryScope,
    control_token_digest,
)
from app.repositories.repository_snapshots import RepositorySnapshotService, SnapshotSession
from app.repositories.snapshot_models import (
    CapturedSourceFile,
    SnapshotIntegrityError,
    SnapshotStorageUnavailable,
    SourceLimitExceeded,
)
from app.repositories.source_profiles import SourceProfile

TOKEN = "test-only-snapshot-token-" + "a" * 32


class MemoryBackend:
    def __init__(self):
        self.scope = RepositoryScope(uuid4(), uuid4())
        self.principal = ControlPrincipal(self.scope, uuid4(), 1, control_token_digest(TOKEN))
        self.grants = frozenset({ControlCapability.REPOSITORY_READ})
        self.blobs = MemoryBlobs()
        self.snapshots = MemorySnapshots()
        self.fail_commit = False

    @contextmanager
    def open(self):
        before = self.blobs.refs.copy(), self.snapshots.rows.copy()
        try:
            yield SnapshotSession(self, self.blobs, self.snapshots)
            if self.fail_commit:
                raise SnapshotStorageUnavailable("simulated commit failure")
        except BaseException:
            self.blobs.refs, self.snapshots.rows = before
            raise

    def find_credential(self, digest):
        return self.principal if digest == self.principal.token_digest else None

    def get_principal(self, scope, principal_id):
        assert scope == self.scope and principal_id == self.principal.principal_id
        return self.principal

    def lock_scope(self, scope):
        assert scope == self.scope
        return RegisteredRepository(scope, "test-repository", 2)

    def capabilities(self, scope, principal_id):
        return self.grants


class MemoryBlobs:
    def __init__(self):
        self.refs = {}
        self.content = {}
        self.reads = 0

    def register(self, reference):
        self.refs[reference.digest] = reference

    def put(self, content):
        reference = BlobReference(content_digest(content), len(content))
        self.content[reference.digest] = content
        return reference

    def get(self, digest):
        return self.refs.get(digest)


class MemoryBytes:
    def __init__(self, blobs):
        self.blobs = blobs

    def put(self, content):
        return self.blobs.put(content)

    def get(self, digest):
        self.blobs.reads += 1
        return self.blobs.content[digest]


class MemorySnapshots:
    def __init__(self):
        self.rows = {}
        self.profile_digest = None

    def active_profile(self, scope):
        return self.profile_digest

    def add(self, snapshot):
        self.rows[(snapshot.scope, snapshot.snapshot_id)] = snapshot

    def get(self, scope, snapshot_id):
        return self.rows.get((scope, snapshot_id))


class Source:
    def __init__(self, scope):
        self.config = SourceProfile(scope, "test-repository", ("a.py",))
        self.files = (CapturedSourceFile("a.py", b"before\r\n\x00"),)
        self.calls = []

    def profile(self, scope):
        self.calls.append("profile")
        assert scope == self.config.scope
        return self.config

    def capture(self, profile):
        self.calls.append("capture")
        return self.files


@pytest.fixture
def setup():
    backend = MemoryBackend()
    source = Source(backend.scope)
    backend.snapshots.profile_digest = source.config.digest
    service = RepositorySnapshotService(backend, source, MemoryBytes(backend.blobs))
    return backend, source, service


def test_complete_bundle_reads_only_saved_bytes_and_checks_every_file(setup):
    backend, source, service = setup
    source.config = replace(source.config, paths=("a.py", "nested/b.py"))
    source.files = (
        CapturedSourceFile("a.py", b"before\r\n\x00"),
        CapturedSourceFile("nested/b.py", b"\xff\n"),
    )
    backend.snapshots.profile_digest = source.config.digest
    snapshot = service.capture(TOKEN, backend.scope)
    original = source.files
    source.files = (CapturedSourceFile("a.py", b"working-tree-changed"),)
    bundle = service.read_bundle(TOKEN, backend.scope, snapshot.snapshot_id)
    assert bundle.snapshot == snapshot and bundle.files == original
    assert "before" not in repr(bundle)
    backend.blobs.content[snapshot.files[-1].blob.digest] = b"tampered"
    # Metadata-only get remains metadata-only; it is not complete-payload evidence.
    assert service.get(TOKEN, backend.scope, snapshot.snapshot_id) == snapshot
    with pytest.raises(SnapshotIntegrityError):
        service.read_bundle(TOKEN, backend.scope, snapshot.snapshot_id)


def test_complete_bundle_denies_before_io_and_does_not_return_before_commit(setup):
    backend, source, service = setup
    snapshot = service.capture(TOKEN, backend.scope)
    backend.blobs.reads = 0
    backend.grants = frozenset()
    with pytest.raises(ControlAccessDenied):
        service.read_bundle(TOKEN, backend.scope, snapshot.snapshot_id)
    with pytest.raises(ControlIdentityRequired):
        service.read_bundle(None, backend.scope, snapshot.snapshot_id)
    with pytest.raises(ControlResourceUnavailable):
        service.read_bundle(TOKEN, RepositoryScope(uuid4(), uuid4()), snapshot.snapshot_id)
    assert backend.blobs.reads == 0
    backend.grants = frozenset({ControlCapability.REPOSITORY_READ})
    backend.fail_commit = True
    with pytest.raises(SnapshotStorageUnavailable):
        service.read_bundle(TOKEN, backend.scope, snapshot.snapshot_id)


def test_complete_bundle_blocks_old_active_profile_before_reading_bytes(setup):
    backend, source, service = setup
    snapshot = service.capture(TOKEN, backend.scope)
    backend.snapshots.profile_digest = "sha256:" + "0" * 64
    backend.blobs.reads = 0
    with pytest.raises(ControlResourceUnavailable):
        service.read_bundle(TOKEN, backend.scope, snapshot.snapshot_id)
    assert backend.blobs.reads == 0


def test_snapshot_retains_original_bytes_and_same_bytes_have_stable_manifest(setup):
    backend, source, service = setup
    first = service.capture(TOKEN, backend.scope)
    second = service.capture(TOKEN, backend.scope)
    assert first.snapshot_id != second.snapshot_id
    assert first.manifest_blob == second.manifest_blob
    source.files = (CapturedSourceFile("a.py", b"after\n"),)
    third = service.capture(TOKEN, backend.scope)
    assert third.manifest_blob != first.manifest_blob
    assert (
        service.read_file(TOKEN, backend.scope, first.snapshot_id, first.files[0].file_id)
        == b"before\r\n\x00"
    )


def test_missing_wrong_scope_and_missing_capability_stop_before_source_io(setup):
    backend, source, service = setup
    with pytest.raises(ControlIdentityRequired):
        service.capture(None, backend.scope)
    with pytest.raises(ControlResourceUnavailable):
        service.capture(TOKEN, RepositoryScope(uuid4(), backend.scope.repo_id))
    backend.grants = frozenset()
    with pytest.raises(ControlAccessDenied):
        service.capture(TOKEN, backend.scope)
    assert source.calls == []
    assert backend.blobs.content == {}


def test_revoke_stops_all_reads_before_blob_access(setup):
    backend, _, service = setup
    snapshot = service.capture(TOKEN, backend.scope)
    before = backend.blobs.reads
    backend.grants = frozenset()
    with pytest.raises(ControlAccessDenied):
        service.get(TOKEN, backend.scope, snapshot.snapshot_id)
    with pytest.raises(ControlAccessDenied):
        service.read_file(TOKEN, backend.scope, snapshot.snapshot_id, snapshot.files[0].file_id)
    assert backend.blobs.reads == before


def test_profile_change_stops_old_snapshot_before_blob_access(setup):
    backend, source, service = setup
    snapshot = service.capture(TOKEN, backend.scope)
    before = backend.blobs.reads
    source.config = replace(source.config, paths=("other.py",))
    with pytest.raises(ControlResourceUnavailable):
        service.get(TOKEN, backend.scope, snapshot.snapshot_id)
    assert backend.blobs.reads == before


def test_unregistered_profile_cannot_capture_or_read_source(setup):
    backend, source, service = setup
    backend.snapshots.profile_digest = None
    with pytest.raises(ControlResourceUnavailable):
        service.capture(TOKEN, backend.scope)
    assert source.calls == ["profile"]
    assert backend.blobs.content == {}


def test_source_adapter_cannot_add_paths_or_exceed_registered_limits(setup):
    backend, source, service = setup
    source.files = (CapturedSourceFile("other.py", b"wrong"),)
    with pytest.raises(SnapshotIntegrityError):
        service.capture(TOKEN, backend.scope)
    source.config = replace(source.config, max_file_bytes=2)
    backend.snapshots.profile_digest = source.config.digest
    source.files = (CapturedSourceFile("a.py", b"too long"),)
    with pytest.raises(SourceLimitExceeded):
        service.capture(TOKEN, backend.scope)
    assert backend.blobs.content == {}


def test_bad_blob_adapter_does_not_publish_ready_metadata(setup):
    backend, source, _ = setup

    class WrongBytes:
        def put(self, content):
            return BlobReference(content_digest(content), len(content))

        def get(self, digest):
            return b"incorrect bytes"

    with pytest.raises(SnapshotIntegrityError):
        RepositorySnapshotService(backend, source, WrongBytes()).capture(TOKEN, backend.scope)
    assert backend.blobs.refs == {} and backend.snapshots.rows == {}


def test_commit_failure_leaves_only_orphan_bytes_and_retry_can_succeed(setup):
    backend, _, service = setup
    backend.fail_commit = True
    with pytest.raises(SnapshotStorageUnavailable):
        service.capture(TOKEN, backend.scope)
    assert backend.snapshots.rows == {} and backend.blobs.refs == {}
    assert backend.blobs.content
    backend.fail_commit = False
    snapshot = service.capture(TOKEN, backend.scope)
    assert service.get(TOKEN, backend.scope, snapshot.snapshot_id) == snapshot


def test_tampered_snapshot_records_and_bytes_are_rejected(setup):
    backend, _, service = setup
    snapshot = service.capture(TOKEN, backend.scope)
    key = (backend.scope, snapshot.snapshot_id)
    backend.snapshots.rows[key] = replace(
        snapshot, files=(replace(snapshot.files[0], path="b.py"),)
    )
    with pytest.raises(SnapshotIntegrityError):
        service.get(TOKEN, backend.scope, snapshot.snapshot_id)
    backend.snapshots.rows[key] = snapshot
    backend.blobs.content[snapshot.files[0].blob.digest] = b"tampered"
    with pytest.raises(SnapshotIntegrityError):
        service.read_file(TOKEN, backend.scope, snapshot.snapshot_id, snapshot.files[0].file_id)


def test_unknown_snapshot_and_file_are_unavailable(setup):
    backend, _, service = setup
    with pytest.raises(ControlResourceUnavailable):
        service.get(TOKEN, backend.scope, uuid4())
    snapshot = service.capture(TOKEN, backend.scope)
    with pytest.raises(ControlResourceUnavailable):
        service.read_file(TOKEN, backend.scope, snapshot.snapshot_id, uuid4())
