# Header parsing, sky transforms, and wavelength lookup, checked against Astropy on real header bytes.
# Written with Claude Code (Anthropic) assistance.

import io
import warnings
from pathlib import Path

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS

from spherex_api.calib import WaveGrid
from spherex_api.fitshdr import data_size, padded, parse_header, table_dtype
from spherex_api.wcs import TanSip

DATA = Path(__file__).parent / "data"
HEAD = (DATA / "d6_head.bin").read_bytes()
WAVE = (DATA / "d6_wave.bin").read_bytes()


def image_cards():
    primary = parse_header(HEAD)
    return parse_header(HEAD[primary[2]:])


def test_header_parsing():
    primary = parse_header(HEAD)
    assert primary[0]["SIMPLE"] is True
    assert primary[0]["VERSION"] == "7.0.5"
    assert primary[2] == 2880
    cards, history, length = image_cards()
    assert length == 23040
    assert cards["EXTNAME"] == "IMAGE"
    assert cards["DETECTOR"] == 6
    assert cards["OBSID"] == "2025W19_1B_0116_1"
    assert cards["CTYPE1"] == "RA---TAN-SIP"
    assert abs(cards["MJD-AVG"] - 60800.70069465) < 1e-9
    assert cards["L2 N_PERSIST"] == 209          # HIERARCH key
    assert cards["SPS_FLAGS"] == "all_sky"       # HIERARCH string
    assert any(line.startswith("[CALIB] spectral_wcs") for line in history)
    assert data_size(cards) == 2040 * 2040 * 4
    assert padded(1) == 2880 and padded(2880) == 2880 and padded(2881) == 5760


def test_missing_end_returns_none():
    # The IMAGE header is 23,040 bytes, so its first 2,000 bytes hold no END card.
    assert parse_header(HEAD[2880:4880]) is None


def test_wcs_matches_astropy():
    cards, _, length = image_cards()
    header = fits.Header.fromstring(HEAD[2880:2880 + length].decode("ascii"))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        reference = WCS(header)
    mine = TanSip(cards)
    rng = np.random.default_rng(7)
    x = rng.uniform(0, 2039, 500)
    y = rng.uniform(0, 2039, 500)
    ra_ref, dec_ref = reference.all_pix2world(x, y, 0)
    ra, dec = mine.pix2sky(x, y)
    separation = np.hypot((ra - ra_ref) * np.cos(np.deg2rad(dec_ref)), dec - dec_ref) * 3600
    assert separation.max() < 1e-6            # arcseconds
    back_x, back_y = mine.sky2pix(ra_ref, dec_ref)
    assert np.hypot(back_x - x, back_y - y).max() < 1e-5   # pixels


def test_local_matrix_scale_and_handedness():
    cards, _, _ = image_cards()
    wcs = TanSip(cards)
    ra, dec = (float(v) for v in wcs.pix2sky(1000.0, 1000.0))
    (a, b), (c, d) = wcs.local_matrix(1000.0, 1000.0, ra, dec)
    area = abs(a * d - b * c)
    assert 36.5 < area < 39.5                  # square arcseconds per pixel, near 6.15 squared
    # One pixel step in x moves the sky position by what the matrix predicts.
    east, north = wcs.offsets(np.array([1001.0]), np.array([1000.0]), ra, dec)
    assert abs(float(east[0]) - a) < 0.01 and abs(float(north[0]) - c) < 0.01


def test_wave_grid_matches_table_and_astropy():
    cards, _, length = parse_header(WAVE)
    rows = np.frombuffer(WAVE, dtype=table_dtype(cards), count=1, offset=length)
    grid = WaveGrid(rows["X"][0], rows["Y"][0], rows["VALUES"][0])
    # Control points come back exactly.
    wl, bw = grid.at(0, 0)
    assert abs(float(wl) - 5.024615) < 1e-5 and abs(float(bw) - 0.03840528) < 1e-6
    wl, _ = grid.at(2039, 2039)
    assert abs(float(wl) - 4.420077) < 1e-5
    # Wavelength falls with y on detector 6 and stays inside the detector's range.
    wl, _ = grid.at(np.full(50, 1000.0), np.linspace(0, 2039, 50))
    assert np.all(np.diff(wl) < 0) and wl.max() < 5.05 and wl.min() > 4.40
    gx, gy = grid.gradient(1000.0, 1000.0)
    assert gy < 0 and abs(gx) < abs(gy)
    # The same table read by Astropy gives the same numbers.
    table = fits.BinTableHDU.readfrom(io.BytesIO(WAVE))
    assert np.allclose(table.data["VALUES"][0], rows["VALUES"][0])
