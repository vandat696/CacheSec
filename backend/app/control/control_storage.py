"""Compose internal object storage; this does not expose a read API or grant artifact use."""

from app.artifacts.blob_models import BlobStorageNotConfigured
from app.artifacts.blob_storage_service import ArtifactBlobStorage
from app.artifacts.filesystem_blob_store import FileSystemBlobStore
from app.artifacts.postgres_blob_metadata import PostgresBlobMetadataTransactions
from app.control.control_settings import Settings
from app.shared.postgres_connection import PostgresDatabase


def create_artifact_blob_storage(settings: Settings) -> ArtifactBlobStorage:
    if settings.database_url is None or settings.control_artifact_root is None:
        raise BlobStorageNotConfigured("Configure control database and artifact root explicitly.")
    database = PostgresDatabase(
        settings.database_url,
        connect_timeout_seconds=settings.database_connect_timeout_seconds,
        statement_timeout_ms=settings.database_statement_timeout_ms,
    )
    return ArtifactBlobStorage(
        FileSystemBlobStore(
            settings.control_artifact_root,
            max_blob_bytes=settings.control_artifact_max_blob_bytes,
        ),
        PostgresBlobMetadataTransactions(database),
    )
