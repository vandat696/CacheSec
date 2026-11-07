import json
from typing import Any
from uuid import UUID, uuid4

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.json import Json

from app.quotation_demo.models import QuotationCreate, QuotationPage, QuotationRecord

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


class PostgresQuotationStore:
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
