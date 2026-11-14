# Search over the exposure index: which SPHEREx images cover a sky position.
# The index holds one pointing per exposure, built from the S3 bucket by index_build.py.
# A search is a few matrix products, so it takes milliseconds and never calls IRSA.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import math
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import numpy as np

from . import config
from .index_build import INDEX_PATH, MISSING, file_key
from .pointing import project, unit_vector

# Detector 1 sits at one end of the focal plane. Detector 3 is 7.7 degrees away,
# so any exposure that can hold the target has its detector 1 center within this radius.
REACH_DEG = 10.5
# The predicted pixel is good to a pixel or two, more for the rare exposure with a poor
# astrometric fit. Keep frames this close to an edge and let the cutout step decide.
EDGE_MARGIN = 12.0


class ExposureIndex:
    def __init__(self, path=INDEX_PATH):
        with np.load(path, allow_pickle=False) as data:
            self.rows = data["rows"]
            self.releases = [str(v) for v in data["releases"]]
            self.versions = [str(v) for v in data["versions"]]
            self.relative = data["relative"].astype(float)
            self.scale_inverse = [np.linalg.inv(s) for s in data["scales"].astype(float)]
            self.sip = data["sip"].astype(float) if "sip" in data.files else [None] * 6
            self.built = float(data["built"])
        self.frames = self.rows["frame"].astype(float)
        self.boresight = np.ascontiguousarray(self.frames[:, :, 2])
        # Collection names as IRSA spells them, for display.
        self.collections = [f"spherex_{name}{suffix}" for name in self.releases for suffix in ("", "_deep")]

    def __len__(self) -> int:
        return len(self.rows)

    def summary(self) -> dict:
        """Facts about the index for the app's status display."""
        newest = float(self.rows["mjd"].max()) if len(self.rows) else None
        return {
            "exposures": len(self.rows),
            "built": datetime.fromtimestamp(self.built, timezone.utc).isoformat(timespec="seconds"),
            "newest": newest,
            "releases": self.releases,
        }

    def find(self, ra: float, dec: float):
        """Images whose detector holds the position. Returns parallel arrays sorted by time."""
        target = unit_vector(ra, dec)
        near = np.flatnonzero(self.boresight @ target > math.cos(math.radians(REACH_DEG)))
        size = config.DETECTOR_SIZE
        picks = []
        for k in range(6):
            frames = self.frames[near] @ self.relative[k]
            x, y, facing = project(frames, self.scale_inverse[k], target, self.sip[k])
            inside = (
                facing
                & (x > -EDGE_MARGIN) & (x < size - 1 + EDGE_MARGIN)
                & (y > -EDGE_MARGIN) & (y < size - 1 + EDGE_MARGIN)
                & (self.rows["vdir"][near, k] != MISSING)
            )
            rows = near[inside]
            picks.append((rows, np.full(rows.size, k + 1), x[inside], y[inside]))
        rows = np.concatenate([p[0] for p in picks])
        detector = np.concatenate([p[1] for p in picks])
        x = np.concatenate([p[2] for p in picks])
        y = np.concatenate([p[3] for p in picks])
        order = np.lexsort((detector, self.rows["mjd"][rows]))
        return rows[order], detector[order], x[order], y[order]

    def key(self, row: int, detector: int) -> str:
        record = self.rows[row]
        return file_key(
            self.releases[record["release"]],
            record["obsid"].decode(),
            detector,
            self.versions[record["vdir"][detector - 1]],
        )


# A deployed server refreshes its copy this often, so it follows the published index.
REFRESH_SECONDS = 12 * 3600

_index: ExposureIndex | None = None
_checked = 0.0
_refreshing: asyncio.Task | None = None


async def _download() -> bool:
    """Fetch a prebuilt index when none is on disk. Returns True on success."""
    if not config.INDEX_URL:
        return False
    try:
        async with httpx.AsyncClient(timeout=120, follow_redirects=True, headers={"User-Agent": config.USER_AGENT}) as client:
            response = await client.get(config.INDEX_URL)
            response.raise_for_status()
        INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
        temp = INDEX_PATH.with_name("exposures.download.npz")
        temp.write_bytes(response.content)
        temp.replace(INDEX_PATH)
        return True
    except (httpx.HTTPError, OSError):
        try:
            INDEX_PATH.touch()  # wait a full interval before trying again
        except OSError:
            pass
        return False


def _seed() -> bool:
    """Start from the copy of the index that ships with the container, if there is one."""
    source = Path(config.INDEX_SEED) if config.INDEX_SEED else None
    if not source or not source.is_file():
        return False
    try:
        INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
        temp = INDEX_PATH.with_name("exposures.seed.npz")
        shutil.copyfile(source, temp)
        # Keep the seed's own age, so an old seed is renewed in the background right away.
        stamp = source.stat().st_mtime
        os.utime(temp, (stamp, stamp))
        temp.replace(INDEX_PATH)
        return True
    except OSError:
        return False


async def get_index() -> ExposureIndex | None:
    """The loaded index, or None when there is none. Picks up a rebuilt file within a minute."""
    global _index, _checked, _refreshing
    now = time.monotonic()
    if now - _checked < 60 and (_index is not None or _checked):
        return _index
    _checked = now
    if not INDEX_PATH.exists() and not _seed() and not await _download():
        return _index
    try:
        modified = INDEX_PATH.stat().st_mtime
        if time.time() - modified > REFRESH_SECONDS and (_refreshing is None or _refreshing.done()):
            # The local copy is old. Fetch the published one in the background and keep serving.
            _refreshing = asyncio.ensure_future(_download())
        if _index is None or modified > getattr(_index, "loaded_from", 0):
            fresh = ExposureIndex()
            fresh.loaded_from = modified
            _index = fresh
    except (OSError, ValueError, KeyError):
        pass  # keep whatever was loaded before
    return _index
