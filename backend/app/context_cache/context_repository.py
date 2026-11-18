"""Ports owned by context preparation/resolution; no SQL or HTTP dependencies."""

from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Protocol

from app.identity.control_authority import ControlAuthorityRepository
from app.repositories.repository_snapshots import SnapshotSession
from app.repositories.snapshot_bundles import SnapshotBundle
from app.repositories.snapshot_models import RepositorySnapshot


class ContextRecords(Protocol):
    def add_request(self, scope, owner, record: dict) -> None: ...
    def request(self, scope, owner, request_id) -> dict | None: ...
    def bind(self, scope, owner, request_id, resolution: dict) -> None: ...
    def add_entry(self, scope, owner, record: dict) -> None: ...
    def entry(self, scope, owner, entry_id) -> dict | None: ...


@dataclass(frozen=True)
class ContextSession:
    authority: ControlAuthorityRepository
    snapshot: SnapshotSession
    records: ContextRecords


class ContextTransactions(Protocol):
    def open(self) -> AbstractContextManager[ContextSession]: ...


class ContextSource(Protocol):
    def describe_in_transaction(
        self, session, scope, snapshot_id, identity
    ) -> RepositorySnapshot: ...
    def read_in_transaction(self, session, scope, snapshot_id, identity) -> SnapshotBundle: ...
    def matches_current_files(self, snapshot: RepositorySnapshot) -> bool: ...
