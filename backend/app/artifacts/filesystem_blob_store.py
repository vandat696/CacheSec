"""Content-addressed bytes in a trusted, privately owned local directory."""

import os
import stat
import tempfile
from pathlib import Path

from app.artifacts.blob_models import (
    MAX_BLOB_BYTES,
    BlobBytesUnavailable,
    BlobIntegrityError,
    BlobReference,
    BlobTooLarge,
    content_digest,
    require_blob_digest,
)


def _is_reparse(info: os.stat_result) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(
        getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    )


def _directory(path: Path, *, create: bool) -> None:
    # Reject aliases before traversing them, including Windows junctions/reparse points.
    for part in (*reversed(path.parents), path):
        try:
            info = part.lstat()
        except FileNotFoundError:
            if not create:
                raise
            part.mkdir(mode=0o700, exist_ok=True)
            info = part.lstat()
        if _is_reparse(info) or not stat.S_ISDIR(info.st_mode):
            raise BlobIntegrityError("Blob directory is not a regular directory.")


class FileSystemBlobStore:
    """Atomically publish complete bytes without replacing an existing digest path.

    The host/store owner is trusted. These checks do not establish Windows ACLs or
    protect against a privileged host process racing filesystem operations.
    """

    def __init__(self, root: Path, *, max_blob_bytes: int = MAX_BLOB_BYTES) -> None:
        if type(max_blob_bytes) is not int or not 1 <= max_blob_bytes <= MAX_BLOB_BYTES:
            raise ValueError("Invalid blob byte limit.")
        if not root.is_absolute() or root == Path(root.anchor):
            raise ValueError("Blob root must be an explicit absolute non-root directory.")
        self._root = Path(os.path.abspath(root))
        self._max_blob_bytes = max_blob_bytes

    def _path(self, digest: str, *, create: bool) -> Path:
        require_blob_digest(digest)
        directory = self._root / "blobs" / "sha256"
        _directory(directory, create=create)
        return directory / digest.removeprefix("sha256:")

    def _read(self, path: Path, digest: str) -> bytes:
        info = path.lstat()
        if _is_reparse(info) or not stat.S_ISREG(info.st_mode):
            raise BlobIntegrityError("Blob is not a regular file.")
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
        with os.fdopen(os.open(path, flags), "rb") as handle:
            opened = os.fstat(handle.fileno())
            if not stat.S_ISREG(opened.st_mode) or (info.st_dev, info.st_ino) != (
                opened.st_dev,
                opened.st_ino,
            ):
                raise BlobIntegrityError("Blob changed while it was being opened.")
            if opened.st_size > self._max_blob_bytes:
                raise BlobIntegrityError("Stored blob exceeds its byte limit.")
            content = handle.read(self._max_blob_bytes + 1)
            after = os.fstat(handle.fileno())
        if (
            len(content) > self._max_blob_bytes
            or (opened.st_size, opened.st_mtime_ns) != (after.st_size, after.st_mtime_ns)
            or len(content) != opened.st_size
            or content_digest(content) != digest
        ):
            raise BlobIntegrityError("Stored blob bytes do not match their digest.")
        return content

    def put(self, content: bytes) -> BlobReference:
        if type(content) is not bytes:
            raise TypeError("Blob content must be bytes.")
        if len(content) > self._max_blob_bytes:
            raise BlobTooLarge("Blob exceeds the configured byte limit.")
        reference = BlobReference(content_digest(content), len(content))
        staged: Path | None = None
        try:
            destination = self._path(reference.digest, create=True)
            # lexists notices even a dangling symlink; it must never be replaced.
            if os.path.lexists(destination):
                if self._read(destination, reference.digest) != content:
                    raise BlobIntegrityError("Existing digest path contains different bytes.")
                return reference
            staging = self._root / "staging"
            _directory(staging, create=True)
            descriptor, name = tempfile.mkstemp(prefix="blob-", dir=staging)
            staged = Path(name)
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            _directory(destination.parent, create=False)
            try:
                # Same-filesystem hard-link publication is no-clobber. No unsafe copy fallback.
                os.link(staged, destination)
            except FileExistsError:
                pass
            # Verify the published winner, including concurrent publication of the same digest.
            if self._read(destination, reference.digest) != content:
                raise BlobIntegrityError("Published digest path contains different bytes.")
            return reference
        except OSError as error:
            raise BlobBytesUnavailable("Local blob storage is unavailable.") from error
        finally:
            if staged is not None:
                try:
                    staged.unlink(missing_ok=True)
                except OSError as error:
                    raise BlobBytesUnavailable("Blob staging cleanup failed.") from error

    def get(self, digest: str) -> bytes:
        require_blob_digest(digest)
        try:
            return self._read(self._path(digest, create=False), digest)
        except OSError as error:
            raise BlobBytesUnavailable("Local blob bytes are unavailable.") from error
