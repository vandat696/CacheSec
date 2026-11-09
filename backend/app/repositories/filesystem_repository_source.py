"""Bounded two-pass capture from explicitly configured, trusted local source roots."""

import os
import stat
from dataclasses import dataclass
from pathlib import Path

from app.identity.control_authority import ControlResourceUnavailable, RepositoryScope
from app.repositories.snapshot_models import (
    CapturedSourceFile,
    SourceChanged,
    SourceLimitExceeded,
    SourceUnavailable,
)
from app.repositories.source_profiles import SourceProfile


def _reparse(info: os.stat_result) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(
        getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    )


def _fingerprint(info: os.stat_result) -> tuple:
    return (
        info.st_dev,
        info.st_ino,
        info.st_mode,
        info.st_size,
        info.st_mtime_ns,
        info.st_nlink,
    )


@dataclass(frozen=True)
class RepositorySourceBinding:
    profile: SourceProfile
    root: Path

    def __post_init__(self) -> None:
        if (
            not isinstance(self.profile, SourceProfile)
            or not self.root.is_absolute()
            or self.root == Path(self.root.anchor)
            or ".." in self.root.parts
        ):
            raise ValueError("Source root must be an explicit absolute non-root directory.")


class FileSystemRepositorySource:
    """No glob/walk, code execution, Git commands or caller-selected paths.

    The host/configuration is trusted. Two matching passes detect observed edits;
    they do not establish a point-in-time filesystem snapshot or resist host races.
    """

    def __init__(self, bindings: tuple[RepositorySourceBinding, ...]) -> None:
        self._bindings = {binding.profile.scope: binding for binding in bindings}
        if len(self._bindings) != len(bindings):
            raise ValueError("Only one source profile may be configured per repository scope.")

    def profile(self, scope: RepositoryScope) -> SourceProfile:
        binding = self._bindings.get(scope)
        if binding is None:
            raise ControlResourceUnavailable()
        return binding.profile

    def _path(self, binding: RepositorySourceBinding, relative: str) -> Path:
        root = binding.root
        for parent in (*reversed(root.parents), root):
            info = parent.lstat()
            if _reparse(info) or not stat.S_ISDIR(info.st_mode):
                raise SourceUnavailable("Source directory is not a regular directory.")
        current = root
        segments = relative.split("/")
        for index, segment in enumerate(segments):
            # Reject wrong case, case collisions and Windows short-name aliases.
            with os.scandir(current) as entries:
                names = [entry.name for entry in entries if entry.name.lower() == segment.lower()]
            if names != [segment]:
                raise SourceUnavailable("Source path is missing or aliased.")
            current = current / segment
            info = current.lstat()
            if _reparse(info) or (index < len(segments) - 1 and not stat.S_ISDIR(info.st_mode)):
                raise SourceUnavailable("Source path is not a regular path.")
        return current

    def _read(self, binding: RepositorySourceBinding, relative: str) -> tuple[bytes, tuple]:
        path = self._path(binding, relative)
        before = path.lstat()
        if _reparse(before) or not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
            raise SourceUnavailable("Source must be a regular file without hard-link aliases.")
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
        with os.fdopen(os.open(path, flags), "rb") as handle:
            opened = os.fstat(handle.fileno())
            if _fingerprint(before) != _fingerprint(opened):
                raise SourceChanged("Source changed while being opened.")
            if opened.st_size > binding.profile.max_file_bytes:
                raise SourceLimitExceeded("Source file exceeds its byte limit.")
            content = handle.read(binding.profile.max_file_bytes + 1)
            after = os.fstat(handle.fileno())
        # On Windows path/handle queries can disagree on ctime. Compare it only
        # between handle observations, retaining it in the cross-pass fingerprint.
        if (
            _fingerprint(opened) != _fingerprint(after)
            or opened.st_ctime_ns != after.st_ctime_ns
            or len(content) != opened.st_size
        ):
            raise SourceChanged("Source changed while being read.")
        if len(content) > binding.profile.max_file_bytes:
            raise SourceLimitExceeded("Source file exceeds its byte limit.")
        return content, (*_fingerprint(after), after.st_ctime_ns)

    def capture(self, profile: SourceProfile) -> tuple[CapturedSourceFile, ...]:
        binding = self._bindings.get(profile.scope)
        if binding is None or binding.profile != profile:
            raise ControlResourceUnavailable()
        try:
            captured = []
            total = 0
            for relative in profile.paths:
                content, fingerprint = self._read(binding, relative)
                total += len(content)
                if total > profile.max_total_bytes:
                    raise SourceLimitExceeded("Source set exceeds its byte limit.")
                captured.append((CapturedSourceFile(relative, content), fingerprint))
            for item, fingerprint in captured:
                content, current = self._read(binding, item.path)
                if current != fingerprint or content != item.content:
                    raise SourceChanged("Source changed during capture.")
            return tuple(item for item, _ in captured)
        except OSError as error:
            raise SourceUnavailable("Repository source is unavailable.") from error
