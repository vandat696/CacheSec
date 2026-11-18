"""Compose verified full-source context with the existing generation adapter."""

import time

from app.agent_assistance.generation import AgentError
from app.agent_assistance.repository_context import RepositoryContextPreparation
from app.change_workflow.test_profiles import EDITABLE_PATH


class CachedAgentAssistance:
    def __init__(self, contexts, model):
        self.contexts, self.model = contexts, model

    def generate(self, token, request, resolved, history, candidate=None):
        repository, snapshot = self.contexts.validate_current(token, request)
        if not self.model.configured():
            raise AgentError("MODEL_NOT_CONFIGURED")
        files = RepositoryContextPreparation.generation_files(resolved.files, candidate)
        started = time.perf_counter()
        result = self.model.generate(request["prompt"], files, history)
        generation_ms = (time.perf_counter() - started) * 1000
        self.contexts.validate_current(token, request)
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
