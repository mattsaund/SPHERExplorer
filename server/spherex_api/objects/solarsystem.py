# Solar system bodies as moving targets: planets, asteroids, and comets.
# Names are looked up in JPL's Small-Body Database. Positions come from JPL Horizons.
# A body's path is matched against the exposure index to find every image that caught it.
#
# SPHEREx circles the Earth every 98 minutes, which shifts a nearby body by about
# 10 arcseconds divided by its distance in au. The ephemeris here is for the center of the
# Earth, which varies smoothly. Each image's own header gives where the spacecraft was, and
# topocentric() applies that shift. The result matches Horizons run for SPHEREx itself to
# 0.001 arcseconds.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import math
import re
import time
from dataclasses import dataclass
from urllib.parse import quote

import numpy as np

from .. import cache, config, net
from ..images.pointing import project, unit_vector

SBDB = "https://ssd-api.jpl.nasa.gov/sbdb.api"
HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
AU_KM = 149597870.7
MISSION_START = "2025-04-20"     # just before the first public image
EPHEMERIS_TTL = 24 * 3600.0
MOVING_MARGIN = 40.0             # pixels of slack for the spacecraft shift when searching

# Major bodies by name. Horizons knows them by number.
MAJOR = {
    "mercury": ("199", "Mercury", "Planet"), "venus": ("299", "Venus", "Planet"), "mars": ("499", "Mars", "Planet"),
    "jupiter": ("599", "Jupiter", "Planet"), "saturn": ("699", "Saturn", "Planet"), "uranus": ("799", "Uranus", "Planet"),
    "neptune": ("899", "Neptune", "Planet"), "pluto": ("999", "Pluto", "Dwarf planet"), "moon": ("301", "The Moon", "Moon"),
    # SPHEREx never points near the Sun, so this finds no images. It is here so the name is known.
    "sun": ("10", "The Sun", "Star"),
}
# Words people put in front of a name to say what they mean.
PREFIX = re.compile(r"^(asteroid|comet|minor planet|dwarf planet|planet)\s+", re.I)
# The same said after the name: "Halley's Comet", "Halley comet".
COMET_SUFFIX = re.compile(r"('s)?\s+comet$", re.I)
# A comet or interstellar designation at the start of a name: "1P", "67P/Churyumov-Gerasimenko",
# "3I/ATLAS", "C/2025 N1 (ATLAS)". JPL finds the body by this part alone. Given the full
# "1P/Halley" it also offers the asteroid 2688 Halley, and lists it first.
DESIGNATION = re.compile(r"^(\d+[PDI]|[CPDXA]/\d{4} [A-Z]{1,2}\d*)(?=$|[/ (])", re.I)
COMMAND = re.compile(r"^(\d{2,3}|DES=[A-Za-z0-9 /\-]+;( CAP;)?)$")


@dataclass
class Ephemeris:
    """A body's path as seen from the center of the Earth."""

    jd: np.ndarray        # Julian dates (UTC)
    vectors: np.ndarray   # unit vectors toward the body, ICRF
    delta: np.ndarray     # distance from Earth, au
    r: np.ndarray         # distance from the Sun, au
    mag: np.ndarray       # apparent magnitude (total magnitude for comets), NaN when unknown

    def at(self, mjd: np.ndarray):
        """Direction, Earth distance, Sun distance, and magnitude at the given times."""
        jd = np.asarray(mjd, dtype=float) + 2400000.5
        vectors = np.stack([np.interp(jd, self.jd, self.vectors[:, i]) for i in range(3)], axis=-1)
        vectors /= np.linalg.norm(vectors, axis=-1, keepdims=True)
        return vectors, np.interp(jd, self.jd, self.delta), np.interp(jd, self.jd, self.r), np.interp(jd, self.jd, self.mag)


_ephemerides: dict[str, tuple[float, Ephemeris]] = {}
_lookups: dict[str, dict | None] = {}


def choose(matches: list[dict], wanted: str | None) -> dict:
    """Pick one of several bodies that share a name.

    JPL lists asteroids first. A comet's name has a slash in it ("1P/Halley"). Someone who
    wrote "comet" or "asteroid" gets that kind. Otherwise a lone comet among asteroids wins,
    because a comet such as Halley or Encke is the body people know by that name.
    """
    comets = [match for match in matches if "/" in str(match.get("name", ""))]
    others = [match for match in matches if match not in comets]
    if wanted == "comet" and comets:
        return comets[0]
    if wanted == "asteroid" and others:
        return others[0]
    if wanted is None and len(comets) == 1:
        return comets[0]
    return matches[0]


async def lookup(name: str) -> dict | None:
    """Find a solar system body by name. Returns its display name, kind, and Horizons command.

    Raises net.UpstreamError when JPL cannot be reached, which is not the same as not found.
    """
    text = name.strip()
    said = PREFIX.match(text)
    wanted = None
    if said:
        word = said.group(1).lower()
        wanted = "comet" if word == "comet" else "asteroid" if word in ("asteroid", "minor planet") else None
        text = text[said.end():]
    if COMET_SUFFIX.search(text):
        wanted = "comet"
        text = COMET_SUFFIX.sub("", text)
    designation = DESIGNATION.match(text)
    if designation:
        text = designation.group(1)
    token = re.sub(r"\s+", " ", text.lower())
    if not token:
        return None
    # The sky map labels them "The Sun" and "The Moon", so people type that too.
    major = token.removeprefix("the ")
    if major in MAJOR:
        command, label, kind = MAJOR[major]
        page = "dwarf-planets/pluto" if major == "pluto" else major
        return {"name": label, "kind": kind, "command": command, "url": f"https://science.nasa.gov/{page}/"}
    # The kind asked for is part of the key: "comet Halley" and "asteroid Halley" differ.
    token = f"{wanted or 'any'}|{token}"
    if token in _lookups:
        return _lookups[token]
    stored = cache.load_json("body", token)
    if stored:
        _lookups[token] = stored
        return stored
    try:
        response = await net.client().get(SBDB, params={"sstr": text}, timeout=15)
        data = response.json()
        if "object" not in data and data.get("list"):
            # Several bodies share the name. Ask again for the one that was meant.
            response = await net.client().get(SBDB, params={"sstr": choose(data["list"], wanted)["pdes"]}, timeout=15)
            data = response.json()
    except Exception as error:  # noqa: BLE001 (JPL is unreachable, so this is not a "not found")
        raise net.UpstreamError("The JPL name service did not answer.") from error
    body = data.get("object")
    if not body:
        _lookups[token] = None
        return None
    comet = str(body.get("kind", "")).startswith("c")
    answer = {
        "name": re.sub(r"\s+", " ", body.get("fullname", text)).strip(),
        "kind": (body.get("orbit_class") or {}).get("name") or ("Comet" if comet else "Asteroid"),
        # Comets have one orbit solution per return. CAP picks the one closest to today.
        "command": f"DES={body['des']}; CAP;" if comet else f"DES={body['spkid']};",
        # JPL's page for the body: orbit, size, discovery, and close approaches.
        "url": "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=" + quote(str(body["des"])),
    }
    _lookups[token] = answer
    cache.save_json("body", token, answer)
    return answer


def parse_horizons(text: str) -> Ephemeris:
    """Read the table out of a Horizons CSV answer."""
    if "$$SOE" not in text:
        tail = " ".join(text.strip().splitlines()[-4:])
        raise net.UpstreamError(f"JPL Horizons gave no ephemeris: {tail[:200]}")
    rows = []
    for line in text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip().splitlines():
        cells = [cell.strip() for cell in line.split(",")]
        if len(cells) < 10:
            continue

        # A number from a Horizons cell, or NaN when the cell holds none.
        def number(value: str) -> float:
            try:
                return float(value)
            except ValueError:
                return math.nan

        # Columns: date, sun flag, moon flag, RA, Dec, magnitude, second magnitude, r, rdot, delta.
        rows.append((float(cells[0]), float(cells[3]), float(cells[4]), number(cells[5]), float(cells[7]), float(cells[9])))
    if len(rows) < 2:
        raise net.UpstreamError("JPL Horizons returned an empty ephemeris")
    table = np.array(rows)
    return Ephemeris(jd=table[:, 0], vectors=unit_vector(table[:, 1], table[:, 2]), delta=table[:, 5], r=table[:, 4], mag=table[:, 3])


async def ephemeris(command: str, stop_mjd: float) -> Ephemeris:
    """Hourly geocentric path of a body across the SPHEREx mission, cached for a day."""
    if not COMMAND.match(command):
        raise ValueError("Not a body identifier")
    now = time.monotonic()
    hit = _ephemerides.get(command)
    if hit and now - hit[0] < EPHEMERIS_TTL and hit[1].jd[-1] - 2400000.5 >= stop_mjd:
        return hit[1]
    stop = time.strftime("%Y-%m-%d", time.gmtime((stop_mjd + 2.0 - 40587.0) * 86400.0))
    params = {
        "format": "text", "COMMAND": f"'{command}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'", "CENTER": "'500@399'", "START_TIME": f"'{MISSION_START}'", "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": "'1 h'", "QUANTITIES": "'1,9,19,20'", "CSV_FORMAT": "'YES'", "ANG_FORMAT": "'DEG'", "CAL_FORMAT": "'JD'",
    }
    last: Exception | None = None
    for attempt in range(3):
        try:
            response = await net.client().get(HORIZONS, params=params, timeout=60)
            response.raise_for_status()
            result = parse_horizons(response.text)
            _ephemerides[command] = (now, result)
            return result
        except net.UpstreamError:
            raise
        except Exception as error:  # noqa: BLE001
            last = error
            await asyncio.sleep(1.0 + attempt)
    raise net.UpstreamError(f"JPL Horizons did not answer: {last}")


def topocentric(ra: float, dec: float, delta_au: float, spacecraft_km) -> tuple[float, float]:
    """Shift a geocentric direction to what the spacecraft saw, given its position from the image header."""
    toward = unit_vector(ra, dec) * delta_au * AU_KM - np.asarray(spacecraft_km, dtype=float)
    toward /= np.linalg.norm(toward)
    return float(np.degrees(np.arctan2(toward[1], toward[0])) % 360.0), float(np.degrees(np.arcsin(toward[2])))


def find_moving(index, path: Ephemeris):
    """Images that caught a moving body. Returns row numbers, detectors, pixel estimates, and the body's state at each."""
    mjd = index.rows["mjd"]
    vectors, delta, r, mag = path.at(mjd)
    near = np.flatnonzero(np.einsum("ij,ij->i", index.boresight, vectors) > math.cos(math.radians(10.5)))
    size = config.DETECTOR_SIZE
    picks = []
    for k in range(6):
        frames = index.frames[near] @ index.relative[k]
        x, y, facing = project(frames, index.scale_inverse[k], vectors[near], index.sip[k])
        inside = (
            facing
            & (x > -MOVING_MARGIN) & (x < size - 1 + MOVING_MARGIN)
            & (y > -MOVING_MARGIN) & (y < size - 1 + MOVING_MARGIN)
            & (index.rows["vdir"][near, k] != 0xFFFF)
        )
        rows = near[inside]
        picks.append((rows, np.full(rows.size, k + 1), x[inside], y[inside]))
    rows = np.concatenate([p[0] for p in picks])
    detector = np.concatenate([p[1] for p in picks])
    x = np.concatenate([p[2] for p in picks])
    y = np.concatenate([p[3] for p in picks])
    order = np.lexsort((detector, mjd[rows]))
    rows, detector, x, y = rows[order], detector[order], x[order], y[order]
    ra = np.degrees(np.arctan2(vectors[rows, 1], vectors[rows, 0])) % 360.0
    dec = np.degrees(np.arcsin(np.clip(vectors[rows, 2], -1, 1)))
    return rows, detector, x, y, ra, dec, delta[rows], r[rows], mag[rows]
