"""Standalone app: uvicorn app.quotation_demo.main:create_app --factory."""

from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp

from app.quotation_demo.http.application import create_quotation_app
from app.quotation_demo.http.fixture_service_provider import FixtureQuotationServiceProvider
from app.quotation_demo.identity.fixture_registry import FixtureIdentityRegistry
from app.quotation_demo.persistence.postgres_quotation_sessions import PostgresQuotationSessions
from app.quotation_demo.settings import QuotationSettings
from app.shared.postgres import PostgresDatabase


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
    sessions = PostgresQuotationSessions(database)
    provider = FixtureQuotationServiceProvider(
        registry, sessions, max_page_size=settings.max_page_size
    )
    # Wrap the whole app so even sanitized 500 responses have CORS headers.
    app = create_quotation_app(provider, max_body_bytes=settings.max_body_bytes)
    return CORSMiddleware(
        app,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        expose_headers=["X-Request-ID"],
    )
