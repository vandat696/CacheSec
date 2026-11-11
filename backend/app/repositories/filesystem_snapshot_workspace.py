"""Prepare saved source in a private workspace, without running it or granting its use."""

import os
import stat
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.artifacts.metadata_encoding import MAX_METADATA_BYTES, encode_metadata
from app.repositories.snapshot_bundles import SnapshotBundle
from app.repositories.snapshot_models import (
    CapturedSourceFile,
    RepositorySnapshot,
    SnapshotIntegrityError,
)


class SnapshotWorkspaceUnavailable(Exception):
    pass


def _reparse(info: os.stat_result) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(
        getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    )


def _directory(path: Path, *, create: bool) -> None:
    for part in (*reversed(path.parents), path):
        try:
            info = part.lstat()
        except FileNotFoundError:
            if not create:
                raise
            part.mkdir(mode=0o700, exist_ok=True)
            info = part.lstat()
        if _reparse(info) or not stat.S_ISDIR(info.st_mode):
            raise SnapshotIntegrityError("Workspace directory is not a regular directory.")


def _read(path: Path, limit: int) -> bytes:
    _directory(path.parent, create=False)
    before = path.lstat()
    if _reparse(before) or not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
        raise SnapshotIntegrityError("Workspace file is not a regular private file.")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    with os.fdopen(os.open(path, flags), "rb") as stream:
        opened = os.fstat(stream.fileno())
        if (
            not stat.S_ISREG(opened.st_mode)
            or opened.st_size > limit
            or opened.st_nlink != 1
            or (opened.st_dev, opened.st_ino) != (before.st_dev, before.st_ino)
        ):
            raise SnapshotIntegrityError("Workspace file changed while opening.")
        content = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
    # Compare ctime on the same handle: Windows lstat/fstat have different semantics.
    if (
        (opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns, opened.st_nlink)
        != (after.st_size, after.st_mtime_ns, after.st_ctime_ns, after.st_nlink)
        or len(content) != opened.st_size
        or len(content) > limit
    ):
        raise SnapshotIntegrityError("Workspace file changed while reading.")
    return content


def _write(path: Path, content: bytes) -> None:
    _directory(path.parent, create=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0)
    flags |= getattr(os, "O_NOFOLLOW", 0)
    with os.fdopen(os.open(path, flags, 0o600), "wb") as stream:
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())


@dataclass(frozen=True)
class PreparedSnapshot:
    """Internal location/metadata, not a bearer credential or runtime artifact."""

    directory: Path
    snapshot: RepositorySnapshot

    @property
    def source_root(self) -> Path:
        return self.directory / "source"


class FileSystemSnapshotWorkspace:
    """Trusted host only; no source execution, chmod/ACL attestation or automatic GC.

    A failed preparation can leave an unreferenced partial directory. Only a fully
    verified preparation returns a receipt. A receipt never authorizes execution;
    future consumers must recheck current authority and runtime/artifact bindings.
    The host owner is trusted; checks do not protect against privileged host races.
    """

    def __init__(self, root: Path) -> None:
        if not root.is_absolute() or root == Path(root.anchor) or ".." in root.parts:
            raise ValueError("Workspace root must be an explicit absolute non-root directory.")
        self._root = root

    def prepare(self, bundle: SnapshotBundle) -> PreparedSnapshot:
        if not isinstance(bundle, SnapshotBundle):
            raise TypeError("A complete snapshot bundle is required.")
        # Reject malformed data before touching the filesystem, including replacement adapters.
        bundle.verify()
        try:
            _directory(self._root, create=True)
            destination = Path(tempfile.mkdtemp(prefix="snapshot-", dir=self._root))
            prepared = PreparedSnapshot(destination, bundle.snapshot)
            prepared.source_root.mkdir(mode=0o700)
            for item in bundle.files:
                _write(prepared.source_root / item.path, item.content)
            _write(destination / "profile.json", bundle.profile_content)
            _write(destination / "manifest.json", encode_metadata(bundle.snapshot.manifest()))
            self.verify(prepared)
        except OSError as error:
            raise SnapshotWorkspaceUnavailable(
                "Snapshot workspace could not be prepared."
            ) from error
        return prepared

    def verify(self, prepared: PreparedSnapshot) -> None:
        if (
            not isinstance(prepared, PreparedSnapshot)
            or prepared.directory.parent != self._root
            or not prepared.directory.name.startswith("snapshot-")
            or not isinstance(prepared.snapshot, RepositorySnapshot)
        ):
            raise SnapshotIntegrityError("Workspace is outside its configured root.")
        try:
            _directory(prepared.directory, create=False)
            expected_wrapper = {"source", "profile.json", "manifest.json"}
            with os.scandir(prepared.directory) as entries:
                for item in entries:
                    if item.name not in expected_wrapper:
                        raise SnapshotIntegrityError("Workspace contains an unexpected entry.")
                    expected_wrapper.remove(item.name)
            if expected_wrapper:
                raise SnapshotIntegrityError("Workspace is incomplete.")
            _directory(prepared.source_root, create=False)
            self._verify_paths(prepared)
            manifest = _read(prepared.directory / "manifest.json", MAX_METADATA_BYTES)
            if manifest != encode_metadata(prepared.snapshot.manifest()):
                raise SnapshotIntegrityError("Workspace manifest does not match its snapshot.")
            SnapshotBundle(
                prepared.snapshot,
                _read(prepared.directory / "profile.json", MAX_METADATA_BYTES),
                tuple(
                    CapturedSourceFile(
                        item.path, _read(prepared.source_root / item.path, item.blob.byte_size)
                    )
                    for item in prepared.snapshot.files
                ),
            )
        except OSError as error:
            raise SnapshotWorkspaceUnavailable(
                "Snapshot workspace could not be verified."
            ) from error

    @staticmethod
    def _verify_paths(prepared: PreparedSnapshot) -> None:
        expected_files = {item.path for item in prepared.snapshot.files}
        expected_directories = set()
        for relative in expected_files:
            parts = relative.split("/")
            expected_directories.update("/".join(parts[:i]) for i in range(1, len(parts)))
        pending = [(prepared.source_root, "")]
        while pending:
            directory, prefix = pending.pop()
            with os.scandir(directory) as entries:
                for entry in entries:
                    relative = prefix + entry.name
                    info = entry.stat(follow_symlinks=False)
                    if _reparse(info):
                        raise SnapshotIntegrityError("Workspace contains an alias.")
                    if stat.S_ISDIR(info.st_mode) and relative in expected_directories:
                        expected_directories.remove(relative)
                        pending.append((Path(entry.path), relative + "/"))
                    elif stat.S_ISREG(info.st_mode) and relative in expected_files:
                        expected_files.remove(relative)
                    else:
                        raise SnapshotIntegrityError(
                            "Workspace contains an unexpected source path."
                        )
        if expected_files or expected_directories:
            raise SnapshotIntegrityError("Workspace source is incomplete.")
