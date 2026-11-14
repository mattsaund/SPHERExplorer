# Solar system bodies: Horizons parsing, interpolation, and the spacecraft parallax shift.
# Written with Claude Code (Anthropic) assistance.

import asyncio

import numpy as np
import pytest

from spherex_api import net, solarsystem

HORIZONS_ANSWER = """*******
Date_________JDUT, , , R.A._(ICRF), DEC_(ICRF),    APmag,  S-brt,                r,       rdot,             delta,     deldot,
*******
$$SOE
2460796.500000000, , ,   358.33553,  -10.17604,    9.323,  6.892,   2.983915486798, -0.1667148,  3.58248829429480,-13.6277231,
2460796.541666667, , ,   358.34920,  -10.17131,    9.323,  6.892,   2.983911447000, -0.1669038,  3.58207000000000,-13.7000000,
2460796.583333333, , ,   358.36287,  -10.16658,     n.a.,  6.892,   2.983907407000, -0.1670928,  3.58165000000000,-13.8000000,
$$EOE
*******
"""


def test_parse_horizons():
    path = solarsystem.parse_horizons(HORIZONS_ANSWER)
    assert len(path.jd) == 3
    assert abs(path.delta[0] - 3.5824882943) < 1e-9 and abs(path.r[0] - 2.983915486798) < 1e-9
    assert path.mag[0] == 9.323 and np.isnan(path.mag[2])
    assert np.allclose(np.linalg.norm(path.vectors, axis=1), 1.0)
    with pytest.raises(net.UpstreamError):
        solarsystem.parse_horizons("No ephemeris for target")


def test_interpolation_between_rows():
    path = solarsystem.parse_horizons(HORIZONS_ANSWER)
    middle = (path.jd[0] + path.jd[1]) / 2 - 2400000.5
    vectors, delta, _, _ = path.at(np.array([middle]))
    ra = np.degrees(np.arctan2(vectors[0, 1], vectors[0, 0])) % 360
    assert abs(ra - (358.33553 + 358.34920) / 2) < 1e-5
    assert abs(delta[0] - (3.58248829429480 + 3.58207) / 2) < 1e-9
    assert abs(np.linalg.norm(vectors[0]) - 1.0) < 1e-12


def test_topocentric_shift_matches_horizons():
    # Comet 3I/ATLAS at the midpoint of exposure 2025W19_1B_0116_1, checked against Horizons
    # run with SPHEREx as the observer: the two differ by about 0.93 arcseconds.
    spacecraft = (-4698.726864841537, 5178.253968827687, -806.8371159321003)
    ra, dec = solarsystem.topocentric(288.98101, -18.72336, 5.8801, spacecraft)
    shift = np.hypot((ra - 288.98101) * np.cos(np.radians(dec)), dec + 18.72336) * 3600
    assert 0.5 < shift < 1.5
    # A body a million au away does not shift at all.
    far_ra, far_dec = solarsystem.topocentric(10.0, 20.0, 1e6, spacecraft)
    assert abs(far_ra - 10.0) < 1e-7 and abs(far_dec - 20.0) < 1e-7


def test_major_bodies_and_command_check():
    body = asyncio.run(solarsystem.lookup("  Neptune "))
    assert body == {"name": "Neptune", "kind": "Planet", "command": "899"}
    assert asyncio.run(solarsystem.lookup("planet uranus"))["command"] == "799"
    assert solarsystem.COMMAND.match("DES=20000001;") and solarsystem.COMMAND.match("DES=67P; CAP;")
    assert not solarsystem.COMMAND.match("799'; drop") and not solarsystem.COMMAND.match("x")
    with pytest.raises(ValueError):
        asyncio.run(solarsystem.ephemeris("not a body", 61000.0))
