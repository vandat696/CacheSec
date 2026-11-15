"""Atomic replacement of the single registered editable file on the trusted host."""

import os
import stat
import tempfile
from pathlib import Path

from app.artifacts.blob_models import content_digest
from app.change_workflow.test_profiles import EDITABLE_PATH, OVERLAY_PATHS
from app.repositories.filesystem_repository_source import (
    FileSystemRepositorySource,
    RepositorySourceBinding,
)
from app.repositories.snapshot_bundles import decode_snapshot_profile


class SourceWriteConflict(Exception):
    pass


class FileSystemSourceWriter:
    def __init__(self, root: Path):
        if not root.is_absolute() or root == Path(root.anchor) or ".." in root.parts:
            raise ValueError("Explicit source root required")
        self.root = root

    def observe(self, base, candidate):
        base.verify()
        candidate.verify()
        profile = decode_snapshot_profile(base.profile_content, base.snapshot)
        if (
            tuple(f.path for f in base.files) != OVERLAY_PATHS
            or tuple(f.path for f in candidate.files) != OVERLAY_PATHS
            or base.profile_content != candidate.profile_content
            or base.files[:2] != candidate.files[:2]
        ):
            raise SourceWriteConflict("Source scope differs")
        source = FileSystemRepositorySource((RepositorySourceBinding(profile, self.root),))
        current = source.capture(profile)
        if current not in (base.files, candidate.files):
            raise SourceWriteConflict("Source changed since the editor opened it")
        return source, profile, current

    def write(self, base, candidate):
        source, profile, current = self.observe(base, candidate)
        raw = next(f.content for f in candidate.files if f.path == EDITABLE_PATH)
        target = self.root / EDITABLE_PATH
        if current == candidate.files:
            return content_digest(raw)
        descriptor, name = tempfile.mkstemp(
            prefix=".cachesec-save-", suffix=".tmp", dir=target.parent
        )
        temporary = Path(name)
        try:
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(temporary, stat.S_IMODE(target.stat().st_mode))
            if source.capture(profile) != base.files:
                raise SourceWriteConflict("Source changed before replacement")
            os.replace(temporary, target)
            if os.name != "nt":
                directory = os.open(target.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
                try:
                    os.fsync(directory)
                finally:
                    os.close(directory)
            if source.capture(profile) != candidate.files:
                raise OSError("Source write could not be verified")
            return content_digest(raw)
        finally:
            if temporary.exists():
                temporary.unlink()
