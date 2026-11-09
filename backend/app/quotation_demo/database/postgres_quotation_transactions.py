from collections.abc import Iterator
from contextlib import contextmanager

import psycopg

from app.quotation_demo.business.quotation_repository_interface import (
    QuotationPersistenceError,
    QuotationRepository,
)
from app.quotation_demo.database.postgres_quotation_repository import PostgresQuotationRepository
from app.shared.postgres_connection import DatabaseNotConfigured, PostgresDatabase


class PostgresQuotationTransactions:
    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    @contextmanager
    def open(self) -> Iterator[QuotationRepository]:
        try:
            with self._database.connection() as connection:
                yield PostgresQuotationRepository(connection)
        except (DatabaseNotConfigured, psycopg.Error) as error:
            raise QuotationPersistenceError("Quotation storage operation failed.") from error
