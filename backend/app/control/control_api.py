"""ASGI composition root: uvicorn app.control.control_api:app."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent_assistance.assistance_http import configure_assistance_http
from app.agent_assistance.assistance_prompt import ASSISTANCE_PROMPT_VERSION
from app.agent_assistance.assistance_service import AgentAssistanceService
from app.agent_assistance.cached_assistance import CachedAgentAssistance
from app.agent_assistance.gemini_generation import ALTERNATIVE_MODELS, GeminiContentGeneration
from app.agent_assistance.openai_generation import OpenAIResponsesGeneration
from app.agent_assistance.run_http import configure_run_http
from app.agent_assistance.run_service import AgentRunService
from app.agent_assistance.run_store import LocalAgentRunStore
from app.agent_assistance.workflow_run_tools import WorkflowRunAccess, WorkflowRunTools
from app.artifacts.filesystem_blob_store import FileSystemBlobStore
from app.change_workflow.postgres_workflow_transactions import PostgresWorkflowTransactions
from app.change_workflow.proposal_service import ProposalService
from app.change_workflow.test_job_service import TestJobService
from app.change_workflow.test_profiles import load_test_profile
from app.change_workflow.workflow_http import configure_workflow_http
from app.comparisons.comparison_http import configure_comparison_http
from app.comparisons.comparison_service import ComparisonService
from app.comparisons.postgres_comparisons import PostgresComparisonTransactions
from app.context_cache.context_http import configure_context_http
from app.context_cache.context_service import ContextService
from app.context_cache.gemini_embedding import GeminiQueryEmbedding
from app.context_cache.postgres_contexts import PostgresContextTransactions
from app.control.api.repository_http_app import configure_repository_http
from app.control.control_settings import Settings, settings
from app.control.control_snapshots import create_repository_snapshot_service
from app.control.health_routes import get_database
from app.control.health_routes import router as health_router
from app.control.repository_configuration import load_repository_binding
from app.identity.control_authority import RepositoryAccessService
from app.identity.postgres_control_authority import PostgresControlAuthorityTransactions
from app.shared.postgres_connection import PostgresDatabase
from app.workspace_runtime.runtime_service import LocalRuntimeService
from app.workspace_runtime.source_operations import SourceOperationsService
from app.workspace_runtime.worker_service import WorkspaceWorkerService
from app.workspace_runtime.workspace_http import configure_workspace_http


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
    runs = None
    comparisons = None
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cachesec-agent")
    comparison_executor = ThreadPoolExecutor(
        max_workers=2, thread_name_prefix="cachesec-comparison"
    )

    @asynccontextmanager
    async def lifespan(app):
        yield
        if runs is not None:
            runs.shutdown()
        if comparisons is not None:
            comparisons.shutdown()
        executor.shutdown(wait=False, cancel_futures=True)
        comparison_executor.shutdown(wait=False, cancel_futures=True)

    app = FastAPI(title="CacheSec API", version="0.2.0", lifespan=lifespan)
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
    operations = SourceOperationsService(proposals, binding.profile.scope) if proposals else None
    runtime = LocalRuntimeService(operations) if operations else None
    workspace_worker = WorkspaceWorkerService(operations, runtime) if operations else None
    configure_workspace_http(
        app, operations, runtime, workspace_worker, configuration.control_test_worker_token
    )
    gemini = configuration.control_agent_provider == "gemini"
    assistance = AgentAssistanceService(
        RepositoryAccessService(PostgresControlAuthorityTransactions(database)),
        snapshots,
        GeminiContentGeneration(configuration.control_agent_config)
        if gemini
        else OpenAIResponsesGeneration(configuration.control_agent_config),
        tuple(
            GeminiContentGeneration(configuration.control_agent_config, model)
            for model in ALTERNATIVE_MODELS
        )
        if gemini
        else (),
    )
    if proposals is not None:
        runs = AgentRunService(
            WorkflowRunAccess(proposals),
            assistance,
            WorkflowRunTools(proposals),
            LocalAgentRunStore(),
            executor,
        )
        configure_run_http(app, runs)
    configure_assistance_http(app, assistance, runs)
    contexts = (
        ContextService(
            PostgresContextTransactions(database),
            snapshots,
            GeminiQueryEmbedding(configuration.control_agent_config),
            assistance.models.default.model_id,
            prompt_version=ASSISTANCE_PROMPT_VERSION,
        )
        if snapshots is not None
        else None
    )
    cached = CachedAgentAssistance(contexts, assistance.models)
    configure_context_http(app, contexts, cached)
    if contexts is not None and proposals is not None:
        comparisons = ComparisonService(
            PostgresComparisonTransactions(database),
            contexts,
            assistance,
            cached,
            proposals,
            comparison_executor,
        )
    configure_comparison_http(app, comparisons)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=configuration.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        expose_headers=["X-Request-ID"],
    )
    return app


app = create_app()
