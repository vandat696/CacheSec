"""Load one trusted exact-file source binding. Loading never changes authority or source."""

from pathlib import Path
from uuid import UUID

from pydantic import BaseModel, ConfigDict, ValidationError

from app.identity.control_authority import RepositoryScope
from app.repositories.filesystem_repository_source import RepositorySourceBinding
from app.repositories.source_profiles import SourceProfile


class RepositoryConfigurationError(Exception):
    pass


class _SourceConfiguration(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    tenant_id: UUID
    repo_id: UUID
    repository_identity: str
    root: Path
    paths: list[str]
    max_file_bytes: int = 1048576
    max_files: int = 256
    max_total_bytes: int = 20971520


def load_repository_binding(path: Path) -> RepositorySourceBinding:
    try:
        if not path.is_absolute():
            raise ValueError("Configuration path must be absolute.")
        # Configuration is trusted host input; bound it independently of source contents.
        with path.open("rb") as stream:
            raw = stream.read(65537)
        if len(raw) > 65536:
            raise ValueError("Configuration is too large.")
        config = _SourceConfiguration.model_validate_json(raw, strict=True)
        profile = SourceProfile(
            RepositoryScope(config.tenant_id, config.repo_id),
            config.repository_identity,
            tuple(config.paths),
            config.max_file_bytes,
            config.max_files,
            config.max_total_bytes,
        )
        return RepositorySourceBinding(profile, config.root)
    except (OSError, ValueError, ValidationError) as error:
        raise RepositoryConfigurationError(
            "Invalid or unavailable repository configuration."
        ) from error
