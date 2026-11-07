from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_allows_frontend_and_rejects_unknown_origin() -> None:
    allowed = client.get("/health", headers={"Origin": "http://127.0.0.1:3000"})
    assert allowed.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
    denied = client.get("/health", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in denied.headers
