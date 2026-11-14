"""Gemini generateContent adapter; structured suggestions have no tool authority."""

import json
import re
from pathlib import Path

from app.agent_assistance.assistance_prompt import INSTRUCTIONS, SCHEMA
from app.agent_assistance.generation import (
    AgentError,
    GenerationResult,
    validate_generation_result,
)
from app.agent_assistance.generation_transport import post_generation_json, private_key

MODEL = "gemini-3.5-flash-lite"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"


def decode_response(value: dict) -> GenerationResult:
    try:
        if value.get("promptFeedback", {}).get("blockReason") not in (
            None,
            "BLOCK_REASON_UNSPECIFIED",
        ):
            raise AgentError("MODEL_REFUSED", 422)
        candidates = value["candidates"]
        if type(candidates) is not list or len(candidates) != 1:
            raise ValueError()
        candidate = candidates[0]
        finish = candidate.get("finishReason")
        if finish in {"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"}:
            raise AgentError("MODEL_REFUSED", 422)
        if finish != "STOP":
            raise AgentError("MODEL_INCOMPLETE", 502)
        content = candidate["content"]
        if content.get("role") != "model" or type(content["parts"]) is not list:
            raise ValueError()
        texts = []
        for part in content["parts"]:
            if type(part) is not dict or type(part.get("text")) is not str:
                raise ValueError()
            if part.get("thought") is not True:
                texts.append(part["text"])
        data = json.loads("".join(texts))
        model = value["modelVersion"]
        if type(model) is not str or not re.fullmatch(
            re.escape(MODEL) + r"(?:-\d{3}|-\d{4}-\d{2}-\d{2})?", model
        ):
            raise ValueError()
        metadata = value.get("usageMetadata")
        usage = None
        if metadata is not None:
            if type(metadata) is not dict:
                raise ValueError()
            counts = ("promptTokenCount", "candidatesTokenCount", "totalTokenCount")
            if all(key in metadata for key in counts):
                numbers = [metadata[key] for key in counts] + [
                    metadata.get("thoughtsTokenCount", 0)
                ]
                if any(type(n) is not int or n < 0 for n in numbers):
                    raise ValueError()
                usage = {
                    "input_tokens": numbers[0],
                    "output_tokens": numbers[1] + numbers[3],
                    "total_tokens": numbers[2],
                }
        return validate_generation_result(data, model, usage)
    except (KeyError, TypeError, ValueError, AttributeError, UnicodeError):
        raise AgentError("MODEL_INVALID_RESPONSE", 502) from None


class GeminiContentGeneration:
    model_id = MODEL

    def __init__(self, config: Path | None):
        self.config = config

    def configured(self) -> bool:
        return private_key(self.config, "GEMINI_API_KEY") is not None

    def generate(self, prompt, files, history):
        key = private_key(self.config, "GEMINI_API_KEY")
        if key is None:
            raise AgentError("MODEL_NOT_CONFIGURED")
        body = {
            "systemInstruction": {"parts": [{"text": INSTRUCTIONS}]},
            "contents": [
                *[
                    {
                        "role": "model" if message["role"] == "assistant" else "user",
                        "parts": [{"text": message["content"]}],
                    }
                    for message in history
                ],
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": json.dumps(
                                {
                                    "request": prompt,
                                    "source_files": [
                                        {"path": path, "content": text} for path, text in files
                                    ],
                                },
                                ensure_ascii=False,
                            )
                        }
                    ],
                },
            ],
            "generationConfig": {
                "candidateCount": 1,
                "maxOutputTokens": 12000,
                "thinkingConfig": {"thinkingLevel": "low"},
                "responseMimeType": "application/json",
                "responseJsonSchema": SCHEMA,
            },
        }
        return decode_response(post_generation_json(ENDPOINT, {"x-goog-api-key": key}, body))
