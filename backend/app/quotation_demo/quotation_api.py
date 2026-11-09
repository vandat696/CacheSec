"""Standalone app: uvicorn app.quotation_demo.quotation_api:create_app --factory."""

from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp

from app.quotation_demo.api.quotation_http_app import create_quotation_http_app
from app.quotation_demo.api.quotation_service_factory import FixtureQuotationServiceFactory
from app.quotation_demo.auth.fixture_identity import FixtureIdentityRegistry
from app.quotation_demo.database.postgres_quotation_transactions import (
    PostgresQuotationTransactions,
)
from app.quotation_demo.quotation_settings import QuotationSettings
from app.shared.postgres_connection import PostgresDatabase


def create_app(settings: QuotationSettings | None = None) -> ASGIApp:
    settings = settings if settings is not None else QuotationSettings()
    if settings.fixture_reader_token is None or settings.fixture_operator_token is None:
        raise ValueError("Configure both quotation fixture tokens before starting the API.")
    registry = FixtureIdentityRegistry(
        settings.fixture_reader_token, settings.fixture_operator_token
    )
    database = PostgresDatabase(
        settings.database_url,
        connect_timeout_seconds=settings.database_connect_timeout_seconds,
        statement_timeout_ms=settings.database_statement_timeout_ms,
    )
    transactions = PostgresQuotationTransactions(database)
    factory = FixtureQuotationServiceFactory(
        registry, transactions, max_page_size=settings.max_page_size
    )
    # Wrap the whole app so even sanitized 500 responses have CORS headers.
    app = create_quotation_http_app(factory, max_body_bytes=settings.max_body_bytes)
    return CORSMiddleware(
        app,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        expose_headers=["X-Request-ID"],
    )
