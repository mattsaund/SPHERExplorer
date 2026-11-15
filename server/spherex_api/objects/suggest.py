# Suggestions for the search box that need a lookup: asteroids and comets whose name starts
# with what was typed (JPL Small-Body Database), and whether the typed text itself is a known
# name. The web app adds its own list of well-known objects without asking the server.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import re

from .. import net
from ..cache import LRU
from . import resolve, solarsystem

# Letters, digits, and the few marks that appear in names and designations.
SAFE = re.compile(r"[A-Za-z0-9 /'\-]{3,40}")
# "1 Ceres (A801 AA)": a numbered asteroid, its name, then its first designation in brackets.
NUMBERED = re.compile(r"^(\d+ .+?) \([^()]*\)$")
# Comets by name or designation: "9P/Tempel 1", "C/2023 A3 (ATLAS)", "P/2010 A2", and interstellar "3I".
COMET = re.compile(r"^(\d+[PDI]\b|[CPDXI]/)")
MAX_BODIES = 6
LOOKUP_SECONDS = 2.5

_bodies = LRU(500)


def parse_bodies(data: dict, limit: int = MAX_BODIES) -> list[dict]:
    """Turn a Small-Body Database answer into suggestion rows. Handles one match or a list."""
    entries = []
    if isinstance(data.get("list"), list):
        entries = [(str(item.get("name", "")), str(item.get("pdes", ""))) for item in data["list"]]
    elif isinstance(data.get("object"), dict):
        entries = [(str(data["object"].get("fullname", "")), str(data["object"].get("des", "")))]
    rows = []
    for name, designation in entries:
        name = re.sub(r"\s+", " ", name).strip()
        if not name or not designation:
            continue
        comet = bool(COMET.match(name) or COMET.match(designation))
        numbered = NUMBERED.match(name)
        rows.append({
            "label": numbered.group(1) if numbered and not comet else name,
            "detail": "Comet" if comet else "Asteroid",
            # The word in front tells the name lookup to go straight to the solar system.
            "query": f"{'comet' if comet else 'asteroid'} {designation}",
            "group": "solar",
        })
        if len(rows) >= limit:
            break
    return rows


async def small_bodies(text: str) -> list[dict]:
    """Asteroids and comets whose name starts with the text."""
    text = solarsystem.PREFIX.sub("", text.strip())
    if not SAFE.fullmatch(text) or not re.search(r"[A-Za-z]{3}", text):
        return []
    token = text.lower()
    stored = _bodies.get(token)
    if stored is not None:
        return stored
    try:
        response = await net.client().get(solarsystem.SBDB, params={"sstr": text + "*"}, timeout=6)
        rows = parse_bodies(response.json())
    except Exception:  # noqa: BLE001 (suggestions are optional)
        return []
    _bodies.put(token, rows)
    return rows


async def known_name(text: str) -> list[dict]:
    """One row when the typed text is itself a name the lookup knows."""
    try:
        found = await asyncio.wait_for(resolve.resolve(text), LOOKUP_SECONDS)
    except Exception:  # noqa: BLE001 (slow or unreachable: no row)
        return []
    if not found:
        return []
    return [{"label": found["name"], "detail": found.get("kind") or "Known object", "query": text.strip(), "group": "match"}]


async def remote(text: str) -> list[dict]:
    """Every suggestion that needs a lookup, the typed name first."""
    named, bodies = await asyncio.gather(known_name(text), small_bodies(text))
    return named + bodies
