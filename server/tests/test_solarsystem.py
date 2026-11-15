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
    assert body == {"name": "Neptune", "kind": "Planet", "command": "899", "url": "https://science.nasa.gov/neptune/"}
    assert asyncio.run(solarsystem.lookup("planet uranus"))["command"] == "799"
    # The sky map labels them "The Sun" and "The Moon", so both ways of typing them are known.
    assert asyncio.run(solarsystem.lookup("the Moon")) == asyncio.run(solarsystem.lookup("moon"))
    assert asyncio.run(solarsystem.lookup("The Sun")) == {"name": "The Sun", "kind": "Star", "command": "10", "url": "https://science.nasa.gov/sun/"}
    assert solarsystem.COMMAND.match("10") and not solarsystem.COMMAND.match("1")
    assert solarsystem.COMMAND.match("DES=20000001;") and solarsystem.COMMAND.match("DES=67P; CAP;")
    assert not solarsystem.COMMAND.match("799'; drop") and not solarsystem.COMMAND.match("x")
    with pytest.raises(ValueError):
        asyncio.run(solarsystem.ephemeris("not a body", 61000.0))


# ---- Names that an asteroid and a comet share ------------------------------------------------

class FakeJpl:
    """Answers the small-body database the way JPL does for a handful of names."""

    HALLEY = [{"pdes": "2688", "name": "2688 Halley (1982 HG1)"}, {"pdes": "1P", "name": "1P/Halley"}]
    OBJECTS = {
        "1P": {"fullname": "1P/Halley", "kind": "cn", "des": "1P", "spkid": "1000036", "orbit_class": {"name": "Halley-type Comet*"}},
        "2688": {"fullname": "2688 Halley (1982 HG1)", "kind": "an", "des": "2688", "spkid": "20002688", "orbit_class": {"name": "Main-belt Asteroid"}},
        "3I": {"fullname": "C/2025 N1 (ATLAS)", "kind": "cu", "des": "2025 N1", "spkid": "1004083", "orbit_class": {"name": "Hyperbolic Comet"}},
        "C/2025 N1": {"fullname": "C/2025 N1 (ATLAS)", "kind": "cu", "des": "2025 N1", "spkid": "1004083", "orbit_class": {"name": "Hyperbolic Comet"}},
        "Ceres": {"fullname": "1 Ceres (A801 AA)", "kind": "an", "des": "1", "spkid": "20000001", "orbit_class": {"name": "Main-belt Asteroid"}},
    }
    LISTS = {"Halley": HALLEY, "1P/Halley": HALLEY, "Churyumov": [
        {"pdes": "2627", "name": "2627 Churyumov (1978 PP3)"}, {"pdes": "67P", "name": "67P/Churyumov-Gerasimenko"}, {"pdes": "1986 N1", "name": "C/1986 N1 (Churyumov-Solodovnikov)"},
    ]}

    def __init__(self):
        self.asked: list[str] = []
        self.down = False

    async def get(self, url, params, timeout):
        if self.down:
            raise OSError("no route to host")
        text = params["sstr"]
        self.asked.append(text)
        if text in self.OBJECTS:
            data = {"object": self.OBJECTS[text]}
        elif text in self.LISTS:
            data = {"list": self.LISTS[text]}
        else:
            data = {"code": "200", "message": "specified object was not found"}

        class Answer:
            def json(self):
                return data

        return Answer()


@pytest.fixture
def jpl(monkeypatch):
    fake = FakeJpl()
    monkeypatch.setattr(net, "client", lambda: fake)
    # No memory of earlier answers, in the process or on disk.
    monkeypatch.setattr(solarsystem, "_lookups", {})
    monkeypatch.setattr(solarsystem.cache, "load_json", lambda kind, name: None)
    monkeypatch.setattr(solarsystem.cache, "save_json", lambda kind, name, value: None)
    return fake


def look(name):
    return asyncio.run(solarsystem.lookup(name))


def test_a_comet_name_finds_the_comet_not_the_asteroid_named_after_it(jpl):
    # JPL lists the asteroid 2688 Halley first. One comet among the matches is the body people mean.
    assert look("Halley")["name"] == "1P/Halley"
    assert look("Halley")["command"] == "DES=1P; CAP;"
    assert look("Halley's Comet")["name"] == "1P/Halley"
    assert look("comet Halley")["name"] == "1P/Halley"
    # Asking for the asteroid by word still gets the asteroid.
    assert look("asteroid Halley")["name"] == "2688 Halley (1982 HG1)"
    assert look("asteroid Halley")["command"] == "DES=20002688;"


def test_a_designation_is_looked_up_by_itself(jpl):
    # Given the whole "1P/Halley", JPL offers the asteroid too. The designation alone is one body.
    assert look("1P/Halley")["name"] == "1P/Halley"
    assert jpl.asked == ["1P"]
    assert look("3I/ATLAS")["name"] == "C/2025 N1 (ATLAS)"
    assert look("C/2025 N1 (ATLAS)")["url"].endswith("sstr=2025%20N1")
    assert jpl.asked == ["1P", "3I", "C/2025 N1"]


def test_two_comets_of_one_name_leave_the_first_match(jpl):
    # Nothing says which comet is meant, so JPL's own first choice stands.
    assert solarsystem.choose(FakeJpl.LISTS["Churyumov"], None)["pdes"] == "2627"
    assert solarsystem.choose(FakeJpl.LISTS["Churyumov"], "comet")["pdes"] == "67P"


def test_plain_names_and_unknown_names_work_as_before(jpl):
    assert look("Ceres")["command"] == "DES=20000001;"
    assert look("asteroid Ceres")["name"] == "1 Ceres (A801 AA)"
    assert look("Nosuchbody") is None
    assert look("Jupiter")["command"] == "599"   # the planets never reach JPL's small-body list
    assert "Jupiter" not in jpl.asked


def test_an_outage_is_not_reported_as_an_unknown_name(jpl):
    jpl.down = True
    with pytest.raises(net.UpstreamError):
        look("Halley")
    # And the failure is not remembered: the next try asks again.
    jpl.down = False
    assert look("Halley")["name"] == "1P/Halley"
