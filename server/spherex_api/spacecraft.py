# Where the SPHEREx spacecraft is, how fresh the public archive is, and where every other
# telescope behind the tool is: in orbit, on the ground, far away, or gone.
# Orbital elements come from CelesTrak. The browser turns them into live positions.
# CelesTrak asks clients to fetch a satellite at most once per update (about every two hours),
# so the answer is kept and shared between all visitors.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import time

import numpy as np

from . import cache, net

NORAD_ID = 63182
CELESTRAK = "https://celestrak.org/NORAD/elements/gp.php?CATNR={norad}&FORMAT=json"
ELEMENTS_TTL = 3 * 3600.0
RECENT = 8  # newest public exposures to report

FACTS = {
    "name": "SPHEREx",
    "fullName": "Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer",
    "launched": "2025-03-12",
    "norad": NORAD_ID,
    "orbit": "Sun-synchronous polar orbit along the line between day and night, about 650 km up",
}

# Every telescope whose data this tool shows, and where it is. "where" is one of:
#   orbit   circling the Earth now. Its live position is worked out from "norad".
#   ground  an observatory at "latitude" and "longitude" (degrees, east positive).
#   deep    far from the Earth, so it has no place on a world map.
#   gone    no longer in orbit.
# Dates and places are from each mission's own pages (NASA, ESA, CSA, IPAC, SDSS, STScI).
TELESCOPES = [
    {"id": "spherex", "name": "SPHEREx", "agency": "NASA", "where": "orbit", "norad": NORAD_ID,
     "use": "Every image, spectrum, and measurement in this tool",
     "note": "Launched in March 2025. Circles the Earth from pole to pole, about 650 km up, along the line between day and night."},
    {"id": "neossat", "name": "NEOSSat", "agency": "Canadian Space Agency", "where": "orbit", "norad": 39089,
     "use": "Visible-light images of the same field",
     "note": "Launched in February 2013. A small telescope that watches for asteroids and space debris, about 780 km up."},
    {"id": "galex", "name": "GALEX", "agency": "NASA", "where": "orbit", "norad": 27783,
     "use": "The ultraviolet layer of the sky map",
     "note": "Launched in April 2003 and switched off in June 2013. It still circles the Earth, silent."},
    {"id": "iras", "name": "IRAS", "agency": "NASA, the Netherlands, and the United Kingdom", "where": "orbit", "norad": 13777,
     "use": "The far-infrared dust layer of the sky map",
     "note": "Launched in January 1983. It ran out of coolant that November and still circles the Earth, silent."},
    {"id": "wise", "name": "WISE", "agency": "NASA", "where": "gone",
     "use": "The mid-infrared layers of the sky map, and the WISE brightness points on the spectrum",
     "note": "Launched in December 2009. It fell back into the atmosphere in November 2024."},
    {"id": "gaia", "name": "Gaia", "agency": "European Space Agency", "where": "deep",
     "use": "Star positions and motions",
     "note": "Launched in December 2013 to a point 1.5 million km from the Earth. Retired in March 2025, it now circles the Sun."},
    {"id": "spitzer", "name": "Spitzer", "agency": "NASA", "where": "deep",
     "use": "Two mid-infrared layers of the sky map",
     "note": "Launched in August 2003 and retired in January 2020. It trails the Earth around the Sun."},
    {"id": "herschel", "name": "Herschel", "agency": "European Space Agency", "where": "deep",
     "use": "The far-infrared dust layer of the sky map",
     "note": "Launched in May 2009 to a point 1.5 million km from the Earth. It ran out of coolant in April 2013 and now circles the Sun."},
    {"id": "planck", "name": "Planck", "agency": "European Space Agency", "where": "deep",
     "use": "The microwave layer of the sky map",
     "note": "Launched in May 2009 with Herschel. Switched off in October 2013, it now circles the Sun."},
    {"id": "2mass-north", "name": "2MASS, northern telescope", "agency": "University of Massachusetts and IPAC, for NASA and the NSF", "where": "ground",
     "latitude": 31.681, "longitude": -110.878,
     "use": "The near-infrared layer of the sky map, and the 2MASS brightness points on the spectrum",
     "note": "A 1.3 m telescope at the Whipple Observatory on Mount Hopkins, Arizona. It surveyed the northern sky from 1997 to 2001."},
    {"id": "2mass-south", "name": "2MASS, southern telescope", "agency": "University of Massachusetts and IPAC, for NASA and the NSF", "where": "ground",
     "latitude": -30.169, "longitude": -70.804,
     "use": "The near-infrared layer of the sky map, and the 2MASS brightness points on the spectrum",
     "note": "A 1.3 m telescope at Cerro Tololo, Chile. It surveyed the southern sky from 1998 to 2001."},
    {"id": "sdss", "name": "SDSS", "agency": "Sloan Digital Sky Survey", "where": "ground",
     "latitude": 32.780, "longitude": -105.820,
     "use": "A visible-light layer of the sky map",
     "note": "A 2.5 m telescope at Apache Point Observatory, New Mexico."},
    {"id": "dss-north", "name": "DSS, northern plates", "agency": "Palomar Observatory and STScI", "where": "ground",
     "latitude": 33.356, "longitude": -116.865,
     "use": "The visible-light layer of the sky map",
     "note": "Photographic plates from the Oschin Schmidt telescope at Palomar Observatory, California, later scanned."},
    {"id": "dss-south", "name": "DSS, southern plates", "agency": "UK Schmidt Telescope and STScI", "where": "ground",
     "latitude": -31.273, "longitude": 149.064,
     "use": "The visible-light layer of the sky map",
     "note": "Photographic plates from the UK Schmidt Telescope at Siding Spring, Australia, later scanned."},
]

# Elements per satellite: (time fetched, elements).
_elements: dict[int, tuple[float, dict]] = {}


async def elements(norad: int = NORAD_ID) -> dict | None:
    """The latest orbital elements of a satellite (OMM, as JSON), or the last good copy when CelesTrak can't be reached."""
    now = time.monotonic()
    held = _elements.get(norad)
    if held and now - held[0] < ELEMENTS_TTL:
        return held[1]
    name = "elements" if norad == NORAD_ID else f"elements-{norad}"
    try:
        response = await net.client().get(CELESTRAK.format(norad=norad), timeout=15)
        response.raise_for_status()
        found = response.json()
        if isinstance(found, list) and found and "MEAN_MOTION" in found[0]:
            _elements[norad] = (now, found[0])
            cache.save_json("spacecraft", name, found[0])
            return found[0]
    except Exception:  # noqa: BLE001 (fall back to the stored copy)
        pass
    stored = held[1] if held else cache.load_json("spacecraft", name)
    if stored:
        # Hold the old copy for a while before asking CelesTrak again.
        _elements[norad] = (now - ELEMENTS_TTL + 600.0, stored)
    return stored


async def telescopes() -> list[dict]:
    """Every telescope behind the tool. The ones in Earth orbit carry their orbital elements."""
    orbiting = [entry for entry in TELESCOPES if entry["where"] == "orbit"]
    found = await asyncio.gather(*(elements(entry["norad"]) for entry in orbiting))
    by_id = {entry["id"]: result for entry, result in zip(orbiting, found)}
    return [{**entry, "elements": by_id[entry["id"]]} if entry["where"] == "orbit" else dict(entry) for entry in TELESCOPES]


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
