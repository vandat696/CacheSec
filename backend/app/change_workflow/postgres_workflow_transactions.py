"""Scoped workflow records share the authority/snapshot/blob SQL transaction."""

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.artifacts.postgres_blob_metadata import PostgresBlobMetadataRepository
from app.change_workflow.workflow_models import JobRecord, RevisionRecord
from app.change_workflow.workflow_repository import (
    WorkflowError,
    WorkflowSession,
    WorkflowStorageUnavailable,
)
from app.identity.postgres_control_authority import PostgresControlAuthorityRepository
from app.repositories.postgres_repository_snapshots import PostgresSnapshotRepository
from app.repositories.repository_snapshots import SnapshotSession
from app.shared.postgres_connection import DatabaseNotConfigured, PostgresDatabase

REVISION_FIELDS = (
    "proposal_id",
    "revision",
    "base_snapshot_id",
    "candidate_snapshot_id",
    "created_by",
    "patch_digest",
    "patch_size",
    "artifact_digest",
    "artifact_size",
    "profile_digest",
)
JOB_FIELDS = (
    "job_id",
    "proposal_id",
    "revision",
    "actor_id",
    "credential_version",
    "credential_digest",
    "artifact_digest",
    "profile_digest",
    "status",
    "worker_id",
    "ticket",
    "result",
    "evidence_digest",
    "evidence_size",
)


class PostgresWorkflowRepository:
    def __init__(self, connection: psycopg.Connection):
        self._connection = connection

    def _one(self, query: str, parameters: tuple) -> dict | None:
        with self._connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(query, parameters)
            row = cursor.fetchone()
        if row:
            for key in ("created_at", "updated_at"):
                if key in row:
                    row[key] = row[key].isoformat()
        return row

    def active_profile(self, scope):
        row = self._connection.execute(
            "SELECT profile_digest FROM control.technical_test_profiles "
            "WHERE tenant_id=%s AND repo_id=%s",
            (scope.tenant_id, scope.repo_id),
        ).fetchone()
        return row[0] if row else None

    def get_proposal(self, scope, proposal_id):
        return self._one(
            "SELECT r.* FROM control.proposal_revisions r JOIN control.change_proposals p "
            "USING(tenant_id,repo_id,proposal_id) WHERE r.tenant_id=%s AND r.repo_id=%s "
            "AND r.proposal_id=%s AND r.revision=p.current_revision",
            (scope.tenant_id, scope.repo_id, proposal_id),
        )

    def get_revision(self, scope, proposal_id, revision):
        return self._one(
            "SELECT * FROM control.proposal_revisions WHERE tenant_id=%s AND repo_id=%s "
            "AND proposal_id=%s AND revision=%s",
            (scope.tenant_id, scope.repo_id, proposal_id, revision),
        )

    def _event(self, scope, resource_id, kind):
        self._connection.execute(
            "INSERT INTO control.change_workflow_events "
            "(tenant_id,repo_id,event_id,resource_id,kind) VALUES (%s,%s,%s,%s,%s)",
            (scope.tenant_id, scope.repo_id, uuid4(), resource_id, kind),
        )

    def add_revision(self, scope, record: RevisionRecord, expected):
        if expected == 0:
            self._connection.execute(
                "INSERT INTO control.change_proposals VALUES (%s,%s,%s,1)",
                (scope.tenant_id, scope.repo_id, record["proposal_id"]),
            )
        else:
            changed = self._connection.execute(
                "UPDATE control.change_proposals SET current_revision=%s "
                "WHERE tenant_id=%s AND repo_id=%s AND proposal_id=%s AND current_revision=%s",
                (
                    record["revision"],
                    scope.tenant_id,
                    scope.repo_id,
                    record["proposal_id"],
                    expected,
                ),
            )
            if changed.rowcount != 1:
                raise WorkflowError("STALE_REVISION")
        columns = ",".join(REVISION_FIELDS)
        self._connection.execute(
            f"INSERT INTO control.proposal_revisions (tenant_id,repo_id,{columns}) "
            f"VALUES ({','.join(['%s'] * (len(REVISION_FIELDS) + 2))})",
            (scope.tenant_id, scope.repo_id, *(record[key] for key in REVISION_FIELDS)),
        )
        self._event(scope, record["proposal_id"], "revision_saved")

    def list_jobs(self, scope, proposal_id):
        rows = self._connection.execute(
            "SELECT job_id FROM control.technical_test_jobs WHERE tenant_id=%s "
            "AND repo_id=%s AND proposal_id=%s ORDER BY created_at DESC LIMIT 20",
            (scope.tenant_id, scope.repo_id, proposal_id),
        ).fetchall()
        return [self.get_job(scope, row[0]) for row in rows]

    def get_job(self, scope, job_id):
        return self._one(
            "SELECT * FROM control.technical_test_jobs WHERE tenant_id=%s AND repo_id=%s "
            "AND job_id=%s",
            (scope.tenant_id, scope.repo_id, job_id),
        )

    def add_job(self, scope, record: JobRecord):
        columns = ",".join(JOB_FIELDS)
        values = [
            Jsonb(record[key]) if key == "result" and record[key] is not None else record[key]
            for key in JOB_FIELDS
        ]
        self._connection.execute(
            f"INSERT INTO control.technical_test_jobs (tenant_id,repo_id,{columns}) "
            f"VALUES ({','.join(['%s'] * (len(JOB_FIELDS) + 2))})",
            (scope.tenant_id, scope.repo_id, *values),
        )
        self._event(scope, record["job_id"], "test_queued")

    def next_job(self, scope):
        return self._one(
            "SELECT * FROM control.technical_test_jobs WHERE tenant_id=%s AND repo_id=%s "
            "AND status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",
            (scope.tenant_id, scope.repo_id),
        )

    def update_job(self, scope, record: JobRecord):
        self._connection.execute(
            "UPDATE control.technical_test_jobs SET status=%s,worker_id=%s,ticket=%s,"
            "result=%s,evidence_digest=%s,evidence_size=%s,updated_at=CURRENT_TIMESTAMP "
            "WHERE tenant_id=%s AND repo_id=%s AND job_id=%s",
            (
                record["status"],
                record["worker_id"],
                record["ticket"],
                Jsonb(record["result"]) if record["result"] is not None else None,
                record["evidence_digest"],
                record["evidence_size"],
                scope.tenant_id,
                scope.repo_id,
                record["job_id"],
            ),
        )
        self._event(scope, record["job_id"], "test_" + record["status"])

    def owned_jobs(self, scope, worker_id):
        rows = self._connection.execute(
            "SELECT job_id FROM control.technical_test_jobs WHERE tenant_id=%s "
            "AND repo_id=%s AND worker_id=%s AND status IN ('preparing','running')",
            (scope.tenant_id, scope.repo_id, worker_id),
        ).fetchall()
        return [self.get_job(scope, row[0]) for row in rows]

    def get_request(self, scope, actor, key):
        return self._connection.execute(
            "SELECT payload_digest,result FROM control.change_workflow_requests "
            "WHERE tenant_id=%s AND repo_id=%s AND actor_id=%s AND key_digest=%s",
            (scope.tenant_id, scope.repo_id, actor, key),
        ).fetchone()

    def save_request(self, scope, actor, key, payload, result):
        self._connection.execute(
            "INSERT INTO control.change_workflow_requests VALUES (%s,%s,%s,%s,%s,%s)",
            (scope.tenant_id, scope.repo_id, actor, key, payload, Jsonb(result)),
        )


class PostgresWorkflowTransactions:
    def __init__(self, database: PostgresDatabase):
        self._database = database

    @contextmanager
    def open(self) -> Iterator[WorkflowSession]:
        try:
            with self._database.connection() as connection:
                yield WorkflowSession(
                    SnapshotSession(
                        PostgresControlAuthorityRepository(connection),
                        PostgresBlobMetadataRepository(connection),
                        PostgresSnapshotRepository(connection),
                    ),
                    PostgresWorkflowRepository(connection),
                )
        except (psycopg.Error, DatabaseNotConfigured) as error:
            raise WorkflowStorageUnavailable("Workflow storage is unavailable.") from error
