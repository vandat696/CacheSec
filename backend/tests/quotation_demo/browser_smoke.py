"""Opt-in browser integration: pytest tests/quotation_demo/browser_smoke.py -s.

Requires a running frontend configured for http://127.0.0.1:8001 and a free API port 8001.
Uses only the disposable database fixture; never seeds or resets the application database.
"""

import os
import secrets
import socket
import subprocess
from pathlib import Path
from threading import Thread
from time import monotonic, sleep
from urllib.parse import urlsplit

import pytest
import uvicorn
from pydantic import SecretStr

from app.quotation_demo import quotation_api
from app.quotation_demo.business.quotation_models import QuotationCreate
from app.quotation_demo.database.postgres_quotation_repository import PostgresQuotationRepository
from app.quotation_demo.database.quotation_migrations import apply_migrations
from app.quotation_demo.quotation_settings import QuotationSettings


@pytest.mark.baseline_only
def test_quotation_browser_round_trip(quotation_database, monkeypatch):
    frontend = Path(__file__).resolve().parents[3] / "frontend"
    app_url = os.environ.get("CACHESEC_BROWSER_APP_URL", "http://127.0.0.1:3100")
    address = urlsplit(app_url)
    assert address.hostname in {"127.0.0.1", "localhost"}
    origin = f"{address.scheme}://{address.netloc}"
    reader, operator = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    with quotation_database.connection() as connection:
        apply_migrations(connection)
        repository = PostgresQuotationRepository(connection)
        for index in range(53):
            repository.create(
                QuotationCreate(
                    supplier_name=f"Browser seed {index:02}",
                    description="Test-only data",
                    total_amount="1.00",
                    currency="VND",
                )
            )
    monkeypatch.setattr(
        quotation_api, "PostgresDatabase", lambda *args, **kwargs: quotation_database
    )
    app = quotation_api.create_app(
        QuotationSettings(
            _env_file=None,
            database_url=None,
            fixture_reader_token=SecretStr(reader),
            fixture_operator_token=SecretStr(operator),
            cors_origins=[origin],
        )
    )
    server = uvicorn.Server(uvicorn.Config(app, log_level="warning", access_log=False))
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 8001))
        thread = Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
        thread.start()
        try:
            deadline = monotonic() + 10
            while not server.started and thread.is_alive() and monotonic() < deadline:
                sleep(0.05)
            assert server.started, "Temporary API failed to start."
            result = subprocess.run(
                ["node", "scripts/browser-smoke.mjs", "--quotations-only"],
                cwd=frontend.resolve(),
                env={
                    **os.environ,
                    "APP_URL": app_url,
                    "QUOTATION_SMOKE_READER_TOKEN": reader,
                    "QUOTATION_SMOKE_OPERATOR_TOKEN": operator,
                },
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=180,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            assert result.returncode == 0, result.stdout + result.stderr
            print("Quotation browser checks passed (real HTTP/PostgreSQL).")
        finally:
            server.should_exit = True
            thread.join(timeout=15)
            assert not thread.is_alive(), "Temporary API did not stop."
    with quotation_database.connection() as connection:
        assert connection.execute("SELECT count(*) FROM quotation_demo.quotations").fetchone() == (
            59,
        )
        assert connection.execute(
            "SELECT count(*) FROM quotation_demo.creation_requests"
        ).fetchone() == (6,)
