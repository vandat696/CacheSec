import getpass
import io
import json
import sys
from uuid import uuid4

import pytest

from app.control.configure_repository import read_control_token
from app.control.repository_configuration import (
    RepositoryConfigurationError,
    load_repository_binding,
)


def test_configuration_is_explicit_exact_and_does_not_read_source(tmp_path):
    config = tmp_path / "repository.json"
    data = {
        "tenant_id": str(uuid4()),
        "repo_id": str(uuid4()),
        "repository_identity": "test-repository",
        "root": str(tmp_path / "missing-root"),
        "paths": ["app.py"],
    }
    config.write_text(json.dumps(data), encoding="utf-8")
    binding = load_repository_binding(config)
    assert binding.profile.paths == ("app.py",)
    assert not binding.root.exists()
    for changes in (
        {"root": "relative"},
        {"paths": [".env"]},
        {"paths": ["../app.py"]},
        {"role": "reviewer"},
        {"max_files": True},
        {"max_file_bytes": "100"},
        {"paths": ["App.py", "app.py"]},
    ):
        config.write_text(json.dumps({**data, **changes}), encoding="utf-8")
        with pytest.raises(RepositoryConfigurationError):
            load_repository_binding(config)
    config.write_bytes(b"x" * 65537)
    with pytest.raises(RepositoryConfigurationError):
        load_repository_binding(config)


def test_cli_refuses_getpass_fallback_before_reading_or_echoing_a_secret(monkeypatch):
    secret = io.StringIO("test-only-secret-must-not-echo\n")
    monkeypatch.setattr(sys, "stdin", secret)
    monkeypatch.setattr(getpass, "getpass", getpass.fallback_getpass)
    with pytest.raises(getpass.GetPassWarning):
        read_control_token()
    assert secret.tell() == 0
