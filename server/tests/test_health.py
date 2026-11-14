# Smoke test for the API app.
# Written with Claude Code (Anthropic) assistance.

from fastapi.testclient import TestClient

from spherex_api.main import app


def test_health():
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_oversized_batch_is_refused():
    frames = [{"key": f"dr1/level2/2025W19_1B/l2b-v27-2026-197/6/level2_x{i}D6_spx_l2b-v27-2026-197.fits"} for i in range(3000)]
    response = TestClient(app).post("/api/cutouts", json={"ra": 10, "dec": 10, "size": 3600, "frames": frames})
    assert response.status_code == 413


def test_bad_file_key_is_refused():
    response = TestClient(app).post("/api/cutouts", json={"ra": 10, "dec": 10, "size": 300, "frames": [{"key": "../secrets.fits"}]})
    assert response.status_code == 400
    assert TestClient(app).get("/api/cutout", params={"key": "https://example.com/x.fits", "ra": 1, "dec": 1}).status_code == 400
