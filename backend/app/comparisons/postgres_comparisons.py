"""Durable comparison pairs, branch checkpoints and append-only assessments."""

from contextlib import contextmanager
from datetime import datetime, timezone

import psycopg
from psycopg.types.json import Jsonb

from app.comparisons.comparison_repository import ComparisonSession
from app.comparisons.technical_assessment import technical_assessments
from app.context_cache.context_contract import ContextError
from app.identity.postgres_control_authority import PostgresControlAuthorityRepository
from app.shared.postgres_connection import DatabaseNotConfigured


class PostgresComparisonRecords:
    def __init__(self, connection):
        self.connection = connection

    def _get(self, condition, parameters):
        row = self.connection.execute(
            "SELECT record FROM control.comparison_pairs WHERE " + condition + " FOR UPDATE",
            parameters,
        ).fetchone()
        return row[0] if row else None

    def by_key(self, scope, owner, key):
        return self._get(
            "tenant_id=%s AND repo_id=%s AND owner_id=%s AND key_digest=%s",
            (scope.tenant_id, scope.repo_id, owner, key),
        )

    def get(self, scope, owner, pair_id):
        return self._get(
            "tenant_id=%s AND repo_id=%s AND owner_id=%s AND pair_id=%s",
            (scope.tenant_id, scope.repo_id, owner, pair_id),
        )

    def list(self, scope, owner):
        return [
            row[0]
            for row in self.connection.execute(
                """
                WITH owned AS (
                    SELECT pair_id, created_at, (record->>'snapshot_id') AS snapshot_id,
                           (record->>'prompt') AS prompt, (record->>'cache_state') AS cache_state,
                           (record->>'status') AS status,
                           COALESCE((record->>'session_id')::uuid, pair_id) AS session_id
                    FROM control.comparison_pairs
                    WHERE tenant_id=%s AND repo_id=%s AND owner_id=%s
                ), latest AS (
                    SELECT DISTINCT ON (session_id) * FROM owned
                    ORDER BY session_id, created_at DESC, pair_id DESC
                )
                SELECT jsonb_build_object('pair_id', latest.pair_id,
                    'session_id', latest.session_id, 'snapshot_id', latest.snapshot_id,
                    'prompt', root.prompt,
                    'created_at', latest.created_at, 'cache_state', latest.cache_state,
                    'status', latest.status)
                FROM latest JOIN owned AS root ON root.pair_id = latest.session_id
                ORDER BY latest.created_at DESC, latest.pair_id DESC LIMIT 100
                """,
                (scope.tenant_id, scope.repo_id, owner),
            ).fetchall()
        ]

    def turns(self, scope, owner, session_id):
        return [
            row[0]
            for row in self.connection.execute(
                """
                SELECT jsonb_build_object('pair_id', pair_id, 'prompt', record->>'prompt',
                    'branches', jsonb_build_object(
                        'none', jsonb_build_object('status', record#>>'{branches,none,status}',
                            'answer', COALESCE(record#>>'{branches,none,run,answer}', '')),
                        'local', jsonb_build_object('status', record#>>'{branches,local,status}',
                            'answer', COALESCE(record#>>'{branches,local,run,answer}', ''))))
                FROM control.comparison_pairs
                WHERE tenant_id=%s AND repo_id=%s AND owner_id=%s
                    AND COALESCE((record->>'session_id')::uuid, pair_id)=%s
                ORDER BY (pair_id <> %s), created_at, pair_id
                """,
                (scope.tenant_id, scope.repo_id, owner, session_id, session_id),
            ).fetchall()
        ]

    def add(self, scope, owner, key, record):
        self.connection.execute(
            "INSERT INTO control.comparison_pairs "
            "(tenant_id,repo_id,owner_id,pair_id,key_digest,record,created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,clock_timestamp())",
            (scope.tenant_id, scope.repo_id, owner, record["pair_id"], key, Jsonb(record)),
        )

    def update(self, scope, owner, record):
        self.connection.execute(
            "UPDATE control.comparison_pairs SET record=%s "
            "WHERE tenant_id=%s AND repo_id=%s AND owner_id=%s AND pair_id=%s",
            (Jsonb(record), scope.tenant_id, scope.repo_id, owner, record["pair_id"]),
        )

    def assessments(self, scope, owner, pair_id, mode):
        return [
            row[0]
            for row in self.connection.execute(
                "SELECT record FROM control.comparison_assessments "
                "WHERE tenant_id=%s AND repo_id=%s "
                "AND owner_id=%s AND pair_id=%s AND mode=%s ORDER BY turn,created_at",
                (scope.tenant_id, scope.repo_id, owner, pair_id, mode),
            ).fetchall()
        ]

    def checkpoint(self, scope, owner, pair_id, mode, instance, run):
        pair = self.get(scope, owner, pair_id)
        if pair is None:
            raise ContextError("COMPARISON_UNAVAILABLE", 404)
        branch = pair["branches"][mode]
        if branch.get("instance") != instance or branch["status"] == "incomplete":
            raise ContextError("COMPARISON_PROCESS_CHANGED")
        if run["status"] in {
            "passed",
            "needs_input",
            "exhausted",
            "cancelled",
            "timed_out",
            "error",
        }:
            branch["server_workflow_ms"] = (
                datetime.now(timezone.utc) - datetime.fromisoformat(branch["started_at"])
            ).total_seconds() * 1000
        branch["run"] = run
        branch["status"] = run["status"]
        self.update(scope, owner, pair)
        # Immutable revision references remain in the event stream across later turns.
        for event in run["events"]:
            if event["tool"] == "save_revision" and event["state"] == "completed":
                self.connection.execute(
                    "INSERT INTO control.comparison_revisions "
                    "(tenant_id,repo_id,owner_id,pair_id,mode,turn,"
                    "proposal_id,revision,artifact_digest) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                    (
                        scope.tenant_id,
                        scope.repo_id,
                        owner,
                        pair_id,
                        mode,
                        event["turn"],
                        event["proposal_id"],
                        event["revision"],
                        event["artifact_digest"],
                    ),
                )
        for assessment in technical_assessments(pair_id, mode, run):
            self.connection.execute(
                "INSERT INTO control.comparison_assessments "
                "(tenant_id,repo_id,owner_id,pair_id,mode,turn,"
                "assessment_id,criteria_version,record) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                (
                    scope.tenant_id,
                    scope.repo_id,
                    owner,
                    pair_id,
                    mode,
                    assessment["turn"],
                    assessment["assessment_id"],
                    assessment["criteria_version"],
                    Jsonb(assessment),
                ),
            )


class PostgresComparisonTransactions:
    def __init__(self, database):
        self.database = database

    @contextmanager
    def open(self):
        try:
            with self.database.connection() as connection:
                yield ComparisonSession(
                    PostgresControlAuthorityRepository(connection),
                    PostgresComparisonRecords(connection),
                )
        except (psycopg.Error, DatabaseNotConfigured) as error:
            raise ContextError("COMPARISON_STORAGE_UNAVAILABLE", 503) from error
