"""Explicit backend composition; nothing is provisioned or captured at API startup."""

from app.artifacts.blob_models import BlobStorageNotConfigured
from app.artifacts.filesystem_blob_store import FileSystemBlobStore
from app.control.control_settings import Settings
from app.repositories.filesystem_repository_source import (
    FileSystemRepositorySource,
    RepositorySourceBinding,
)
from app.repositories.postgres_repository_snapshots import PostgresSnapshotTransactions
from app.repositories.repository_snapshots import RepositorySnapshotService
from app.shared.postgres_connection import PostgresDatabase


def create_repository_snapshot_service(
    settings: Settings, bindings: tuple[RepositorySourceBinding, ...]
) -> RepositorySnapshotService:
    if settings.database_url is None or settings.control_artifact_root is None:
        raise BlobStorageNotConfigured("Configure control database and artifact root explicitly.")
    store = FileSystemBlobStore(
        settings.control_artifact_root, max_blob_bytes=settings.control_artifact_max_blob_bytes
    )
    for binding in bindings:
        if binding.root.is_relative_to(settings.control_artifact_root) or any(
            (binding.root / relative).is_relative_to(settings.control_artifact_root)
            for relative in binding.profile.paths
        ):
            raise ValueError("Source profile must exclude the control blob store.")
    source = FileSystemRepositorySource(bindings)
    database = PostgresDatabase(
        settings.database_url,
        connect_timeout_seconds=settings.database_connect_timeout_seconds,
        statement_timeout_ms=settings.database_statement_timeout_ms,
    )
    return RepositorySnapshotService(PostgresSnapshotTransactions(database), source, store)
