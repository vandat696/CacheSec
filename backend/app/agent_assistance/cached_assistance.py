"""Compose verified full-source context with the existing generation adapter."""

import time

from app.agent_assistance.generation import AgentError, GenerationModels
from app.agent_assistance.repository_context import RepositoryContextPreparation
from app.change_workflow.test_profiles import EDITABLE_PATH


class CachedAgentAssistance:
    def __init__(self, contexts, models: GenerationModels):
        self.contexts, self.models = contexts, models

    def generate(self, token, request, resolved, history, candidate=None):
        model = self.models.select(request.get("model"))
        repository, snapshot = self.contexts.validate_current(token, request, model.model_id)
        if not model.configured():
            raise AgentError("MODEL_NOT_CONFIGURED")
        files = RepositoryContextPreparation.generation_files(resolved.files, candidate)
        started = time.perf_counter()
        result = model.generate(request["prompt"], files, history)
        generation_ms = (time.perf_counter() - started) * 1000
        self.contexts.validate_current(token, request, model.model_id)
        return {
            "snapshot_id": request["snapshot_id"],
            "repository_identity": repository.identity,
            "manifest_digest": snapshot.manifest_blob.digest,
            "editable_path": EDITABLE_PATH,
            "answer": result.answer,
            "content": result.content,
            "model": result.model,
            "usage": result.usage,
            "generation_ms": generation_ms,
        }
