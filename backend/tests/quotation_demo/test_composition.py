import json
import subprocess
import sys

import pytest

from app.quotation_demo.quotation_api import create_app
from app.quotation_demo.quotation_settings import QuotationSettings


def test_app_does_not_start_with_implicit_fixture_credentials(monkeypatch):
    monkeypatch.delenv("QUOTATION_FIXTURE_READER_TOKEN", raising=False)
    monkeypatch.delenv("QUOTATION_FIXTURE_OPERATOR_TOKEN", raising=False)
    with pytest.raises(ValueError, match="Configure both"):
        create_app(QuotationSettings(_env_file=None))


def test_standalone_app_import_does_not_initialize_control():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys,json; import app.quotation_demo.quotation_api; "
            "print(json.dumps([m for m in sys.modules "
            "if m == 'app.control.control_api' or m.startswith('app.control')]))",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    assert json.loads(result.stdout) == []
