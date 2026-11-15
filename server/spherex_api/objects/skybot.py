# Which known solar system bodies were at a place in the sky at a given moment.
# Asks the SkyBoT service of IMCCE (Paris Observatory), which keeps the paths of every known
# asteroid, comet, planet, and moon. One question takes it about twenty seconds.
# Berthier et al. 2006, ASP Conf. Ser. 351, 367. See docs/references.md.
# Written with Claude Code (Anthropic) assistance.

import math
import re

from .. import config, net
from ..cache import LRU

SKYBOT = "https://ssp.imcce.fr/webservices/skybot/api/conesearch.php"
TIMEOUT = 60.0
MAX_BODIES = 12

# SkyBoT's class codes, in plain words. The part after ">" is a finer family.
CLASSES = {
    "MB": "Main-belt asteroid",
    "NEA": "Near-Earth asteroid",
    "Mars-Crosser": "Mars-crossing asteroid",
    "Hungaria": "Hungaria asteroid",
    "Trojan": "Trojan asteroid",
    "Centaur": "Centaur",
    "KBO": "Kuiper belt object",
    "IOC": "Inner Oort cloud object",
    "Comet": "Comet",
    "Planet": "Planet",
    "Dwarf Planet": "Dwarf planet",
    "Satellite": "Moon",
}

_answers = LRU(300)


def _degrees(text: str, hours: bool) -> float:
    """Sexagesimal text such as "11 59 49.47" or "+01 27 30.4" to degrees."""
    parts = text.strip().split()
    sign = -1.0 if parts[0].startswith("-") else 1.0
    a, b, c = (abs(float(part)) for part in parts[:3])
    return sign * (a + b / 60.0 + c / 3600.0) * (15.0 if hours else 1.0)


def kind_of(code: str) -> str:
    """A plain name for a SkyBoT class such as "MB>Inner" or "NEA>Apollo"."""
    head, _, tail = (code or "").partition(">")
    plain = CLASSES.get(head.strip(), "Solar system body")
    return f"{plain} ({tail.strip().lower()})" if tail.strip() and head.strip() in ("MB", "NEA", "KBO", "Trojan") else plain


def parse(found: list[dict]) -> list[dict]:
    """SkyBoT's rows as the app's rows, nearest first."""
    bodies = []
    for row in found:
        try:
            name = str(row["Name"]).strip()
            number = row.get("Num")
            kind = kind_of(str(row.get("Class", "")))
            comet = kind == "Comet"
            east = float(row.get("dRA (arcsec/h)") or 0.0)
            north = float(row.get("dDEC (arcsec/h)") or 0.0)
            # What to type in the search box to follow it. Numbered asteroids go by number.
            if comet:
                query = f"comet {name}"
            elif isinstance(number, int) or (isinstance(number, str) and number.strip().isdigit()):
                query = f"asteroid {int(number)}"
            else:
                query = f"asteroid {name}"
            bodies.append({
                "name": f"({int(number)}) {name}" if query.startswith("asteroid ") and query[9:].isdigit() else name,
                "kind": kind,
                "ra": _degrees(str(row["RA (hms)"]), True),
                "dec": _degrees(str(row["DEC (dms)"]), False),
                "separation": float(row["d (arcsec)"]),
                "magnitude": float(row["VMag (mag)"]) if row.get("VMag (mag)") is not None else None,
                "rate": math.hypot(east, north),
                # Direction of travel in degrees, from north through east.
                "angle": math.degrees(math.atan2(east, north)) % 360.0,
                "earthDistance": float(row["dg (ua)"]) if row.get("dg (ua)") is not None else None,
                "sunDistance": float(row["dh (ua)"]) if row.get("dh (ua)") is not None else None,
                "positionError": float(row["Err (arcsec)"]) if row.get("Err (arcsec)") is not None else None,
                "query": query,
            })
        except (KeyError, TypeError, ValueError, IndexError):
            continue  # a row in a shape we do not know is skipped, not fatal
    bodies.sort(key=lambda body: body["separation"])
    return bodies[:MAX_BODIES]


async def known_at(ra: float, dec: float, mjd: float, radius: float) -> list[dict]:
    """Known solar system bodies within `radius` arcseconds of a position at a moment (MJD, UTC).

    Positions are as seen from the center of the Earth. SPHEREx is at most 7,000 km from it,
    which shifts a main-belt asteroid by a few arcseconds and a close-passing one by more.
    Raises UpstreamError when the service can't be reached.
    """
    token = (round(ra, 4), round(dec, 4), round(mjd, 4), round(radius))
    held = _answers.get(token)
    if held is not None:
        return held
    params = {
        "-ep": f"{mjd + 2400000.5:.6f}",
        "-ra": f"{ra:.6f}",
        "-dec": f"{dec:.6f}",
        "-rd": f"{radius / 3600.0:.6f}",
        "-mime": "json",
        "-output": "all",
        "-loc": "500",
        # The service asks every caller to name itself. The API's own client name is used.
        "-from": re.sub(r"[^A-Za-z0-9._-]", "", config.USER_AGENT.split("/")[0]) or "client",
    }
    try:
        response = await net.client().get(SKYBOT, params=params, timeout=TIMEOUT)
    except Exception as error:  # noqa: BLE001
        raise net.UpstreamError(f"The solar system lookup did not answer: {type(error).__name__}") from error
    if response.status_code == 204 or not response.content.strip():
        bodies = []  # nothing known there
    elif response.status_code != 200:
        raise net.UpstreamError(f"The solar system lookup answered with an error ({response.status_code}).")
    else:
        try:
            found = response.json()
        except ValueError as error:
            raise net.UpstreamError("The solar system lookup sent an answer that could not be read.") from error
        bodies = parse(found if isinstance(found, list) else [])
    _answers.put(token, bodies)
    return bodies
