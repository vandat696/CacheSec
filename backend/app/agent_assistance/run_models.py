"""Bounded local Agent run state; operational progress, not research acceptance."""

from dataclasses import dataclass, field
from threading import Event
from typing import Protocol
from uuid import UUID

from app.identity.control_authority import ControlPrincipal

MAX_TURNS = 3
DEADLINE_SECONDS = 600
TERMINAL_RUNS = frozenset({"passed", "needs_input", "exhausted", "cancelled", "timed_out", "error"})


class RunAccess(Protocol):
    def current(self, token: str | None, *, execute: bool) -> ControlPrincipal: ...


class RunGeneration(Protocol):
    def config(self, token: str | None) -> dict: ...

    def ask(self, token, snapshot_id, prompt, history, candidate_content=None) -> dict: ...


class RunTools(Protocol):
    def check_source(self, token, snapshot_id) -> None: ...

    def save(self, token, snapshot_id, content, key, previous) -> dict: ...

    def request_test(self, token, revision, key) -> dict: ...

    def job(self, token, job_id) -> dict: ...

    def revision(self, token, proposal_id) -> dict: ...


@dataclass
class AgentRun:
    run_id: UUID
    actor: ControlPrincipal = field(repr=False)
    token: str | None = field(repr=False)
    fingerprint: str = field(repr=False)
    snapshot_id: UUID
    prompt: str = field(repr=False)
    started: float
    created_at: str
    model: str
    status: str = "queued"
    turn: int = 0
    revision: dict | None = field(default=None, repr=False)
    job: dict | None = None
    answer: str = ""
    error_code: str | None = None
    events: list[dict] = field(default_factory=list, repr=False)
    cancelled: Event = field(default_factory=Event, repr=False)
