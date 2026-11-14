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

import httpx
import numpy as np

from . import config
from .fitshdr import parse_header
from .pointing import detector_frame

FILE = re.compile(r"level2_(?P<obsid>[A-Za-z0-9_]+)D(?P<det>[1-6])_spx_(?P<ver>l2b-[A-Za-z0-9\-]+)\.fits$")
HEAD_BYTES = 28800       # primary header plus the IMAGE header
MISSING = 0xFFFF         # version-directory index for a detector with no file
INDEX_PATH = config.CACHE_DIR / "index" / "exposures.npz"
CALIBRATION_SAMPLE = 200  # exposures read on all six detectors to measure the detector angles
CONNECTIONS = 40          # parallel header reads. Kept modest so a home connection stays usable.
BATCH = 20000             # exposures between saves, so an interrupted build can resume

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


async def _read_heads(keys: list[str]) -> list:
    """Fetch and parse the headers of many files over one small, persistent connection pool."""
    out: list = [None] * len(keys)
    todo = iter(range(len(keys)))
    started = time.time()
    done = 0
    limits = httpx.Limits(max_connections=CONNECTIONS, max_keepalive_connections=CONNECTIONS, keepalive_expiry=120)
    async with httpx.AsyncClient(timeout=60, limits=limits, headers={"User-Agent": config.USER_AGENT}) as client:

        async def worker():
            nonlocal done
            for i in todo:
                response = None
                for attempt in range(6):
                    try:
                        response = await client.get(config.S3_BASE + keys[i], headers={"Range": f"bytes=0-{HEAD_BYTES - 1}"})
                        if response.status_code in (200, 206):
                            break
                    except httpx.HTTPError:
                        pass
                    response = None
                    await asyncio.sleep(0.3 * 2**attempt)
                done += 1
                if done % 5000 == 0:
                    print(f"  headers: {done}/{len(keys)} ({done / (time.time() - started):.0f} per second)", flush=True)
                if response is None:
                    continue
                buf = response.content
                primary = parse_header(buf)
                parsed = parse_header(buf[primary[2]:]) if primary else None
                if not parsed:
                    continue
                cards = parsed[0]
                frame, scale = detector_frame(cards)
                out[i] = (
                    float(cards.get("MJD-AVG", 0.0)),
                    frame,
                    scale,
                    1 if str(cards.get("SPS_FLAGS", "")).startswith("deep") else 0,
                )

        await asyncio.gather(*(worker() for _ in range(CONNECTIONS)))
    return out


def read_heads(keys: list[str]) -> list:
    """Read headers for many keys, keeping the input order."""
    return asyncio.run(_read_heads(keys)) if keys else []


def orthonormal(matrix: np.ndarray) -> np.ndarray:
    """Nearest orthogonal matrix. Removes rounding drift after averaging."""
    u, _, vt = np.linalg.svd(matrix)
    return u @ vt


def calibrate(sample: list[tuple[str, str, dict]]):
    """Measure the fixed angles between detectors from exposures that have all six files.

    Returns relative[k] with frame_k = frame_1 @ relative[k], and the scale matrix of each detector.
    Medians are used because a few exposures have a poor astrometric solution on one detector.
    """
    keys = [file_key(release, obsid, det, dets[det]) for release, obsid, dets in sample for det in range(1, 7)]
    heads = read_heads(keys)
    each = []
    scale_samples = []
    for i in range(len(sample)):
        six = heads[i * 6:(i + 1) * 6]
        if any(h is None for h in six):
            continue
        base = six[0][1]
        each.append([base.T @ six[k][1] for k in range(6)])
        scale_samples.append([six[k][2] for k in range(6)])
    each = np.array(each)                      # (exposures, 6, 3, 3)
    relative = np.array([orthonormal(np.median(each[:, k], axis=0)) for k in range(6)])
    scales = np.median(np.array(scale_samples), axis=0)
    # Report how far single exposures stray from the median geometry, in arcseconds of rotation.
    stray = np.abs(each - relative).max(axis=(2, 3)) / (np.pi / 180 / 3600)
    print(f"  detector geometry from {len(each)} exposures. Typical deviation {np.median(stray):.0f} arcsec, largest {stray.max():.0f}", flush=True)
    return relative, scales


def release_rank(release: str) -> tuple[int, int]:
    """Order releases so the best processing of an exposure wins: data releases over quick ones, then newer."""
    match = re.match(r"([a-z]+)(\d*)", release)
    kind, number = (match.group(1), int(match.group(2) or 0)) if match else (release, 0)
    return (1 if kind == "dr" else 0, number)


def active_releases() -> tuple[list[str], bool]:
    """Bucket prefixes of the releases IRSA serves now, and whether IRSA itself confirmed the list.

    IRSA names collections like spherex_dr1 and spherex_qr3_deep. The bucket prefix is the middle part.
    """
    try:
        response = httpx.get(config.IRSA_SIA, params={"MAXREC": 0}, timeout=30, headers={"User-Agent": config.USER_AGENT})
        response.raise_for_status()
        block = re.search(r'name="COLLECTION".*?</PARAM>', response.text, re.S)
        names = re.findall(r'<OPTION[^>]*value="spherex_([a-z]+\d+)(?:_deep)?"', block.group(0)) if block else []
        if names:
            return sorted(set(names), key=release_rank), True
    except httpx.HTTPError:
        pass
    fallback = sorted({name.replace("spherex_", "").replace("_deep", "") for name in config.FALLBACK_COLLECTIONS}, key=release_rank)
    return fallback, False


def build(fresh: bool = False) -> None:
    started = time.time()
    old = None
    if not fresh and INDEX_PATH.exists():
        with np.load(INDEX_PATH, allow_pickle=False) as data:
            old = {name: data[name] for name in data.files}
    releases = [str(v) for v in old["releases"]] if old is not None else []
    versions = [str(v) for v in old["versions"]] if old is not None else []
    done_weeks = {str(v) for v in old["weeks"]} if old is not None else set()
    rows = old["rows"] if old is not None else np.zeros(0, dtype=ROW)

    active, confirmed = active_releases()
    print(f"active releases: {active} ({'from IRSA' if confirmed else 'fallback list'})", flush=True)

    # List the bucket. Finished weeks are skipped, except the newest of each release, which may still grow.
    best: dict[str, tuple[str, dict]] = {}
    new_weeks: list[str] = []
    for release in active:
        skip = {w.split("/", 1)[1] for w in done_weeks if w.startswith(release + "/")}
        skip -= {max(skip)} if skip else set()
        exposures, weeks = asyncio.run(list_release(release, skip))
        new_weeks += [f"{release}/{w}" for w in weeks]
        print(f"{release}: {len(exposures)} exposures listed in {len(weeks)} week folders", flush=True)
        for obsid, dets in exposures.items():
            held = best.get(obsid)
            if held is None or release_rank(release) > release_rank(held[0]):
                best[obsid] = (release, dets)

    # Compare the listing with the rows already held.
    position = {obsid.decode(): i for i, obsid in enumerate(rows["obsid"].tolist())}
    drop = np.zeros(len(rows), dtype=bool)
    if confirmed:
        # A release IRSA no longer serves has been superseded. Its rows go.
        for i, release in enumerate(releases):
            if release not in active:
                drop |= rows["release"] == i
    todo = []
    for obsid, (release, dets) in sorted(best.items()):
        at = position.get(obsid)
        if at is None:
            todo.append((release, obsid, dets))
            continue
        held = releases[rows["release"][at]]
        if held == release:
            # Same release. New detector files may have appeared since the last run.
            for det, version in dets.items():
                if version not in versions:
                    versions.append(version)
                rows["vdir"][at][det - 1] = versions.index(version)
        elif release_rank(release) > release_rank(held):
            drop[at] = True
            todo.append((release, obsid, dets))
    rows = rows[~drop]
    print(f"{len(todo)} new exposures, {int(drop.sum())} dropped", flush=True)

    if old is not None:
        relative, scales = old["relative"], old["scales"]
    else:
        full = [item for item in todo if len(item[2]) == 6]
        step = max(1, len(full) // CALIBRATION_SAMPLE)
        relative, scales = calibrate(full[::step][:CALIBRATION_SAMPLE])

    missed = 0
    for begin in range(0, max(len(todo), 1), BATCH):
        part = todo[begin:begin + BATCH]
        # One header per exposure, from its lowest-numbered detector.
        refs = [min(dets) for _, _, dets in part]
        heads = read_heads([file_key(release, obsid, ref, dets[ref]) for (release, obsid, dets), ref in zip(part, refs)])
        fresh_rows = np.zeros(len(part), dtype=ROW)
        keep = np.zeros(len(part), dtype=bool)
        for i, ((release, obsid, dets), ref, head) in enumerate(zip(part, refs, heads)):
            if head is None:
                continue
            if release not in releases:
                releases.append(release)
            row = fresh_rows[i]
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
        missed += int((~keep).sum())
        rows = np.concatenate([rows, fresh_rows[keep]])
        rows = rows[np.argsort(rows["mjd"], kind="stable")]
        finished = begin + BATCH >= len(todo)
        # Weeks count as done only once every exposure in them was read.
        save(rows, releases, versions, sorted(done_weeks | set(new_weeks)) if finished and not missed else sorted(done_weeks), relative, scales)
        print(f"saved {len(rows)} exposures ({min(begin + BATCH, len(todo))}/{len(todo)} read)", flush=True)

    size = INDEX_PATH.stat().st_size / 1e6
    print(f"Index has {len(rows)} exposures, {size:.1f} MB, updated in {time.time() - started:.0f} s. Missed headers: {missed}", flush=True)


def save(rows, releases, versions, weeks, relative, scales) -> None:
    """Write the index atomically."""
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp = INDEX_PATH.with_name("exposures.tmp.npz")
    np.savez_compressed(
        temp,
        rows=rows,
        releases=np.array(releases),
        versions=np.array(versions),
        weeks=np.array(weeks),
        relative=relative,
        scales=scales,
        built=np.array(time.time()),
    )
    temp.replace(INDEX_PATH)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build or extend the SPHEREx exposure index from the S3 bucket.")
    parser.add_argument("--fresh", action="store_true", help="Ignore any existing index and rebuild")
    build(parser.parse_args().fresh)
