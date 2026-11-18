"""Persistence ports for owned comparison pairs and branch progress."""

from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Protocol

from app.identity.control_authority import ControlAuthorityRepository


class ComparisonRecords(Protocol):
    def by_key(self, scope, owner, key): ...
    def add(self, scope, owner, key, record): ...
    def get(self, scope, owner, pair_id): ...
    def list(self, scope, owner): ...
    def update(self, scope, owner, record): ...
    def checkpoint(self, scope, owner, pair_id, mode, instance, run): ...
    def assessments(self, scope, owner, pair_id, mode): ...


@dataclass(frozen=True)
class ComparisonSession:
    authority: ControlAuthorityRepository
    records: ComparisonRecords


class ComparisonTransactions(Protocol):
    def open(self) -> AbstractContextManager[ComparisonSession]: ...
