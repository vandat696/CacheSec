"""Human-initiated source assistance. No delegated credential, writes or execution."""

from app.agent_assistance.generation import AgentError, GenerationModel
from app.agent_assistance.repository_context import (
    RepositoryAccess,
    RepositoryContextPreparation,
    SourceSnapshots,
)
from app.change_workflow.test_profiles import EDITABLE_PATH


class AgentAssistanceService:
    def __init__(
        self, access: RepositoryAccess, snapshots: SourceSnapshots | None, model: GenerationModel
    ):
        self.access, self.snapshots, self.model = access, snapshots, model
        self.contexts = RepositoryContextPreparation(access, snapshots) if snapshots else None

    def config(self, token):
        self.access.describe_current(token)
        return {
            "model": self.model.model_id,
            "configured": self.model.configured(),
            "mode": "assisted",
        }

    def ask(self, token, snapshot_id, prompt, history, candidate_content=None):
        repository = self.access.describe_current(token)
        if self.contexts is None or not self.model.configured():
            raise AgentError("MODEL_NOT_CONFIGURED")
        context = self.contexts.prepare(token, repository, snapshot_id, candidate_content)
        result = self.model.generate(prompt, context.files, history)
        self.contexts.revalidate(token, context)
        return {
            "snapshot_id": str(snapshot_id),
            "repository_identity": repository.identity,
            "manifest_digest": context.snapshot.manifest_blob.digest,
            "editable_path": EDITABLE_PATH,
            "answer": result.answer,
            "content": result.content,
            "model": result.model,
            "usage": result.usage,
        }
