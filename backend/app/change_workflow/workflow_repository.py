"""Transaction ports owned by the change/test use cases."""

from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from app.change_workflow.workflow_models import JobRecord, RevisionRecord
from app.identity.control_authority import RepositoryScope
from app.repositories.repository_snapshots import SnapshotSession
from app.repositories.snapshot_bundles import SnapshotBundle
from app.repositories.snapshot_models import CapturedSourceFile, RepositorySnapshot


class WorkflowError(Exception):
    def __init__(self, code: str, status: int = 409):
        self.code, self.status = code, status
        super().__init__(code)


class WorkflowStorageUnavailable(Exception):
    pass


class WorkflowRepository(Protocol):
    def active_profile(self, scope: RepositoryScope) -> str | None: ...
    def get_proposal(self, scope: RepositoryScope, proposal_id: UUID) -> RevisionRecord | None: ...
    def add_revision(
        self, scope: RepositoryScope, record: RevisionRecord, expected: int
    ) -> None: ...
    def get_revision(
        self, scope: RepositoryScope, proposal_id: UUID, revision: int
    ) -> RevisionRecord | None: ...
    def list_jobs(self, scope: RepositoryScope, proposal_id: UUID) -> list[JobRecord]: ...
    def get_job(self, scope: RepositoryScope, job_id: UUID) -> JobRecord | None: ...
    def add_job(self, scope: RepositoryScope, record: JobRecord) -> None: ...
    def next_job(self, scope: RepositoryScope) -> JobRecord | None: ...
    def update_job(self, scope: RepositoryScope, record: JobRecord) -> None: ...
    def owned_jobs(self, scope: RepositoryScope, worker_id: UUID) -> list[JobRecord]: ...
    def get_request(
        self, scope: RepositoryScope, actor: UUID, key: str
    ) -> tuple[str, dict] | None: ...
    def save_request(
        self, scope: RepositoryScope, actor: UUID, key: str, payload: str, result: dict
    ) -> None: ...


@dataclass(frozen=True)
class WorkflowSession:
    snapshot: SnapshotSession
    workflow: WorkflowRepository


class WorkflowTransactions(Protocol):
    def open(self) -> AbstractContextManager[WorkflowSession]: ...


class WorkflowSnapshots(Protocol):
    def read_in_transaction(
        self, session: SnapshotSession, scope: RepositoryScope, snapshot_id: UUID, identity: str
    ) -> SnapshotBundle: ...
    def store_in_transaction(
        self,
        session: SnapshotSession,
        base: SnapshotBundle,
        captured: tuple[CapturedSourceFile, ...],
        actor: UUID,
        epoch: int,
    ) -> RepositorySnapshot: ...
    def matches_working_tree(self, bundle: SnapshotBundle) -> bool: ...
