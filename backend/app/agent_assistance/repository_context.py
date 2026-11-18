"""Scoped repository context preparation shared by assistance and the Agent loop.

This adapter prepares generation inputs; it does not implement cache admission,
grant authority, write candidate source or certify a deployment artifact.
"""

from dataclasses import dataclass, field
from typing import Protocol
from uuid import UUID

from app.agent_assistance.generation import AgentError
from app.change_workflow.test_profiles import EDITABLE_PATH, OVERLAY_PATHS
from app.identity.control_authority import RegisteredRepository, RepositoryScope
from app.repositories.snapshot_bundles import SnapshotBundle
from app.repositories.snapshot_models import RepositorySnapshot


class RepositoryAccess(Protocol):
    def describe_current(self, token: str | None) -> RegisteredRepository: ...


class SourceSnapshots(Protocol):
    def read_bundle(
        self, token: str | None, scope: RepositoryScope, snapshot_id: UUID
    ) -> SnapshotBundle: ...

    def capture(self, token: str | None, scope: RepositoryScope) -> RepositorySnapshot: ...


@dataclass(frozen=True)
class PreparedRepositoryContext:
    repository: RegisteredRepository
    snapshot: RepositorySnapshot
    files: tuple[tuple[str, str], ...] = field(repr=False)


class RepositoryContextPreparation:
    def __init__(self, access: RepositoryAccess, snapshots: SourceSnapshots):
        self.access, self.snapshots = access, snapshots

    def _fresh(self, token, context):
        current = self.snapshots.capture(token, context.repository.scope)
        base = context.snapshot
        if (
            current.scope != base.scope
            or current.repository_identity != base.repository_identity
            or current.profile_blob.digest != base.profile_blob.digest
            or [(f.path, f.blob) for f in current.files] != [(f.path, f.blob) for f in base.files]
        ):
            raise AgentError("STALE_SNAPSHOT", 409)

    def prepare(self, token, repository, snapshot_id, candidate_content=None):
        bundle = self.snapshots.read_bundle(token, repository.scope, snapshot_id)
        if tuple(f.path for f in bundle.files) != OVERLAY_PATHS:
            raise AgentError("AGENT_SOURCE_PROFILE_UNSUPPORTED", 403)
        if sum(len(f.content) for f in bundle.files) > 131072:
            raise AgentError("AGENT_CONTEXT_TOO_LARGE", 413)
        try:
            files = tuple((f.path, f.content.decode("utf-8-sig")) for f in bundle.files)
        except UnicodeError:
            raise AgentError("AGENT_SOURCE_NOT_TEXT", 422) from None
        files = self.generation_files(files, candidate_content)
        context = PreparedRepositoryContext(repository, bundle.snapshot, files)
        self._fresh(token, context)
        return context

    @staticmethod
    def generation_files(files, candidate_content=None):
        if tuple(path for path, _ in files) != OVERLAY_PATHS:
            raise AgentError("AGENT_SOURCE_PROFILE_UNSUPPORTED", 403)
        if sum(len(content.encode("utf-8")) for _, content in files) > 131072:
            raise AgentError("AGENT_CONTEXT_TOO_LARGE", 413)
        if candidate_content is not None:
            if (
                type(candidate_content) is not str
                or "\x00" in candidate_content
                or len(candidate_content.encode("utf-8")) > 65536
            ):
                raise AgentError("AGENT_CONTEXT_TOO_LARGE", 413)
            # Only the internal run supplies this, from its authorized revision.
            # It is an overlay for generation, never a cached base or source write.
            files = tuple(
                (path, candidate_content if path == EDITABLE_PATH else content)
                for path, content in files
            )
            if sum(len(content.encode("utf-8")) for _, content in files) > 131072:
                raise AgentError("AGENT_CONTEXT_TOO_LARGE", 413)
        return files

    def revalidate(self, token, context):
        # Re-resolve trusted identity/repository and re-read every dependency.
        # A model response cannot restore a revoked grant or stale source.
        current = self.access.describe_current(token)
        if (
            current.scope != context.repository.scope
            or current.identity != context.repository.identity
        ):
            raise AgentError("AGENT_CONTEXT_CHANGED", 409)
        self.snapshots.read_bundle(token, current.scope, context.snapshot.snapshot_id)
        self._fresh(token, context)
