# How far away an object is, from the best information available:
# a parallax for nearby stars, a published distance for galaxies, or the redshift for distant ones.
# Written with Claude Code (Anthropic) assistance.

import math

import numpy as np

from .. import net

SIMBAD_TAP = (
    "https://simbad.cfa.harvard.edu/simbad/sim-tap/sync",
    "https://simbad.idia.ac.za/simbad/sim-tap/sync",
)

# Flat Lambda-CDM with the Planck 2018 values (Planck Collaboration 2020, A&A 641, A6).
H0 = 67.66                      # km/s/Mpc
OMEGA_M = 0.30966
OMEGA_L = 1.0 - OMEGA_M
C_KMS = 299792.458
HUBBLE_TIME_YEARS = 977.8e9 / H0   # 1/H0 in years
LIGHT_YEARS_PER_PARSEC = 3.26156

MIN_PARALLAX_SNR = 5.0     # a parallax must be this many times its error to be trusted
MIN_REDSHIFT = 0.002       # below this, a galaxy's own motion swamps the expansion
UNITS = {"pc": 1.0, "kpc": 1e3, "mpc": 1e6}


def from_parallax(parallax: float | None, error: float | None = None) -> dict | None:
    """Distance from a parallax in milliarcseconds."""
    if not parallax or parallax <= 0:
        return None
    if error is not None and error > 0 and parallax / error < MIN_PARALLAX_SNR:
        return None
    if error is None and parallax < 0.5:
        return None  # too small to trust without knowing its error
    return {"parsecs": 1000.0 / parallax, "method": "parallax"}


def from_redshift(z: float | None) -> dict | None:
    """Distance from a redshift: where the object is now, and how long its light has traveled."""
    if z is None or not math.isfinite(z) or z < MIN_REDSHIFT:
        return None
    # Integrate the expansion history from now back to redshift z.
    grid = np.linspace(0.0, z, 4001)
    expansion = np.sqrt(OMEGA_M * (1.0 + grid) ** 3 + OMEGA_L)
    comoving_mpc = (C_KMS / H0) * np.trapezoid(1.0 / expansion, grid)
    lookback = HUBBLE_TIME_YEARS * np.trapezoid(1.0 / ((1.0 + grid) * expansion), grid)
    return {"parsecs": float(comoving_mpc) * 1e6, "method": "redshift", "lightTravelYears": float(lookback)}


def from_measurement(value, unit) -> dict | None:
    """Distance from a SIMBAD literature value with its unit."""
    try:
        scale = UNITS[str(unit).strip().lower()]
        parsecs = float(value) * scale
    except (KeyError, TypeError, ValueError):
        return None
    return {"parsecs": parsecs, "method": "measured"} if parsecs > 0 else None


async def published(oid: int) -> dict | None:
    """The preferred published distance of a SIMBAD object, if it has one."""
    adql = f"SELECT TOP 1 dist, unit FROM mesDistance WHERE oidref = {int(oid)} ORDER BY mespos"
    for base in SIMBAD_TAP:
        try:
            response = await net.client().get(base, params={"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "json", "QUERY": adql}, timeout=8)
            response.raise_for_status()
            rows = response.json()["data"]
            return from_measurement(rows[0][0], rows[0][1]) if rows else None
        except Exception:  # noqa: BLE001 (try the next mirror)
            continue
    return None


async def best(parallax=None, parallax_error=None, redshift=None, velocity=None, oid=None) -> dict | None:
    """The most trustworthy distance: parallax first, then a published value, then the redshift."""
    found = from_parallax(parallax, parallax_error)
    if found is None and oid is not None:
        found = await published(oid)
    if found is None:
        z = redshift if redshift is not None else (velocity / C_KMS if velocity else None)
        found = from_redshift(z)
    return found
