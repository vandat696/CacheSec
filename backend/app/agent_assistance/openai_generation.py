"""Bounded, non-streaming Responses adapter. No shell, network tools or implicit retry."""

import json
from pathlib import Path

from app.agent_assistance.assistance_prompt import INSTRUCTIONS, SCHEMA
from app.agent_assistance.generation import AgentError, GenerationResult, validate_generation_result
from app.agent_assistance.generation_transport import post_generation_json, private_key

MODEL = "gpt-6.1-sol"


def decode_response(value: dict) -> GenerationResult:
    if value.get("status") != "completed":
        raise AgentError("MODEL_INCOMPLETE", 502)
    texts = []
    for item in value.get("output", []):
        if item.get("type") != "message" or item.get("role") != "assistant":
            continue
        for part in item.get("content", []):
            if part.get("type") == "refusal":
                raise AgentError("MODEL_REFUSED", 422)
            if part.get("type") == "output_text":
                texts.append(part["text"])
    try:
        data = json.loads("".join(texts))
        model = value["model"]
        if type(model) is not str or not (model == MODEL or model.startswith(MODEL + "-")):
            raise ValueError()
        usage = value.get("usage")
        if usage is not None:
            usage = {key: usage[key] for key in ("input_tokens", "output_tokens", "total_tokens")}
            if any(type(n) is not int or n < 0 for n in usage.values()):
                raise ValueError()
        return validate_generation_result(data, model, usage)
    except (KeyError, TypeError, ValueError, UnicodeError):
        raise AgentError("MODEL_INVALID_RESPONSE", 502) from None


class OpenAIResponsesGeneration:
    model_id = MODEL

    def __init__(self, config: Path | None):
        self.config = config

    def _key(self) -> str | None:
        return private_key(self.config, "OPENAI_API_KEY")

    def configured(self) -> bool:
        return self._key() is not None

    def generate(self, prompt, files, history):
        key = self._key()
        if key is None:
            raise AgentError("MODEL_NOT_CONFIGURED")
        body = {
            "model": MODEL,
            "store": False,
            "max_output_tokens": 12000,
            "reasoning": {"effort": "low"},
            "instructions": INSTRUCTIONS,
            "input": [
                *history,
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "request": prompt,
                            "source_files": [
                                {"path": path, "content": text} for path, text in files
                            ],
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "code_assistance",
                    "strict": True,
                    "schema": SCHEMA,
                }
            },
        }
        return decode_response(
            post_generation_json(
                "https://api.openai.com/v1/responses", {"Authorization": "Bearer " + key}, body
            )
        )
