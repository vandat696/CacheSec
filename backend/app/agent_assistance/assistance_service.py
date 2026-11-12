"""Human-initiated source assistance. No delegated credential, writes or execution."""

from typing import Protocol
from uuid import UUID

from app.agent_assistance.generation import AgentError, GenerationModel
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


class AgentAssistanceService:
    def __init__(
        self, access: RepositoryAccess, snapshots: SourceSnapshots | None, model: GenerationModel
    ):
        self.access, self.snapshots, self.model = access, snapshots, model

    def config(self, token):
        self.access.describe_current(token)
        return {"model": "gpt-6.1-sol", "configured": self.model.configured(), "mode": "assisted"}

    def _fresh(self, token, scope, base):
        current = self.snapshots.capture(token, scope)
        if current.profile_blob.digest != base.profile_blob.digest or [
            (f.path, f.blob) for f in current.files
        ] != [(f.path, f.blob) for f in base.files]:
            raise AgentError("STALE_SNAPSHOT", 409)

    def ask(self, token, snapshot_id, prompt, history):
        repository = self.access.describe_current(token)
        if self.snapshots is None or not self.model.configured():
            raise AgentError("MODEL_NOT_CONFIGURED")
        bundle = self.snapshots.read_bundle(token, repository.scope, snapshot_id)
        if tuple(f.path for f in bundle.files) != OVERLAY_PATHS:
            raise AgentError("AGENT_SOURCE_PROFILE_UNSUPPORTED", 403)
        if sum(len(f.content) for f in bundle.files) > 131072:
            raise AgentError("AGENT_CONTEXT_TOO_LARGE", 413)
        try:
            files = tuple((f.path, f.content.decode("utf-8-sig")) for f in bundle.files)
        except UnicodeError:
            raise AgentError("AGENT_SOURCE_NOT_TEXT", 422) from None
        self._fresh(token, repository.scope, bundle.snapshot)
        result = self.model.generate(prompt, files, history)
        # A slow model response cannot restore revoked permission or stale source.
        self.access.describe_current(token)
        self.snapshots.read_bundle(token, repository.scope, snapshot_id)
        self._fresh(token, repository.scope, bundle.snapshot)
        return {
            "snapshot_id": str(snapshot_id),
            "repository_identity": repository.identity,
            "manifest_digest": bundle.snapshot.manifest_blob.digest,
            "editable_path": EDITABLE_PATH,
            "answer": result.answer,
            "content": result.content,
            "model": result.model,
            "usage": result.usage,
        }
