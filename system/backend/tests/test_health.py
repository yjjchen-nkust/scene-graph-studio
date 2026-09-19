from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import ROOT


def test_health_reports_the_machine_honestly():
    client = TestClient(create_app())
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert isinstance(body["torch_present"], bool)
    assert isinstance(body["cuda_available"], bool)
    assert body["device"] in ("cpu", "cuda")
    assert isinstance(body["live_models"], list)
    assert body["vlm_provider"] in ("transcript", "claude")
    assert isinstance(body["slices_present"], dict)


def test_importing_the_app_does_not_import_torch():
    """NFR-1 and NFR-8: torch costs seconds to import and must not load at app import.

    The plan's original form of this test asserted that /api/health never imports torch at
    all. That contradicts contracts 1.2, which requires the response to carry torch_version
    and cuda_available -- neither is knowable without importing torch once. What is actually
    required is that importing the application does not pay that cost, so that is what is
    asserted here. See the deviation note in DEVIATIONS.md.
    """
    probe = "import sys; import app.main; print('torch' in sys.modules)"
    out = subprocess.run(
        [sys.executable, "-c", probe],
        cwd=str(Path(ROOT) / "backend"),
        capture_output=True,
        text=True,
        check=True,
    )
    assert out.stdout.strip() == "False", "importing app.main pulled torch in eagerly"


def test_health_answers_quickly_once_warm():
    client = TestClient(create_app())
    client.get("/api/health")
    start = time.perf_counter()
    client.get("/api/health")
    assert (time.perf_counter() - start) < 0.05, "health must answer in under 50 ms when warm"


def test_torch_state_is_probed_once_not_per_request():
    from app.api.health import _torch_state

    assert _torch_state.cache_info().maxsize is not None


def test_unknown_route_returns_the_bilingual_error_shape():
    client = TestClient(create_app())
    r = client.get("/api/nope")
    assert r.status_code == 404
    err = r.json()["error"]
    assert err["code"] == "not_found"
    assert err["message_en"] and err["message_zh"]
