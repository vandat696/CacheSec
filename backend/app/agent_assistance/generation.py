"""Generation contract; model output has no execution or authorization authority."""

from dataclasses import dataclass, field
from typing import Protocol


class AgentError(Exception):
    def __init__(self, code: str, status: int = 503):
        super().__init__(code)
        self.code, self.status = code, status


@dataclass(frozen=True)
class GenerationResult:
    answer: str = field(repr=False)
    content: str | None = field(repr=False)
    model: str
    usage: dict | None


class GenerationModel(Protocol):
    @property
    def model_id(self) -> str: ...

    def configured(self) -> bool: ...

    def generate(
        self, prompt: str, files: tuple[tuple[str, str], ...], history: list[dict]
    ) -> GenerationResult: ...


class GenerationModels:
    def __init__(self, default: GenerationModel, alternatives: tuple[GenerationModel, ...] = ()):
        self.default = default
        self._models = {model.model_id: model for model in (default, *alternatives)}

    def ids(self) -> list[str]:
        return list(self._models)

    def select(self, model_id: str | None = None) -> GenerationModel:
        if model_id is None:
            return self.default
        if model_id not in self._models:
            raise AgentError("MODEL_NOT_SUPPORTED", 400)
        return self._models[model_id]


def validate_generation_result(data: object, model: str, usage: dict | None) -> GenerationResult:
    """Validate both adapters against the same bounded output contract."""
    if (
        type(data) is not dict
        or set(data) != {"answer", "content"}
        or type(data["answer"]) is not str
        or not 1 <= len(data["answer"]) <= 16000
        or (
            data["content"] is not None
            and (
                type(data["content"]) is not str
                or len(data["content"].encode("utf-8")) > 65536
                or "\x00" in data["content"]
            )
        )
        or (
            usage is not None
            and (
                set(usage) != {"input_tokens", "output_tokens", "total_tokens"}
                or any(type(n) is not int or n < 0 for n in usage.values())
            )
        )
    ):
        raise AgentError("MODEL_INVALID_RESPONSE", 502)
    return GenerationResult(data["answer"], data["content"], model, usage)
