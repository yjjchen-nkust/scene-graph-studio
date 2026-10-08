from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app

PAGES = "https://yjjchen-nkust.github.io"


def test_no_cors_headers_unless_an_origin_is_configured(monkeypatch):
    monkeypatch.delenv("SGS_CORS_ORIGINS", raising=False)
    r = TestClient(create_app()).get("/api/health", headers={"Origin": PAGES})
    assert "access-control-allow-origin" not in r.headers


def test_a_configured_origin_is_answered_and_another_is_not(monkeypatch):
    monkeypatch.setenv("SGS_CORS_ORIGINS", f"{PAGES}, https://example.org")
    client = TestClient(create_app())
    ok = client.get("/api/health", headers={"Origin": PAGES})
    assert ok.headers["access-control-allow-origin"] == PAGES
    other = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in other.headers


def test_preflight_for_a_json_post_is_accepted(monkeypatch):
    monkeypatch.setenv("SGS_CORS_ORIGINS", PAGES)
    r = TestClient(create_app()).options(
        "/api/vlm/indvissgg",
        headers={
            "Origin": PAGES,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == PAGES
