from typing import Annotated, Literal

import psycopg
from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.database import Database, DatabaseNotConfigured, DatabaseProbeError

app = FastAPI(title="CacheSec API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["Content-Type"],
)


class HealthResponse(BaseModel):
    status: str


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    database: Literal["ready", "not_configured", "unavailable"]


def get_database() -> Database:
    return Database(
        settings.database_url,
        connect_timeout_seconds=settings.database_connect_timeout_seconds,
        statement_timeout_ms=settings.database_statement_timeout_ms,
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Process liveness only; database/model readiness is not checked."""
    return HealthResponse(status="ok")


@app.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={503: {"model": ReadinessResponse}},
)
def readiness(
    response: Response, database: Annotated[Database, Depends(get_database)]
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
