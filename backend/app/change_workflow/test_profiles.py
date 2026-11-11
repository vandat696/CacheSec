"""Trusted technical-smoke recipe. Clients never supply commands, mounts or images."""

import json
import re
from dataclasses import dataclass
from pathlib import Path

from app.artifacts.blob_models import require_blob_digest
from app.artifacts.metadata_encoding import encode_metadata, metadata_digest

EDITABLE_PATH = "backend/app/quotation_demo/business/quotation_validation.py"
OVERLAY_PATHS = tuple(
    "backend/app/quotation_demo/business/" + name
    for name in (
        "quotation_models.py",
        "quotation_service.py",
        "quotation_validation.py",
    )
)
CHECK_NAMES = (
    "identity_required",
    "record_round_trip",
    "reader_write_denied",
    "idempotent_retry",
    "validation_contract",
)


@dataclass(frozen=True)
class TechnicalTestProfile:
    runtime_image: str
    harness_image: str
    database_image: str
    lockfile_digest: str
    suite_digest: str
    inventory_digest: str
    protected_files: tuple[tuple[str, str], ...]
    deadline_seconds: int = 120
    platform: str = "linux/amd64"

    def __post_init__(self):
        for image in (self.runtime_image, self.harness_image, self.database_image):
            if not re.fullmatch(r"sha256:[0-9a-f]{64}", image):
                raise ValueError("Pinned Docker image IDs are required.")
        for digest in (self.lockfile_digest, self.suite_digest, self.inventory_digest):
            require_blob_digest(digest)
        if tuple(path for path, _ in self.protected_files) != OVERLAY_PATHS[:2]:
            raise ValueError("Protected files must match the fixed overlay.")
        for _, digest in self.protected_files:
            require_blob_digest(digest)
        if (
            self.platform != "linux/amd64"
            or type(self.deadline_seconds) is not int
            or not 5 <= self.deadline_seconds <= 120
        ):
            raise ValueError("Invalid technical test limits.")

    def metadata(self) -> dict:
        return {
            "kind": "quotation-technical-test-profile",
            "schema_version": 1,
            "runtime_image": self.runtime_image,
            "harness_image": self.harness_image,
            "database_image": self.database_image,
            "protected_files": dict(self.protected_files),
            "lockfile_digest": self.lockfile_digest,
            "suite_digest": self.suite_digest,
            "inventory_digest": self.inventory_digest,
            "deadline_seconds": self.deadline_seconds,
            "platform": self.platform,
            "editable_path": EDITABLE_PATH,
            "overlay_paths": list(OVERLAY_PATHS),
            "cpu": 1,
            "memory_mib": 512,
            "pids": 128,
            "tmpfs_mib": 64,
            "output_bytes_per_stream": 1048576,
            "checks": list(CHECK_NAMES),
            "purpose": "technical-smoke",
        }

    @property
    def digest(self) -> str:
        return metadata_digest(self.metadata())

    @classmethod
    def from_metadata(cls, data: dict):
        profile = cls(
            **{
                key: data[key]
                for key in (
                    "runtime_image",
                    "harness_image",
                    "database_image",
                    "lockfile_digest",
                    "suite_digest",
                    "inventory_digest",
                    "deadline_seconds",
                    "platform",
                )
            },
            protected_files=tuple(sorted(data["protected_files"].items())),
        )
        if encode_metadata(data) != encode_metadata(profile.metadata()):
            raise ValueError("Profile does not match the registered recipe.")
        return profile


def load_test_profile(path: Path) -> TechnicalTestProfile:
    if not path.is_absolute():
        raise ValueError("Profile configuration must be absolute.")
    with path.open("rb") as stream:
        raw = stream.read(65537)
    if len(raw) > 65536:
        raise ValueError("Profile is too large.")
    return TechnicalTestProfile.from_metadata(json.loads(raw))
