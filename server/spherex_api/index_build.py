# Builds the exposure index: one row per SPHEREx exposure with its time and pointing.
# It reads only the public S3 bucket (a listing plus one small header per exposure),
# so search keeps working when the IRSA services are busy or down.
#
#   uv run python -m spherex_api.index_build            build or extend the index
#   uv run python -m spherex_api.index_build --fresh    rebuild from scratch
#
# Written with Claude Code (Anthropic) assistance.

import argparse
import asyncio
import re
import time
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor

import httpx
import numpy as np

from . import config
from .fitshdr import parse_header
from .pointing import detector_frame

FILE = re.compile(r"level2_(?P<obsid>[A-Za-z0-9_]+)D(?P<det>[1-6])_spx_(?P<ver>l2b-[A-Za-z0-9\-]+)\.fits$")
HEAD_BYTES = 28800       # primary header plus the IMAGE header
MISSING = 0xFFFF         # version-directory index for a detector with no file
INDEX_PATH = config.CACHE_DIR / "index" / "exposures.npz"
CALIBRATION_SAMPLE = 240  # exposures read on all six detectors to measure the detector angles
WORKERS = 8
PER_WORKER = 48          # parallel reads in each worker process

ROW = np.dtype([
    ("obsid", "S24"),
    ("release", "u1"),          # index into the releases list
    ("vdir", "u2", (6,)),       # version directory per detector, MISSING when absent
    ("mjd", "f8"),              # exposure midpoint
    ("frame", "f4", (3, 3)),    # pointing frame, expressed for detector 1
    ("deep", "u1"),             # 1 when the exposure belongs to a deep field
    ("ref", "u1"),              # detector whose header gave the pointing
])


async def _list(client: httpx.AsyncClient, prefix: str, delimiter: str = "/"):
    """List one level of the bucket. Returns (sub-prefixes, keys), following continuation pages."""
    prefixes, keys, token = [], [], None
    while True:
        params = {"list-type": "2", "prefix": prefix, "delimiter": delimiter}
        if token:
            params["continuation-token"] = token
        for attempt in range(6):
            try:
                response = await client.get(config.S3_BASE, params=params)
                response.raise_for_status()
                break
            except httpx.HTTPError:
                await asyncio.sleep(0.5 * 2**attempt)
        else:
            raise RuntimeError(f"Listing failed for {prefix}")
        text = response.text
        prefixes += re.findall(r"<CommonPrefixes><Prefix>([^<]+)</Prefix>", text)
        keys += re.findall(r"<Key>([^<]+)</Key>", text)
        match = re.search(r"<NextContinuationToken>([^<]+)</NextContinuationToken>", text)
        if not match:
            return prefixes, keys
        token = match.group(1)


async def list_release(release: str, skip_weeks: set[str]):
    """Every Level 2 file of a release, grouped by exposure: obsid -> {detector: version dir}."""
    exposures: dict[str, dict[int, str]] = defaultdict(dict)
    limits = httpx.Limits(max_connections=64)
    async with httpx.AsyncClient(timeout=60, limits=limits, headers={"User-Agent": config.USER_AGENT}) as client:
        weeks, _ = await _list(client, f"{release}/level2/")
        weeks = [w for w in weeks if w.rstrip("/").rsplit("/", 1)[1] not in skip_weeks]
        gate = asyncio.Semaphore(48)

        async def one_week(week_prefix: str):
            async with gate:
                versions, _ = await _list(client, week_prefix)
            for version_prefix in sorted(versions):  # later processing wins
                async with gate:
                    detector_dirs, _ = await _list(client, version_prefix)
                for detector_dir in detector_dirs:
                    async with gate:
                        _, keys = await _list(client, detector_dir)
                    for key in keys:
                        match = FILE.search(key)
                        if match:
                            exposures[match["obsid"]][int(match["det"])] = match["ver"]

        await asyncio.gather(*(one_week(week) for week in weeks))
    return exposures, [w.rstrip("/").rsplit("/", 1)[1] for w in weeks]


def file_key(release: str, obsid: str, detector: int, version: str) -> str:
    """S3 key of a Level 2 file. The week directory is the first two parts of the obsid."""
    week = "_".join(obsid.split("_")[:2])
    return f"{release}/level2/{week}/{version}/{detector}/level2_{obsid}D{detector}_spx_{version}.fits"


def _read_heads(keys: list[str]) -> list:
    """Worker process: fetch and parse the headers of many files. Returns pointing facts per key."""

    async def run():
        out = [None] * len(keys)
        gate = asyncio.Semaphore(PER_WORKER)
        limits = httpx.Limits(max_connections=PER_WORKER, max_keepalive_connections=PER_WORKER)
        async with httpx.AsyncClient(timeout=60, limits=limits, headers={"User-Agent": config.USER_AGENT}) as client:

            async def one(i: int, key: str):
                async with gate:
                    for attempt in range(6):
                        try:
                            response = await client.get(config.S3_BASE + key, headers={"Range": f"bytes=0-{HEAD_BYTES - 1}"})
                            if response.status_code in (200, 206):
                                break
                        except httpx.HTTPError:
                            pass
                        await asyncio.sleep(0.3 * 2**attempt)
                    else:
                        return
                buf = response.content
                primary = parse_header(buf)
                parsed = parse_header(buf[primary[2]:]) if primary else None
                if not parsed:
                    return
                cards = parsed[0]
                frame, scale = detector_frame(cards)
                out[i] = (
                    float(cards.get("MJD-AVG", 0.0)),
                    frame.astype(np.float64),
                    scale,
                    1 if str(cards.get("SPS_FLAGS", "")).startswith("deep") else 0,
                )

            await asyncio.gather(*(one(i, key) for i, key in enumerate(keys)))
        return out

    return asyncio.run(run())


def read_heads(keys: list[str]) -> list:
    """Read headers for many keys across worker processes, keeping the input order."""
    if not keys:
        return []
    chunk = 2000
    parts = [keys[i:i + chunk] for i in range(0, len(keys), chunk)]
    results: list = []
    started = time.time()
    with ProcessPoolExecutor(WORKERS) as pool:
        for done, part in enumerate(pool.map(_read_heads, parts), 1):
            results.extend(part)
            if done % 10 == 0 or done == len(parts):
                rate = len(results) / (time.time() - started)
                print(f"  headers: {len(results)}/{len(keys)} ({rate:.0f} per second)", flush=True)
    return results


def orthonormal(matrix: np.ndarray) -> np.ndarray:
    """Nearest orthogonal matrix. Removes rounding drift after averaging."""
    u, _, vt = np.linalg.svd(matrix)
    return u @ vt


def calibrate(sample: list[tuple[str, str, dict]]):
    """Measure the fixed angles between detectors from exposures that have all six files.

    Returns relative[k] with frame_k = frame_1 @ relative[k], and the scale matrix of each detector.
    """
    keys = [file_key(release, obsid, det, dets[det]) for release, obsid, dets in sample for det in range(1, 7)]
    heads = read_heads(keys)
    relative = np.zeros((6, 3, 3))
    scales = np.zeros((6, 2, 2))
    used = 0
    spread = []
    for i in range(len(sample)):
        six = heads[i * 6:(i + 1) * 6]
        if any(h is None for h in six):
            continue
        base = six[0][1]
        each = [base.T @ six[k][1] for k in range(6)]
        for k in range(6):
            relative[k] += each[k]
            scales[k] += six[k][2]
        spread.append(each)
        used += 1
    relative = np.array([orthonormal(relative[k] / used) for k in range(6)])
    scales /= used
    # Report how steady the detector angles are across the sample, in arcseconds.
    worst = max(float(np.max(np.abs(np.array(spread)[:, k] - relative[k]))) for k in range(6)) / (np.pi / 180 / 3600)
    print(f"  detector geometry from {used} exposures. Largest deviation {worst:.1f} arcsec", flush=True)
    return relative, scales


def build(fresh: bool = False) -> None:
    started = time.time()
    old = None
    if not fresh and INDEX_PATH.exists():
        with np.load(INDEX_PATH, allow_pickle=False) as data:
            old = {name: data[name] for name in data.files}
    releases = list(old["releases"]) if old is not None else []
    versions = list(old["versions"]) if old is not None else []
    done_weeks = set(old["weeks"]) if old is not None else set()

    # Releases that IRSA currently serves, named like the bucket prefixes.
    active = [name.replace("spherex_", "") for name in config.FALLBACK_COLLECTIONS if not name.endswith("_deep")]
    listing: dict[str, dict] = {}
    new_weeks: list[str] = []
    for release in active:
        # The newest week of each release may still be filling up, so always list it again.
        skip = {w.split("/", 1)[1] for w in done_weeks if w.startswith(release + "/")}
        skip -= {max(skip)} if skip else set()
        exposures, weeks = asyncio.run(list_release(release, skip))
        listing[release] = exposures
        new_weeks += [f"{release}/{w}" for w in weeks]
        print(f"{release}: {len(exposures)} exposures in {len(weeks)} week folders to read", flush=True)

    known = set(old["rows"]["obsid"].tolist()) if old is not None else set()
    todo = [
        (release, obsid, dets)
        for release, exposures in listing.items()
        for obsid, dets in sorted(exposures.items())
        if obsid.encode() not in known
    ]
    print(f"{len(todo)} new exposures", flush=True)

    if old is not None:
        relative, scales = old["relative"], old["scales"]
    else:
        full = [item for item in todo if len(item[2]) == 6]
        step = max(1, len(full) // CALIBRATION_SAMPLE)
        relative, scales = calibrate(full[::step][:CALIBRATION_SAMPLE])

    # One header per exposure, from its lowest-numbered detector.
    refs = [min(dets) for _, _, dets in todo]
    heads = read_heads([file_key(release, obsid, ref, dets[ref]) for (release, obsid, dets), ref in zip(todo, refs)])

    rows = np.zeros(len(todo), dtype=ROW)
    keep = np.zeros(len(todo), dtype=bool)
    for i, ((release, obsid, dets), ref, head) in enumerate(zip(todo, refs, heads)):
        if head is None:
            continue
        if release not in releases:
            releases.append(release)
        row = rows[i]
        row["obsid"] = obsid.encode()
        row["release"] = releases.index(release)
        row["vdir"] = MISSING
        for det, version in dets.items():
            if version not in versions:
                versions.append(version)
            row["vdir"][det - 1] = versions.index(version)
        row["mjd"] = head[0]
        # Express the pointing for detector 1, whichever detector supplied the header.
        row["frame"] = head[1] @ relative[ref - 1].T
        row["deep"] = head[3]
        row["ref"] = ref
        keep[i] = True
    rows = rows[keep]
    if old is not None:
        rows = np.concatenate([old["rows"], rows])
    rows = rows[np.argsort(rows["mjd"], kind="stable")]

    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp = INDEX_PATH.with_name("exposures.tmp.npz")
    np.savez_compressed(
        temp,
        rows=rows,
        releases=np.array(releases),
        versions=np.array(versions),
        weeks=np.array(sorted(done_weeks | set(new_weeks))),
        relative=relative,
        scales=scales,
        built=np.array(time.time()),
    )
    temp.replace(INDEX_PATH)
    size = INDEX_PATH.stat().st_size / 1e6
    print(f"Index has {len(rows)} exposures, {size:.1f} MB, built in {time.time() - started:.0f} s. Missed headers: {int((~keep).sum())}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build or extend the SPHEREx exposure index from the S3 bucket.")
    parser.add_argument("--fresh", action="store_true", help="Ignore any existing index and rebuild")
    build(parser.parse_args().fresh)
