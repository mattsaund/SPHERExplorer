# Where the SPHEREx spacecraft is, and how fresh the public archive is.
# Orbital elements come from CelesTrak. The browser turns them into a live position.
# CelesTrak asks clients to fetch a satellite at most once per update (about every two hours),
# so the answer is kept and shared between all visitors.
# Written with Claude Code (Anthropic) assistance.

import time

import numpy as np

from . import cache, net

NORAD_ID = 63182
CELESTRAK = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={NORAD_ID}&FORMAT=json"
ELEMENTS_TTL = 3 * 3600.0
RECENT = 8  # newest public exposures to report

FACTS = {
    "name": "SPHEREx",
    "fullName": "Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer",
    "launched": "2025-03-12",
    "norad": NORAD_ID,
    "orbit": "Sun-synchronous polar orbit along the line between day and night, about 650 km up",
}

_elements: tuple[float, dict] | None = None


async def elements() -> dict | None:
    """The latest orbital elements (OMM, as JSON), or the last good copy when CelesTrak can't be reached."""
    global _elements
    now = time.monotonic()
    if _elements and now - _elements[0] < ELEMENTS_TTL:
        return _elements[1]
    try:
        response = await net.client().get(CELESTRAK, timeout=15)
        response.raise_for_status()
        found = response.json()
        if isinstance(found, list) and found and "MEAN_MOTION" in found[0]:
            _elements = (now, found[0])
            cache.save_json("spacecraft", "elements", found[0])
            return found[0]
    except Exception:  # noqa: BLE001 (fall back to the stored copy)
        pass
    stored = _elements[1] if _elements else cache.load_json("spacecraft", "elements")
    if stored:
        # Hold the old copy for a while before asking CelesTrak again.
        _elements = (now - ELEMENTS_TTL + 600.0, stored)
    return stored


def recent_pointings(index) -> list[dict]:
    """Where the newest public exposures looked: time and the sky position of the detector 1 center."""
    if index is None or not len(index):
        return []
    out = []
    for row in np.argsort(index.rows["mjd"])[-RECENT:][::-1]:
        x, y, z = index.boresight[row]
        out.append({
            "obsId": index.rows["obsid"][row].decode(),
            "mjd": float(index.rows["mjd"][row]),
            "ra": float(np.degrees(np.arctan2(y, x)) % 360.0),
            "dec": float(np.degrees(np.arcsin(np.clip(z, -1.0, 1.0)))),
        })
    return out
