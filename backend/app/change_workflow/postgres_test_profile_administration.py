"""Explicit trusted registration, separate from application/worker startup."""

import psycopg

from app.artifacts.blob_models import BlobReference, content_digest
from app.artifacts.blob_storage_service import BlobBytesStore
from app.artifacts.metadata_encoding import encode_metadata
from app.artifacts.postgres_blob_metadata import PostgresBlobMetadataRepository
from app.change_workflow.test_profiles import TechnicalTestProfile
from app.identity.control_authority import (
    AuthorityConflict,
    ControlResourceUnavailable,
    RepositoryScope,
)
from app.identity.postgres_control_authority import PostgresControlAuthorityRepository
from app.repositories.snapshot_models import SnapshotIntegrityError


class PostgresTestProfileAdministration:
    def __init__(self, connection: psycopg.Connection, store: BlobBytesStore):
        self.connection, self.store = connection, store

    def set_profile(
        self, scope: RepositoryScope, profile: TechnicalTestProfile, *, expected_epoch: int
    ):
        authority = PostgresControlAuthorityRepository(self.connection)
        repository = authority.lock_scope(scope)
        if repository is None:
            raise ControlResourceUnavailable()
        if type(expected_epoch) is not int or repository.authority_epoch != expected_epoch:
            raise AuthorityConflict("Reload current authority before registering a test profile.")
        raw = encode_metadata(profile.metadata())
        reference = BlobReference(content_digest(raw), len(raw))
        if self.store.put(raw) != reference or self.store.get(reference.digest) != raw:
            raise SnapshotIntegrityError("Profile publication does not preserve bytes.")
        PostgresBlobMetadataRepository(self.connection).register(reference)
        current = self.connection.execute(
            "SELECT profile_digest FROM control.technical_test_profiles "
            "WHERE tenant_id=%s AND repo_id=%s",
            (scope.tenant_id, scope.repo_id),
        ).fetchone()
        if current == (profile.digest,):
            return expected_epoch
        self.connection.execute(
            "INSERT INTO control.technical_test_profiles VALUES (%s,%s,%s,%s) "
            "ON CONFLICT (tenant_id,repo_id) DO UPDATE SET "
            "profile_digest=EXCLUDED.profile_digest,profile_size=EXCLUDED.profile_size",
            (scope.tenant_id, scope.repo_id, reference.digest, reference.byte_size),
        )
        return self.connection.execute(
            "UPDATE control.scope_authorities SET epoch=epoch+1 "
            "WHERE tenant_id=%s AND repo_id=%s RETURNING epoch",
            (scope.tenant_id, scope.repo_id),
        ).fetchone()[0]
