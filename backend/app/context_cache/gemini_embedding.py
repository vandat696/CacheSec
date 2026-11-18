"""Gemini query-only embedding adapter; never accepts repository source payloads."""

from app.agent_assistance.generation import AgentError
from app.agent_assistance.generation_transport import post_generation_json, private_key
from app.context_cache.context_contract import POLICY, ContextError, normalize_vector


class GeminiQueryEmbedding:
    def __init__(self, config):
        self.config = config

    def embed(self, prompt):
        if type(prompt) is not str or not prompt.strip() or len(prompt) > 4000:
            raise ContextError("INVALID_REQUEST", 400)
        try:
            key = private_key(self.config, "GEMINI_API_KEY")
            if key is None:
                raise ContextError("EMBEDDING_NOT_CONFIGURED", 503)
            response = post_generation_json(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
                {"x-goog-api-key": key},
                {
                    "model": "models/gemini-embedding-001",
                    "content": {"parts": [{"text": prompt}]},
                    "taskType": POLICY["task_type"],
                    "outputDimensionality": POLICY["dimensions"],
                },
            )
            return normalize_vector(response.get("embedding", {}).get("values"))
        except AgentError as error:
            raise ContextError(error.code.replace("MODEL_", "EMBEDDING_"), error.status) from None
        except (TypeError, AttributeError, OverflowError):
            raise ContextError("EMBEDDING_INVALID_RESPONSE", 502) from None
