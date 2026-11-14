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
