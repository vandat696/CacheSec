"""Control API operational endpoints and their response contracts."""

from typing import Annotated, Literal

import psycopg
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from app.control.settings import settings
from app.shared.postgres import DatabaseNotConfigured, DatabaseProbeError, PostgresDatabase

router = APIRouter()


class HealthResponse(BaseModel):
    status: str


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    database: Literal["ready", "not_configured", "unavailable"]


def get_database() -> PostgresDatabase:
    return PostgresDatabase(
        settings.database_url,
        connect_timeout_seconds=settings.database_connect_timeout_seconds,
        statement_timeout_ms=settings.database_statement_timeout_ms,
    )


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Process liveness only; database/model readiness is not checked."""
    return HealthResponse(status="ok")


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={503: {"model": ReadinessResponse}},
)
def readiness(
    response: Response, database: Annotated[PostgresDatabase, Depends(get_database)]
) -> ReadinessResponse:
    """PostgreSQL connectivity only; not schema, authority, model or workflow readiness."""
    try:
        database.probe()
    except DatabaseNotConfigured:
        response.status_code = 503
        return ReadinessResponse(status="not_ready", database="not_configured")
    except (psycopg.Error, DatabaseProbeError):
        response.status_code = 503
        return ReadinessResponse(status="not_ready", database="unavailable")
    return ReadinessResponse(status="ready", database="ready")
