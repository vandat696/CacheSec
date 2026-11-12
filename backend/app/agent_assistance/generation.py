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
    def configured(self) -> bool: ...

    def generate(
        self, prompt: str, files: tuple[tuple[str, str], ...], history: list[dict]
    ) -> GenerationResult: ...
