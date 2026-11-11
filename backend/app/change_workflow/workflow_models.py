from typing import Literal, TypedDict
from uuid import UUID

JobStatus = Literal[
    "queued", "preparing", "running", "passed", "failed", "error", "timed_out", "blocked", "unknown"
]
TERMINAL_STATUSES = frozenset({"passed", "failed", "error", "timed_out", "blocked", "unknown"})


class RevisionRecord(TypedDict):
    proposal_id: UUID
    revision: int
    base_snapshot_id: UUID
    candidate_snapshot_id: UUID
    created_by: UUID
    patch_digest: str
    patch_size: int
    artifact_digest: str
    artifact_size: int
    profile_digest: str
    created_at: str


class CheckResult(TypedDict):
    name: str
    passed: bool


class TestResult(TypedDict):
    outcome: JobStatus
    reason: str
    elapsed_ms: int
    checks: list[CheckResult]


class JobRecord(TypedDict):
    job_id: UUID
    proposal_id: UUID
    revision: int
    actor_id: UUID
    credential_version: int
    credential_digest: bytes
    artifact_digest: str
    profile_digest: str
    status: JobStatus
    worker_id: UUID | None
    ticket: UUID | None
    result: TestResult | None
    evidence_digest: str | None
    evidence_size: int | None
    created_at: str
    updated_at: str


def job_view(job: JobRecord) -> dict:
    return {
        key: job[key]
        for key in (
            "job_id",
            "proposal_id",
            "revision",
            "artifact_digest",
            "profile_digest",
            "status",
            "result",
            "evidence_digest",
            "created_at",
            "updated_at",
        )
    }
