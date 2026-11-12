"""ASGI composition root: uvicorn app.control.control_api:app."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent_assistance.assistance_http import configure_assistance_http
from app.agent_assistance.assistance_service import AgentAssistanceService
from app.agent_assistance.openai_generation import OpenAIResponsesGeneration
from app.artifacts.filesystem_blob_store import FileSystemBlobStore
from app.change_workflow.postgres_workflow_transactions import PostgresWorkflowTransactions
from app.change_workflow.proposal_service import ProposalService
from app.change_workflow.test_job_service import TestJobService
from app.change_workflow.test_profiles import load_test_profile
from app.change_workflow.workflow_http import configure_workflow_http
from app.control.api.repository_http_app import configure_repository_http
from app.control.control_settings import Settings, settings
from app.control.control_snapshots import create_repository_snapshot_service
from app.control.health_routes import get_database
from app.control.health_routes import router as health_router
from app.control.repository_configuration import load_repository_binding
from app.identity.control_authority import RepositoryAccessService
from app.identity.postgres_control_authority import PostgresControlAuthorityTransactions
from app.shared.postgres_connection import PostgresDatabase


def create_app(configuration: Settings = settings) -> FastAPI:
    database = PostgresDatabase(
        configuration.database_url,
        connect_timeout_seconds=configuration.database_connect_timeout_seconds,
        statement_timeout_ms=configuration.database_statement_timeout_ms,
    )
    snapshots = None
    binding = None
    if configuration.control_repository_config is not None:
        binding = load_repository_binding(configuration.control_repository_config)
        snapshots = create_repository_snapshot_service(configuration, (binding,))
    app = FastAPI(title="CacheSec API", version="0.2.0")
    app.dependency_overrides[get_database] = lambda: database
    app.include_router(health_router)
    configure_repository_http(
        app,
        RepositoryAccessService(PostgresControlAuthorityTransactions(database)),
        snapshots,
    )
    proposals = None
    jobs = None
    if configuration.control_test_profile_config is not None:
        if snapshots is None or binding is None or configuration.control_artifact_root is None:
            raise ValueError("Configure source storage before test workflow.")
        profile = load_test_profile(configuration.control_test_profile_config)
        proposals = ProposalService(
            PostgresWorkflowTransactions(database),
            snapshots,
            FileSystemBlobStore(configuration.control_artifact_root),
            profile,
        )
        jobs = TestJobService(proposals, binding.profile.scope)
    configure_workflow_http(app, proposals, jobs, configuration.control_test_worker_token)
    configure_assistance_http(
        app,
        AgentAssistanceService(
            RepositoryAccessService(PostgresControlAuthorityTransactions(database)),
            snapshots,
            OpenAIResponsesGeneration(configuration.control_agent_config),
        ),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=configuration.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        expose_headers=["X-Request-ID"],
    )
    return app


app = create_app()
