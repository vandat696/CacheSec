"""Strict browser and trusted-worker HTTP inputs."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateProposal(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    base_snapshot_id: UUID
    content: str = Field(strict=True, max_length=65536)


class SaveRevision(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    expected_revision: int = Field(strict=True, ge=1)
    content: str = Field(strict=True, max_length=65536)


class TestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    revision: int = Field(strict=True, ge=1)


class WorkerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    worker_id: UUID


class WorkerClaim(WorkerRequest):
    ticket: UUID


class WorkerResult(WorkerClaim):
    result: dict
