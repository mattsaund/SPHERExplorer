# Finds every SPHEREx image that covers a sky position, through IRSA Simple Image Access v2.
# The list of collections comes from IRSA itself, so new data releases appear without a code change.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import csv
import io
import re
import time

import numpy as np
from astropy.coordinates import get_body_barycentric
from astropy.time import Time

from . import calib, config, net
from .instrument import channel_index
from .layout import get_layout
from .wcs import D2R, gnomonic

COLLECTION_TTL = 3600.0   # seconds between reads of the IRSA collection list
SEARCH_TTL = 600.0        # seconds a search result is reused
S3_PREFIX = "/ibe/data/spherex/"

_collections: tuple[float, list[str]] | None = None
_searches: dict[tuple, tuple[float, dict]] = {}


async def collections() -> list[str]:
    """Names of the live SPHEREx image collections, from the SIA self-description."""
    global _collections
    now = time.monotonic()
    if _collections and now - _collections[0] < COLLECTION_TTL:
        return _collections[1]
    names: list[str] = []
    try:
        response = await net.client().get(config.IRSA_SIA, params={"MAXREC": 0}, timeout=20)
        response.raise_for_status()
        block = re.search(r'name="COLLECTION".*?</PARAM>', response.text, re.S)
        if block:
            found = re.findall(r'<OPTION[^>]*value="([^"]+)"', block.group(0))
            # Image collections only. The all-sky cube is a different product.
            names = sorted(n for n in found if n.startswith("spherex_") and not n.endswith("_cube"))
    except Exception:  # noqa: BLE001 (fall back below)
        names = []
    if not names:
        # IRSA unreachable. Keep the last good list, or the built-in one.
        names = _collections[1] if _collections else list(config.FALLBACK_COLLECTIONS)
        _collections = (now - COLLECTION_TTL + 60.0, names)  # try again in a minute
        return names
    _collections = (now, names)
    return names


async def _query(collection: str, ra: float, dec: float, radius: float) -> list[dict]:
    """One SIA query. Returns rows as dicts with only the columns we use."""
    params = {
        "COLLECTION": collection,
        "POS": f"CIRCLE {ra:.7f} {dec:.7f} {radius:.6f}",
        "RESPONSEFORMAT": "csv",
        "MAXREC": 100000,
    }
    last: Exception | None = None
    for attempt in range(3):
        try:
            response = await net.client().get(config.IRSA_SIA, params=params, timeout=60)
            response.raise_for_status()
            break
        except Exception as error:  # noqa: BLE001
            last = error
            await asyncio.sleep(0.5 * (attempt + 1))
    else:
        raise net.UpstreamError(f"IRSA search failed for {collection}: {last}")

    reader = csv.reader(io.StringIO(response.text))
    header = next(reader, None)
    if not header:
        return []
    # The cloud_access column holds unquoted JSON with commas, so only columns before it are safe.
    index = {name: header.index(name) for name in ("obs_id", "energy_bandpassname", "access_url", "s_region", "t_min", "t_max")}
    rows = []
    for row in reader:
        if len(row) <= max(index.values()):
            continue
        rows.append({name: row[position] for name, position in index.items()} | {"collection": collection})
    return rows


def _estimate_pixels(rows: list[dict], ra: float, dec: float):
    """Estimate where the target falls on each detector from the footprint corners alone.

    The footprint lists the outer corners in the order (0,0), (nx,0), (nx,ny), (0,ny).
    A plane fit through the four corners is good to a few pixels, which is plenty for
    a wavelength estimate (one channel spans about 120 pixels).
    """
    n = config.DETECTOR_SIZE
    corners_px = np.array([[-0.5, -0.5], [n - 0.5, -0.5], [n - 0.5, n - 0.5], [-0.5, n - 0.5]])
    sky = np.empty((len(rows), 4, 2))
    for i, row in enumerate(rows):
        numbers = [float(v) for v in row["s_region"].split()[2:10]]
        sky[i] = np.array(numbers).reshape(4, 2)
    xi, eta = gnomonic(sky[:, :, 0] * D2R, sky[:, :, 1] * D2R, ra * D2R, dec * D2R)
    design = np.stack([np.ones_like(xi), xi, eta], axis=-1)            # (rows, 4, 3)
    normal = np.einsum("nki,nkj->nij", design, design)
    xy = np.empty((len(rows), 2))
    for axis in range(2):
        rhs = np.einsum("nki,k->ni", design, corners_px[:, axis])
        # The target sits at the origin of the tangent plane, so its pixel is the constant term.
        xy[:, axis] = np.linalg.solve(normal, rhs[..., None])[:, 0, 0]
    return xy[:, 0], xy[:, 1]


async def _wave_grids(rows: list[dict], detectors: np.ndarray) -> dict:
    """A wavelength grid per detector, opening one file per detector if none is cached yet."""
    grids = {}
    missing = {}
    for detector in np.unique(detectors):
        grid = calib.any_wave_grid(int(detector))
        if grid is None:
            missing[int(detector)] = rows[int(np.flatnonzero(detectors == detector)[0])]["key"]
        else:
            grids[int(detector)] = grid

    async def load(key):
        return await calib.wave_grid(await get_layout(key))

    loaded = await asyncio.gather(*(load(key) for key in missing.values()), return_exceptions=True)
    for detector, grid in zip(missing, loaded):
        if not isinstance(grid, Exception):
            grids[detector] = grid
    return grids


def _parallax_factors(mjd: np.ndarray, ra: float, dec: float):
    """Sky shift in arcseconds per arcsecond of parallax, east and north, at each time."""
    earth = get_body_barycentric("earth", Time(mjd, format="mjd", scale="utc"))
    ex, ey, ez = (earth.x.to_value("au"), earth.y.to_value("au"), earth.z.to_value("au"))
    a, d = ra * D2R, dec * D2R
    east = ex * np.sin(a) - ey * np.cos(a)
    north = ex * np.cos(a) * np.sin(d) + ey * np.sin(a) * np.sin(d) - ez * np.cos(d)
    return east, north


def _rounded(values: np.ndarray, places: int) -> list:
    """Round for the wire and turn NaN into null."""
    return [None if not np.isfinite(v) else round(float(v), places) for v in values]


async def search_index(index, ra: float, dec: float) -> dict:
    """Search with the exposure index. Same result shape as the IRSA search."""
    rows, detectors, x, y = index.find(ra, dec)
    keys = [index.key(int(row), int(det)) for row, det in zip(rows, detectors)]
    records = index.rows[rows]
    mjd = records["mjd"]
    size = config.DETECTOR_SIZE

    grids = await _wave_grids([{"key": key} for key in keys], detectors) if len(keys) else {}
    wavelength = np.full(len(keys), np.nan)
    bandwidth = np.full(len(keys), np.nan)
    for detector, grid in grids.items():
        pick = detectors == detector
        wavelength[pick], bandwidth[pick] = grid.at(np.clip(x[pick], 0, size - 1), np.clip(y[pick], 0, size - 1))
    channel = np.where(np.isfinite(wavelength), channel_index(detectors, np.nan_to_num(wavelength)), -1) if len(keys) else np.zeros(0, int)
    pf_ra, pf_dec = _parallax_factors(mjd, ra, dec) if len(keys) else (np.zeros(0), np.zeros(0))

    return {
        "ra": ra,
        "dec": dec,
        "source": "index",
        "collections": index.collections,
        "errors": [],
        "count": len(keys),
        "frames": {
            "key": keys,
            "coll": (records["release"].astype(int) * 2 + records["deep"].astype(int)).tolist(),
            "obsid": [value.decode() for value in records["obsid"]],
            "det": detectors.tolist(),
            "mjd": np.round(mjd, 6).tolist(),
            "x": np.round(x, 1).tolist(),
            "y": np.round(y, 1).tolist(),
            "wl": _rounded(wavelength, 5),
            "bw": _rounded(bandwidth, 5),
            "chan": channel.tolist(),
            "pfra": np.round(pf_ra, 5).tolist(),
            "pfdec": np.round(pf_dec, 5).tolist(),
        },
    }


async def search_moving(index, path) -> dict:
    """Every image that caught a moving body, with the body's position at each exposure."""
    from .solarsystem import find_moving  # imported here to keep module load order simple

    rows, detectors, x, y, ra, dec, delta, r, mag = find_moving(index, path)
    keys = [index.key(int(row), int(det)) for row, det in zip(rows, detectors)]
    records = index.rows[rows]
    size = config.DETECTOR_SIZE
    grids = await _wave_grids([{"key": key} for key in keys], detectors) if len(keys) else {}
    wavelength = np.full(len(keys), np.nan)
    bandwidth = np.full(len(keys), np.nan)
    for detector, grid in grids.items():
        pick = detectors == detector
        wavelength[pick], bandwidth[pick] = grid.at(np.clip(x[pick], 0, size - 1), np.clip(y[pick], 0, size - 1))
    channel = np.where(np.isfinite(wavelength), channel_index(detectors, np.nan_to_num(wavelength)), -1) if len(keys) else np.zeros(0, int)
    zeros = np.zeros(len(keys)).tolist()
    return {
        "source": "index",
        "collections": index.collections,
        "errors": [],
        "count": len(keys),
        "frames": {
            "key": keys,
            "coll": (records["release"].astype(int) * 2 + records["deep"].astype(int)).tolist(),
            "obsid": [value.decode() for value in records["obsid"]],
            "det": detectors.tolist(),
            "mjd": np.round(records["mjd"], 6).tolist(),
            "x": np.round(x, 1).tolist(),
            "y": np.round(y, 1).tolist(),
            "wl": _rounded(wavelength, 5),
            "bw": _rounded(bandwidth, 5),
            "chan": channel.tolist(),
            "pfra": zeros,
            "pfdec": zeros,
            # Where the body was at each exposure, seen from the center of the Earth.
            "ra": np.round(ra, 6).tolist(),
            "dec": np.round(dec, 6).tolist(),
            "delta": np.round(delta, 6).tolist(),
            "r": np.round(r, 5).tolist(),
            "mag": _rounded(mag, 2),
        },
    }


async def search(ra: float, dec: float, radius: float = 0.001) -> dict:
    """All SPHEREx images covering (ra, dec), time-ordered, in a compact columnar form.

    Uses the exposure index when one is loaded. Falls back to IRSA SIA otherwise.
    """
    from .exposures import get_index  # imported here to keep module load order simple

    index = await get_index()
    if index is not None:
        return await search_index(index, ra, dec)

    token = (round(ra, 6), round(dec, 6), round(radius, 5))
    now = time.monotonic()
    hit = _searches.get(token)
    if hit and now - hit[0] < SEARCH_TTL:
        return hit[1]

    names = await collections()
    batches = await asyncio.gather(*(_query(name, ra, dec, radius) for name in names), return_exceptions=True)
    rows: list[dict] = []
    errors = []
    for name, batch in zip(names, batches):
        if isinstance(batch, Exception):
            errors.append(f"{name}: {batch}")
        else:
            rows.extend(batch)
    if errors and not rows:
        raise net.UpstreamError("; ".join(errors))

    # One row per observation and detector. Data releases sort before quick releases.
    unique: dict[tuple, dict] = {}
    for row in sorted(rows, key=lambda r: r["collection"]):
        url = row["access_url"]
        if S3_PREFIX not in url:
            continue
        row["key"] = url.split(S3_PREFIX, 1)[1]
        row["det"] = int(row["energy_bandpassname"].rsplit("D", 1)[1])
        unique.setdefault((row["obs_id"], row["det"]), row)
    rows = sorted(unique.values(), key=lambda r: float(r["t_min"]))

    result = {
        "ra": ra,
        "dec": dec,
        "source": "irsa",
        "collections": names,
        "errors": errors,
        "count": 0,
        "frames": {name: [] for name in ("key", "coll", "obsid", "det", "mjd", "x", "y", "wl", "bw", "chan", "pfra", "pfdec")},
    }
    if rows:
        detectors = np.array([row["det"] for row in rows])
        mjd = np.array([(float(row["t_min"]) + float(row["t_max"])) / 2.0 for row in rows])
        x, y = _estimate_pixels(rows, ra, dec)
        size = config.DETECTOR_SIZE
        inside = (x >= -0.5) & (x < size - 0.5) & (y >= -0.5) & (y < size - 0.5)

        grids = await _wave_grids(rows, detectors)
        wavelength = np.full(len(rows), np.nan)
        bandwidth = np.full(len(rows), np.nan)
        for detector, grid in grids.items():
            pick = detectors == detector
            wavelength[pick], bandwidth[pick] = grid.at(np.clip(x[pick], 0, size - 1), np.clip(y[pick], 0, size - 1))
        channel = np.where(np.isfinite(wavelength), channel_index(detectors, np.nan_to_num(wavelength)), -1)

        pf_ra, pf_dec = _parallax_factors(mjd, ra, dec)

        keep = np.flatnonzero(inside)
        frames = result["frames"]
        frames["key"] = [rows[i]["key"] for i in keep]
        frames["coll"] = [names.index(rows[i]["collection"]) for i in keep]
        frames["obsid"] = [rows[i]["obs_id"] for i in keep]
        frames["det"] = detectors[keep].tolist()
        frames["mjd"] = np.round(mjd[keep], 6).tolist()
        frames["x"] = np.round(x[keep], 1).tolist()
        frames["y"] = np.round(y[keep], 1).tolist()
        frames["wl"] = _rounded(wavelength[keep], 5)
        frames["bw"] = _rounded(bandwidth[keep], 5)
        frames["chan"] = channel[keep].tolist()
        frames["pfra"] = np.round(pf_ra[keep], 5).tolist()
        frames["pfdec"] = np.round(pf_dec[keep], 5).tolist()
        result["count"] = int(keep.size)

    if not errors:
        _searches[token] = (now, result)
    if len(_searches) > 500:
        # Drop the oldest entries.
        for old in sorted(_searches, key=lambda k: _searches[k][0])[:100]:
            _searches.pop(old, None)
    return result
