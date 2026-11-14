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


def test_every_answer_carries_the_protective_headers():
    """Also on errors. And nothing forbids other sites from embedding the page."""
    from fastapi.testclient import TestClient

    from spherex_api.main import app

    client = TestClient(app)
    for path in ("/api/health", "/api/coverage/no-such-map"):
        headers = client.get(path).headers
        assert headers["x-content-type-options"] == "nosniff"
        assert headers["referrer-policy"] == "strict-origin-when-cross-origin"
        assert "max-age" in headers["strict-transport-security"]
        assert "geolocation=()" in headers["permissions-policy"]
        assert "x-frame-options" not in headers


def test_a_key_outside_the_archive_layout_is_refused():
    from fastapi.testclient import TestClient

    from spherex_api.main import app

    client = TestClient(app)
    for key in ("../../etc/passwd", "qr3/level2/../../secret.fits", "http://example.com/x.fits", "qr3/other/file.fits"):
        assert client.get("/api/fits", params={"key": key, "ra": 10, "dec": 10}).status_code == 400
