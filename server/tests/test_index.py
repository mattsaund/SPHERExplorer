# The exposure index: pointing geometry and search, on a one-exposure index built from real header bytes.
# Written with Claude Code (Anthropic) assistance.

from pathlib import Path

import numpy as np

from spherex_api import exposures, index_build
from spherex_api.images.fitshdr import parse_header
from spherex_api.images.pointing import detector_frame, polar, sip_inverse, tangent_basis, unit_vector
from spherex_api.images.wcs import TanSip

HEAD = (Path(__file__).parent / "data" / "d6_head.bin").read_bytes()


def image_cards():
    return parse_header(HEAD[parse_header(HEAD)[2]:])[0]


def one_exposure_index(tmp_path):
    """An index holding the fixture exposure, with detector 6 at detector 1's place for simplicity."""
    cards = image_cards()
    frame, scale = detector_frame(cards)
    rows = np.zeros(1, dtype=index_build.ROW)
    rows["obsid"] = b"2025W19_1B_0116_1"
    rows["vdir"] = index_build.MISSING
    rows["vdir"][0][5] = 0
    rows["mjd"] = cards["MJD-AVG"]
    rows["frame"] = frame
    path = tmp_path / "exposures.npz"
    np.savez_compressed(
        path, rows=rows, releases=np.array(["dr1"]), versions=np.array(["l2b-v27-2026-197"]),
        weeks=np.array(["dr1/2025W19_1B"]), relative=np.array([np.eye(3)] * 6), scales=np.array([scale] * 6),
        sip=np.array([sip_inverse(cards)] * 6), built=np.array(0.0),
    )
    return exposures.ExposureIndex(path)


def test_polar_and_basis():
    rotation, scale = polar(np.array([[0.0, -2.0], [3.0, 0.0]]))
    assert np.allclose(rotation @ rotation.T, np.eye(2))
    assert np.allclose(scale, scale.T) and np.allclose(rotation @ scale, [[0.0, -2.0], [3.0, 0.0]])
    basis = tangent_basis(40.0, -30.0)
    assert np.allclose(basis.T @ basis, np.eye(3), atol=1e-12)
    assert np.allclose(basis[:, 2], unit_vector(40.0, -30.0))


def test_find_predicts_the_pixel(tmp_path):
    index = one_exposure_index(tmp_path)
    wcs = TanSip(image_cards())
    for x_true, y_true in [(1020.0, 1020.0), (500.0, 700.0), (1900.0, 150.0), (60.0, 1990.0)]:
        ra, dec = (float(v) for v in wcs.pix2sky(x_true, y_true))
        rows, detectors, x, y = index.find(ra, dec)
        assert rows.tolist() == [0] and detectors.tolist() == [6]
        # With the distortion terms the prediction is good to a small fraction of a pixel.
        assert abs(x[0] - x_true) < 0.2 and abs(y[0] - y_true) < 0.2
    assert index.key(0, 6) == "dr1/level2/2025W19_1B/l2b-v27-2026-197/6/level2_2025W19_1B_0116_1D6_spx_l2b-v27-2026-197.fits"


def test_find_misses_positions_off_the_detector(tmp_path):
    index = one_exposure_index(tmp_path)
    wcs = TanSip(image_cards())
    ra, dec = (float(v) for v in wcs.pix2sky(1020.0, 1020.0))
    assert index.find(ra, dec + 3.0)[0].size == 0           # 3 degrees away, past the edge
    assert index.find((ra + 180.0) % 360.0, -dec)[0].size == 0  # the opposite side of the sky


def test_release_rank_and_keys():
    ranks = sorted(["qr3", "dr1", "qr4", "dr2"], key=index_build.release_rank)
    assert ranks == ["qr3", "qr4", "dr1", "dr2"]
    match = index_build.FILE.search("dr1/level2/2025W19_1B/l2b-v27-2026-197/6/level2_2025W19_1B_0116_1D6_spx_l2b-v27-2026-197.fits")
    assert match["obsid"] == "2025W19_1B_0116_1" and match["det"] == "6" and match["ver"] == "l2b-v27-2026-197"


def test_a_new_instance_starts_from_the_index_shipped_with_it(tmp_path, monkeypatch):
    """With a seed file, no download is needed, and the seed's age is kept."""
    import os

    from spherex_api import config, exposures

    seed = tmp_path / "seed.npz"
    seed.write_bytes(b"index bytes")
    os.utime(seed, (1_000_000, 1_000_000))
    target = tmp_path / "cache" / "index" / "exposures.npz"
    monkeypatch.setattr(config, "INDEX_SEED", str(seed))
    monkeypatch.setattr(exposures, "INDEX_PATH", target)
    assert exposures._seed() is True
    assert target.read_bytes() == b"index bytes"
    assert target.stat().st_mtime == 1_000_000
    monkeypatch.setattr(config, "INDEX_SEED", str(tmp_path / "missing.npz"))
    target.unlink()
    assert exposures._seed() is False and not target.exists()


def test_a_refresh_stops_before_it_shrinks_the_index():
    """Adding exposures and swapping a release are fine. Losing a release with nothing in its place is not."""
    import pytest

    index_build.size_check(273_367, 273_367, 0)             # nothing new
    index_build.size_check(273_367, 273_367, 1_500)          # new exposures
    index_build.size_check(273_367, 150_000, 130_000)        # one release swapped for a better one
    index_build.size_check(273_367, 270_000, 0)              # a few gone, under the limit
    index_build.size_check(0, 0, 273_367)                    # the first build
    with pytest.raises(SystemExit, match="nothing was saved"):
        index_build.size_check(273_367, 120_000, 0)          # IRSA's list lost a release
    index_build.size_check(273_367, 120_000, 0, allow_shrink=True)


def test_a_damaged_index_file_leaves_the_loaded_index_in_place(tmp_path, monkeypatch):
    """A file that is empty or cut short must not take search down. The index in memory stays."""
    import asyncio
    import zipfile

    from spherex_api import exposures

    target = tmp_path / "exposures.npz"
    target.write_bytes(b"cut short")
    held = object()
    monkeypatch.setattr(exposures, "INDEX_PATH", target)
    monkeypatch.setattr(exposures, "_index", held)
    for error in (zipfile.BadZipFile("File is not a zip file"), EOFError("No data left in file")):
        monkeypatch.setattr(exposures, "_checked", 0.0)

        def broken(error=error):
            raise error

        monkeypatch.setattr(exposures, "ExposureIndex", broken)
        assert asyncio.run(exposures.get_index()) is held
