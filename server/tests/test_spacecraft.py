# The spacecraft status route helpers.
# Written with Claude Code (Anthropic) assistance.

import numpy as np

from spherex_api import spacecraft


class FakeIndex:
    """Just enough of the exposure index for recent_pointings."""

    def __init__(self):
        self.rows = np.zeros(3, dtype=[("obsid", "S24"), ("mjd", "f8")])
        self.rows["obsid"] = [b"old", b"newest", b"middle"]
        self.rows["mjd"] = [60800.0, 61300.0, 61000.0]
        # Unit vectors toward (ra, dec) = (0, 0), (90, 0), and the north pole.
        self.boresight = np.array([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]])

    def __len__(self):
        return len(self.rows)


def test_recent_pointings_are_newest_first():
    recent = spacecraft.recent_pointings(FakeIndex())
    assert [entry["obsId"] for entry in recent] == ["newest", "middle", "old"]
    assert abs(recent[0]["ra"] - 90.0) < 1e-9 and abs(recent[0]["dec"]) < 1e-9
    assert abs(recent[1]["dec"] - 90.0) < 1e-9
    assert spacecraft.recent_pointings(None) == []


def test_facts():
    assert spacecraft.FACTS["norad"] == 63182 and spacecraft.FACTS["launched"] == "2025-03-12"


def test_every_telescope_says_where_it_is():
    ids = [entry["id"] for entry in spacecraft.TELESCOPES]
    assert len(ids) == len(set(ids)) and ids[0] == "spherex"
    for entry in spacecraft.TELESCOPES:
        assert entry["name"] and entry["agency"] and entry["use"] and entry["note"]
        assert entry["where"] in ("orbit", "ground", "deep", "gone")
        if entry["where"] == "orbit":
            assert isinstance(entry["norad"], int)
        if entry["where"] == "ground":
            assert -90 <= entry["latitude"] <= 90 and -180 <= entry["longitude"] <= 180
    # The telescopes in orbit now: SPHEREx, and three whose elements CelesTrak still publishes.
    assert [entry["norad"] for entry in spacecraft.TELESCOPES if entry["where"] == "orbit"] == [63182, 39089, 27783, 13777]


async def test_telescopes_in_orbit_carry_their_elements(monkeypatch):
    asked = []

    async def fake(norad=spacecraft.NORAD_ID):
        asked.append(norad)
        return {"NORAD_CAT_ID": norad, "MEAN_MOTION": 14.0}

    monkeypatch.setattr(spacecraft, "elements", fake)
    listed = await spacecraft.telescopes()
    assert sorted(asked) == [13777, 27783, 39089, 63182]
    by_id = {entry["id"]: entry for entry in listed}
    assert by_id["neossat"]["elements"]["NORAD_CAT_ID"] == 39089
    assert "elements" not in by_id["gaia"] and "elements" not in by_id["sdss"]
    # The shared list itself is left untouched.
    assert "elements" not in spacecraft.TELESCOPES[0]
