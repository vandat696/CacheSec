"""Portable exact-file source profiles supplied by trusted backend configuration."""

import re
from dataclasses import dataclass

from app.artifacts.blob_models import MAX_BLOB_BYTES, content_digest
from app.artifacts.metadata_encoding import encode_metadata
from app.identity.control_authority import RepositoryScope

MAX_SOURCE_FILES = 256
MAX_SOURCE_BYTES = 20 * 1024 * 1024
_SEGMENT = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_.-]*", re.ASCII)
_RESERVED = {"con", "prn", "aux", "nul", "conin$", "conout$"} | {
    f"{prefix}{number}" for prefix in ("com", "lpt") for number in range(1, 10)
}
_EXCLUDED = {
    "node_modules",
    "__pycache__",
    "secrets",
    "credentials",
    "test-results",
}


def require_source_path(path: str) -> None:
    if type(path) is not str or not path:
        raise ValueError("Source path must be a relative exact-file path.")
    for segment in path.split("/"):
        lowered = segment.lower()
        if (
            not _SEGMENT.fullmatch(segment)
            or segment.endswith(".")
            or lowered.split(".")[0] in _RESERVED
            or lowered in _EXCLUDED
            or lowered.startswith(("secrets.", "secrets_", "credentials.", "credentials_"))
            or lowered.endswith((".pem", ".key", ".pfx", ".p12", ".env"))
        ):
            raise ValueError("Source path is excluded or is not portable and unambiguous.")


def require_repository_identity(identity: str) -> None:
    if (
        type(identity) is not str
        or not 1 <= len(identity) <= 128
        or not identity.isascii()
        or not all(33 <= ord(char) <= 126 for char in identity)
    ):
        raise ValueError("Invalid repository identity.")


@dataclass(frozen=True)
class SourceProfile:
    scope: RepositoryScope
    repository_identity: str
    paths: tuple[str, ...]
    max_file_bytes: int = MAX_BLOB_BYTES
    max_files: int = MAX_SOURCE_FILES
    max_total_bytes: int = MAX_SOURCE_BYTES

    def __post_init__(self) -> None:
        if not isinstance(self.scope, RepositoryScope):
            raise ValueError("Invalid source scope.")
        require_repository_identity(self.repository_identity)
        if (
            type(self.paths) is not tuple
            or type(self.max_file_bytes) is not int
            or not 1 <= self.max_file_bytes <= MAX_BLOB_BYTES
            or type(self.max_files) is not int
            or not 1 <= self.max_files <= MAX_SOURCE_FILES
            or type(self.max_total_bytes) is not int
            or not 1 <= self.max_total_bytes <= MAX_SOURCE_BYTES
            or not 1 <= len(self.paths) <= self.max_files
        ):
            raise ValueError("Invalid source profile limits.")
        for path in self.paths:
            require_source_path(path)
        keys = [path.lower() for path in self.paths]
        if len(set(keys)) != len(keys):
            raise ValueError("Source profile contains duplicate or case-aliased paths.")
        for key in keys:
            if any(key.startswith(other + "/") for other in keys if other != key):
                raise ValueError("A source file cannot also be a directory.")
        object.__setattr__(self, "paths", tuple(sorted(self.paths)))
        encode_metadata(self.metadata())

    def metadata(self) -> dict:
        return {
            "kind": "repository-source-profile",
            "schema_version": 1,
            "tenant_id": str(self.scope.tenant_id),
            "repo_id": str(self.scope.repo_id),
            "repository_identity": self.repository_identity,
            "paths": list(self.paths),
            "max_file_bytes": self.max_file_bytes,
            "max_files": self.max_files,
            "max_total_bytes": self.max_total_bytes,
        }

    @property
    def digest(self) -> str:
        return content_digest(encode_metadata(self.metadata()))
