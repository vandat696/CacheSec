from pathlib import Path

import pytest
from pydantic import SecretStr, ValidationError

from app.artifacts.blob_models import BlobStorageNotConfigured
from app.control.control_settings import Settings
from app.control.control_storage import create_artifact_blob_storage


@pytest.mark.parametrize(
    "database,root", [(None, None), (SecretStr("postgresql://test-only"), None)]
)
def test_control_storage_requires_explicit_database_and_root(database, root):
    with pytest.raises(BlobStorageNotConfigured):
        create_artifact_blob_storage(
            Settings(_env_file=None, database_url=database, control_artifact_root=root)
        )


def test_control_storage_has_no_quotation_configuration_fallback(monkeypatch, tmp_path):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("CONTROL_ARTIFACT_ROOT", raising=False)
    monkeypatch.setenv("QUOTATION_DATABASE_URL", "postgresql://quotation-test-only")
    with pytest.raises(BlobStorageNotConfigured):
        create_artifact_blob_storage(Settings(_env_file=None, control_artifact_root=tmp_path))


def test_invalid_storage_limits_and_relative_root_fail_before_writing(tmp_path):
    for limit in (0, 1048577):
        with pytest.raises(ValidationError):
            Settings(_env_file=None, control_artifact_max_blob_bytes=limit)
    with pytest.raises(ValueError):
        create_artifact_blob_storage(
            Settings(
                _env_file=None,
                database_url=SecretStr("postgresql://test-only"),
                control_artifact_root=Path("relative"),
            )
        )
