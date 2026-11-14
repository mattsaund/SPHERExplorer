# The exposure index: pointing geometry and search, on a one-exposure index built from real header bytes.
# Written with Claude Code (Anthropic) assistance.

from pathlib import Path

import numpy as np

from spherex_api import exposures, index_build
from spherex_api.fitshdr import parse_header
from spherex_api.pointing import detector_frame, polar, tangent_basis, unit_vector
from spherex_api.wcs import TanSip

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
        weeks=np.array(["dr1/2025W19_1B"]), relative=np.array([np.eye(3)] * 6), scales=np.array([scale] * 6), built=np.array(0.0),
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
        # The index leaves out SIP distortion, which reaches about 7 pixels in the corners.
        assert abs(x[0] - x_true) < 9 and abs(y[0] - y_true) < 9
        assert max(abs(x[0] - x_true), abs(y[0] - y_true)) < exposures.EDGE_MARGIN
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
