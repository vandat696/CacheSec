import hashlib
import json
from typing import Any
from uuid import UUID, uuid4

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.json import Json

from app.quotation_demo.application.quotation_repository import (
    QuotationCreationIdentity,
    QuotationIdempotencyConflict,
    QuotationPersistenceError,
)
from app.quotation_demo.domain.quotation import QuotationCreate, QuotationPage, QuotationRecord

_COLUMNS = (
    "id, supplier_name, description, total_amount, currency, expires_on, "
    "expires_on IS NOT NULL AS expires_on_is_present"
)


def _json_dumps(value: object) -> str:
    return json.dumps(value, allow_nan=False)


def _record(row: dict[str, Any]) -> QuotationRecord:
    values = dict(row)
    if not values.pop("expires_on_is_present"):
        del values["expires_on"]
    return QuotationRecord(**values)


class PostgresQuotationRepository:
    """Caller owns the transaction. This adapter does not grant access or commit."""

    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def create(self, data: QuotationCreate) -> QuotationRecord:
        expiration = (
            Json(data.expires_on, dumps=_json_dumps) if data.expires_on_is_present else None
        )
        with self._connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                "INSERT INTO quotation_demo.quotations "
                "(id, supplier_name, description, total_amount, currency, expires_on) "
                "VALUES (%s, %s, %s, %s, %s, %s) RETURNING " + _COLUMNS,
                (
                    uuid4(),
                    data.supplier_name,
                    data.description,
                    data.total_amount,
                    data.currency,
                    expiration,
                ),
            )
            row = cursor.fetchone()
        if row is None:
            raise RuntimeError("Quotation insert returned no record.")
        return _record(row)

    def get(self, quotation_id: UUID) -> QuotationRecord | None:
        with self._connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                "SELECT " + _COLUMNS + " FROM quotation_demo.quotations WHERE id = %s",
                (quotation_id,),
            )
            row = cursor.fetchone()
        return _record(row) if row is not None else None

    def create_once(
        self, data: QuotationCreate, identity: QuotationCreationIdentity
    ) -> QuotationRecord:
        key_hash = hashlib.sha256(identity.idempotency_key.encode("ascii")).hexdigest()
        canonical_payload = json.dumps(
            data.model_dump(mode="json", exclude_unset=True),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
            allow_nan=False,
        )
        payload_hash = hashlib.sha256(canonical_payload.encode("utf-8")).hexdigest()
        lock_material = json.dumps([identity.principal_id, identity.scope_id, key_hash])
        lock_id = int.from_bytes(hashlib.sha256(lock_material.encode()).digest()[:8], signed=True)
        self._connection.execute("SELECT pg_catalog.pg_advisory_xact_lock(%s)", (lock_id,))
        existing = self._connection.execute(
            "SELECT payload_hash, quotation_id FROM quotation_demo.creation_requests "
            "WHERE principal_id=%s AND scope_id=%s AND key_hash=%s",
            (identity.principal_id, identity.scope_id, key_hash),
        ).fetchone()
        if existing:
            if existing[0] != payload_hash:
                raise QuotationIdempotencyConflict("Idempotency key was used with another payload.")
            record = self.get(existing[1])
            if record is None:
                raise QuotationPersistenceError("Creation request has no quotation record.")
            return record
        record = self.create(data)
        self._connection.execute(
            "INSERT INTO quotation_demo.creation_requests "
            "(principal_id,scope_id,key_hash,payload_hash,quotation_id) VALUES (%s,%s,%s,%s,%s)",
            (identity.principal_id, identity.scope_id, key_hash, payload_hash, record.id),
        )
        return record

    def list(self, *, limit: int = 50, after: UUID | None = None) -> QuotationPage:
        if type(limit) is not int or limit < 1:
            raise ValueError("Page size must be a positive integer.")
        with self._connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                "SELECT " + _COLUMNS + " FROM quotation_demo.quotations "
                "WHERE (%s::uuid IS NULL OR id > %s::uuid) ORDER BY id LIMIT %s",
                (after, after, limit + 1),
            )
            rows = cursor.fetchall()
        items = tuple(_record(row) for row in rows[:limit])
        next_cursor = items[-1].id if len(rows) > limit else None
        return QuotationPage(items=items, next_cursor=next_cursor)
