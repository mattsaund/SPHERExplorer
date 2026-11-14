# Data from other missions for the same patch of sky: Gaia DR3 positions and motions (from MAST,
# the NASA archive the challenge points to), and 2MASS and WISE brightness (from VizieR mirrors).
# Browsers can't call these services directly, so the API relays and tidies them.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import json
import math
import time

from . import net

MAST = "https://mast.stsci.edu/api/v0/invoke"
VIZIER = ("https://vizier.cfa.harvard.edu", "https://vizier.idia.ac.za", "https://vizier.cds.unistra.fr")

GAIA_EPOCH = 2016.0
ALLWISE_EPOCH = 2010.5   # middle of the AllWISE observations
CACHE_SECONDS = 6 * 3600
GAIA_LIMIT = 400

# Flux of a zero-magnitude star in jansky, and the band's center and width in microns.
# 2MASS: Cohen, Wheaton, and Megeath 2003. WISE: Jarrett et al. 2011.
BANDS = {
    "J": {"zero": 1594.0, "wavelength": 1.235, "width": 0.162, "survey": "2MASS"},
    "H": {"zero": 1024.0, "wavelength": 1.662, "width": 0.251, "survey": "2MASS"},
    "Ks": {"zero": 666.7, "wavelength": 2.159, "width": 0.262, "survey": "2MASS"},
    "W1": {"zero": 309.54, "wavelength": 3.353, "width": 0.66, "survey": "WISE"},
    "W2": {"zero": 171.787, "wavelength": 4.603, "width": 1.04, "survey": "WISE"},
}

_cache: dict[tuple, tuple[float, dict]] = {}


def _float(text):
    try:
        value = float(text)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def flux_ujy(band: str, magnitude: float | None, error: float | None):
    """Vega magnitude to flux density in microjansky, with its error."""
    if magnitude is None:
        return None, None
    flux = BANDS[band]["zero"] * 10 ** (-0.4 * magnitude) * 1e6
    return flux, (flux * error * 0.921 if error else None)  # 0.921 = ln(10) / 2.5


def parse_tsv(text: str) -> list[dict]:
    """Rows of a VizieR tab-separated answer as dicts. Comment lines start with #."""
    lines = [line for line in text.splitlines() if line and not line.startswith("#")]
    if len(lines) < 3:
        return []
    names = lines[0].split("\t")
    rows = []
    for line in lines[3:]:  # skip the header, the units line, and the dashes line
        cells = line.split("\t")
        if len(cells) == len(names):
            rows.append({name: cell.strip() for name, cell in zip(names, cells)})
    return rows


async def _vizier(source: str, ra: float, dec: float, radius_arcsec: float, columns: str, limit: int = 300) -> list[dict]:
    query = f"/viz-bin/asu-tsv?-source={source}&-c={ra:.6f}%20{dec:+.6f}&-c.rs={radius_arcsec:.1f}&-out={columns}&-out.max={limit}"
    last: Exception | None = None
    for host in VIZIER:
        try:
            response = await net.client().get(host + query, timeout=20)
            response.raise_for_status()
            return parse_tsv(response.text)
        except Exception as error:  # noqa: BLE001 (try the next mirror)
            last = error
    raise net.UpstreamError(f"The VizieR mirrors did not answer: {last}")


async def gaia(ra: float, dec: float, radius_arcsec: float) -> list[dict]:
    """Gaia DR3 sources in a cone, brightest first. Positions are at epoch 2016.0."""
    request = {
        "service": "Mast.Catalogs.GaiaDR3.Cone",
        "params": {"ra": ra, "dec": dec, "radius": radius_arcsec / 3600.0},
        "format": "json",
        "pagesize": 2000,
    }
    try:
        response = await net.client().get(MAST, params={"request": json.dumps(request)}, timeout=25)
        response.raise_for_status()
        rows = response.json().get("data", [])
        sources = [
            {
                "id": str(row.get("designation") or row.get("source_id")),
                "ra": row["ra"], "dec": row["dec"], "epoch": GAIA_EPOCH,
                "pmRa": row.get("pmra"), "pmDec": row.get("pmdec"), "parallax": row.get("parallax"),
                "g": row.get("phot_g_mean_mag"), "bp": row.get("phot_bp_mean_mag"), "rp": row.get("phot_rp_mean_mag"),
            }
            for row in rows if row.get("ra") is not None and row.get("dec") is not None
        ]
    except Exception:  # noqa: BLE001 (MAST is down or slow, so use the VizieR copy)
        rows = await _vizier("I/355/gaiadr3", ra, dec, radius_arcsec, "Source,RA_ICRS,DE_ICRS,Plx,pmRA,pmDE,Gmag,BPmag,RPmag", 2000)
        sources = [
            {
                "id": "Gaia DR3 " + row["Source"],
                "ra": _float(row["RA_ICRS"]), "dec": _float(row["DE_ICRS"]), "epoch": GAIA_EPOCH,
                "pmRa": _float(row["pmRA"]), "pmDec": _float(row["pmDE"]), "parallax": _float(row["Plx"]),
                "g": _float(row["Gmag"]), "bp": _float(row["BPmag"]), "rp": _float(row["RPmag"]),
            }
            for row in rows if _float(row["RA_ICRS"]) is not None
        ]
    sources.sort(key=lambda s: s["g"] if s["g"] is not None else 99.0)
    return sources[:GAIA_LIMIT]


async def twomass(ra: float, dec: float, radius_arcsec: float) -> list[dict]:
    """2MASS point sources in a cone, with fluxes in microjansky and the date each was observed."""
    rows = await _vizier("II/246/out", ra, dec, radius_arcsec, "RAJ2000,DEJ2000,2MASS,Jmag,e_Jmag,Hmag,e_Hmag,Kmag,e_Kmag,JD")
    out = []
    for row in rows:
        julian = _float(row.get("JD"))
        entry = {
            "id": "2MASS J" + row.get("2MASS", ""),
            "ra": _float(row["RAJ2000"]), "dec": _float(row["DEJ2000"]),
            # Julian date to a Julian year. Positions are where the source was on that date.
            "epoch": 2000.0 + (julian - 2451545.0) / 365.25 if julian else 1999.5,
            "bands": {},
        }
        for band, column in (("J", "Jmag"), ("H", "Hmag"), ("Ks", "Kmag")):
            flux, error = flux_ujy(band, _float(row.get(column)), _float(row.get("e_" + column)))
            if flux is not None:
                entry["bands"][band] = {"flux": flux, "err": error, "mag": _float(row.get(column))}
        if entry["ra"] is not None and entry["bands"]:
            out.append(entry)
    return out


async def wise(ra: float, dec: float, radius_arcsec: float) -> list[dict]:
    """AllWISE sources in a cone, with W1 and W2 fluxes in microjansky."""
    rows = await _vizier("II/328/allwise", ra, dec, radius_arcsec, "RAJ2000,DEJ2000,AllWISE,W1mag,e_W1mag,W2mag,e_W2mag")
    out = []
    for row in rows:
        entry = {
            "id": "WISEA " + row.get("AllWISE", ""),
            "ra": _float(row["RAJ2000"]), "dec": _float(row["DEJ2000"]),
            "epoch": ALLWISE_EPOCH,
            "bands": {},
        }
        for band, column in (("W1", "W1mag"), ("W2", "W2mag")):
            flux, error = flux_ujy(band, _float(row.get(column)), _float(row.get("e_" + column)))
            if flux is not None:
                entry["bands"][band] = {"flux": flux, "err": error, "mag": _float(row.get(column))}
        if entry["ra"] is not None and entry["bands"]:
            out.append(entry)
    return out


async def nearby(ra: float, dec: float, radius_arcsec: float) -> dict:
    """Everything the other missions know about a patch of sky. A failed source comes back empty."""
    token = (round(ra, 4), round(dec, 4), round(radius_arcsec))
    now = time.monotonic()
    hit = _cache.get(token)
    if hit and now - hit[0] < CACHE_SECONDS:
        return hit[1]
    results = await asyncio.gather(
        gaia(ra, dec, radius_arcsec), twomass(ra, dec, radius_arcsec), wise(ra, dec, radius_arcsec),
        return_exceptions=True,
    )
    names = ("gaia", "twomass", "wise")
    answer = {
        "bands": BANDS,
        "errors": [f"{name}: {result}" for name, result in zip(names, results) if isinstance(result, Exception)],
        **{name: ([] if isinstance(result, Exception) else result) for name, result in zip(names, results)},
    }
    if not answer["errors"]:
        _cache[token] = (now, answer)
        if len(_cache) > 400:
            for old in sorted(_cache, key=lambda k: _cache[k][0])[:100]:
                _cache.pop(old, None)
    return answer
