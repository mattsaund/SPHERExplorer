# Known objects on the sky, for map annotations. Queries SIMBAD through its TAP mirrors,
# because browsers can't reach every mirror and the main CDS site has been unreliable.
# Results are ranked by how often an object appears in the literature, so the best-known
# objects in any view come first.
# Written with Claude Code (Anthropic) assistance.

import math
import re
import time

from . import net
from .resolve import REFERENCE_EPOCH, kind_of

# SIMBAD TAP endpoints, fastest first.
SIMBAD_TAP = (
    "https://simbad.cfa.harvard.edu/simbad/sim-tap/sync",
    "https://simbad.idia.ac.za/simbad/sim-tap/sync",
    "https://simbad.cds.unistra.fr/simbad/sim-tap/sync",
)
# A page about one object, for "more information" links.
SIMBAD_PAGE = "https://simbad.cfa.harvard.edu/simbad/sim-id?Ident="

CACHE_SECONDS = 6 * 3600
MAX_RADIUS = 90.0  # the cone function of SIMBAD's database stops at 90 degrees

COLUMNS = 'b.main_id, b.ra, b.dec, b.otype, b.pmra, b.pmdec, b.plx_value, b.rvz_redshift, b.sp_type, b.nbref, f."V", f."K"'

_cache: dict[tuple, tuple[float, list]] = {}


def clean_name(main_id: str) -> str:
    """SIMBAD pads and prefixes names ("NAME Orion-KL", "M  42", "* alf Lyr"). Tidy them for people."""
    name = re.sub(r"\s+", " ", main_id).strip()
    for prefix in ("NAME ", "* ", "V* ", "EM* ", "** "):
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


def _shape(row: list) -> dict:
    main_id, ra, dec, code, pm_ra, pm_dec, parallax, redshift, sp_type, refs, v_mag, k_mag = row
    years = REFERENCE_EPOCH - 2000.0
    if pm_ra is not None and pm_dec is not None:
        # Carry fast-moving stars from their J2000 catalog position to today's sky.
        dec_now = dec + pm_dec * years / 3.6e6
        ra_now = ra + pm_ra * years / 3.6e6 / max(math.cos(math.radians(dec)), 1e-6)
    else:
        ra_now, dec_now = ra, dec
    return {
        "id": main_id,
        "name": clean_name(main_id),
        "ra": ra_now,
        "dec": dec_now,
        "epoch": REFERENCE_EPOCH,
        "kind": kind_of(code or ""),
        "code": code,
        "pmRa": pm_ra,
        "pmDec": pm_dec,
        "parallax": parallax,
        "redshift": redshift,
        "spectralType": sp_type or None,
        "refs": refs,
        "vMag": v_mag,
        "kMag": k_mag,
        "url": SIMBAD_PAGE + _quote(main_id),
    }


def _quote(text: str) -> str:
    from urllib.parse import quote

    return quote(text)


async def _tap(adql: str) -> list:
    last: Exception | None = None
    for base in SIMBAD_TAP:
        try:
            response = await net.client().get(
                base, params={"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "json", "QUERY": adql}, timeout=15,
            )
            response.raise_for_status()
            return response.json()["data"]
        except Exception as error:  # noqa: BLE001 (try the next mirror)
            last = error
    raise net.UpstreamError(f"The SIMBAD mirrors did not answer: {last}")


async def simbad_cone(ra: float, dec: float, radius: float, limit: int = 200) -> list[dict]:
    """The best-known objects within radius degrees of a position, most cited first."""
    limit = max(1, min(int(limit), 1000))
    # Round so that small pans reuse a cached answer.
    step = max(radius / 8.0, 1e-4)
    token = (round(ra / step), round(dec / step), round(radius, 4), limit)
    now = time.monotonic()
    hit = _cache.get(token)
    if hit and now - hit[0] < CACHE_SECONDS:
        return hit[1]

    source = "basic AS b LEFT JOIN allfluxes AS f ON f.oidref = b.oid"
    if radius >= MAX_RADIUS:
        # The whole sky: no cone needed.
        adql = f"SELECT TOP {limit} {COLUMNS} FROM {source} WHERE b.ra IS NOT NULL ORDER BY nbref DESC"
    else:
        adql = (
            f"SELECT TOP {limit} {COLUMNS} FROM {source} "
            f"WHERE CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', {ra:.6f}, {dec:.6f}, {radius:.6f})) = 1 "
            "ORDER BY nbref DESC"
        )
    objects = [_shape(row) for row in await _tap(adql) if row[1] is not None and row[2] is not None]
    _cache[token] = (now, objects)
    if len(_cache) > 800:
        for old in sorted(_cache, key=lambda k: _cache[k][0])[:200]:
            _cache.pop(old, None)
    return objects
