"""Scoped persistent operations; all callers first hold the scope authority lock."""

from uuid import UUID

from psycopg.types.json import Jsonb


class PostgresOperations:
    def __init__(self, connection):
        self.connection = connection

    def now(self):
        return float(
            self.connection.execute("SELECT extract(epoch FROM clock_timestamp())").fetchone()[0]
        )

    def get(self, scope, identifier):
        row = self.connection.execute(
            "SELECT document FROM control.workspace_operations "
            "WHERE tenant_id=%s AND repo_id=%s AND operation_id=%s FOR UPDATE",
            (scope.tenant_id, scope.repo_id, identifier),
        ).fetchone()
        return row[0] if row else None

    def add(self, scope, record):
        self.connection.execute(
            "INSERT INTO control.workspace_operations VALUES (%s,%s,%s,%s,%s,%s)",
            (
                scope.tenant_id,
                scope.repo_id,
                UUID(record["id"]),
                record["kind"],
                record["status"],
                Jsonb(record),
            ),
        )
        self._event(scope, record)

    def update(self, scope, record):
        self.connection.execute(
            "UPDATE control.workspace_operations SET status=%s,document=%s "
            "WHERE tenant_id=%s AND repo_id=%s AND operation_id=%s AND kind=%s",
            (
                record["status"],
                Jsonb(record),
                scope.tenant_id,
                scope.repo_id,
                UUID(record["id"]),
                record["kind"],
            ),
        )
        self._event(scope, record)

    def pending(self, scope, worker=None):
        rows = self.connection.execute(
            "SELECT document FROM control.workspace_operations "
            "WHERE tenant_id=%s AND repo_id=%s AND kind IN ('write','activation') "
            "AND status IN ('queued','preparing','running','unknown') "
            "ORDER BY document->>'created_at' FOR UPDATE",
            (scope.tenant_id, scope.repo_id),
        ).fetchall()
        return [r[0] for r in rows if worker is None or r[0].get("worker_id") == worker]

    def _event(self, scope, record):
        self.connection.execute(
            "INSERT INTO control.change_workflow_events "
            "(tenant_id,repo_id,event_id,resource_id,kind) "
            "VALUES (%s,%s,gen_random_uuid(),%s,%s)",
            (
                scope.tenant_id,
                scope.repo_id,
                UUID(record["id"]),
                "workspace_" + record["kind"] + "_" + record["status"],
            ),
        )
