# Small caches: in-memory LRUs and a JSON or NumPy file store under the cache directory.
# Written with Claude Code (Anthropic) assistance.

import hashlib
import json
import os
from collections import OrderedDict
from pathlib import Path

import numpy as np

from . import config


class LRU:
    """Least-recently-used map with a fixed number of entries."""

    # `size` is how many items are kept.
    def __init__(self, size: int):
        self.size = size
        self.items: OrderedDict = OrderedDict()

    # The item, which also becomes the newest. None when it is not kept.
    def get(self, key):
        if key in self.items:
            self.items.move_to_end(key)
            return self.items[key]
        return None

    # Keep an item as the newest, and drop the oldest ones past the limit.
    def put(self, key, value):
        self.items[key] = value
        self.items.move_to_end(key)
        while len(self.items) > self.size:
            self.items.popitem(last=False)


class ByteLRU:
    """Least-recently-used map of byte strings with a ceiling on their total size."""

    # `budget` is how many bytes may be kept in all.
    def __init__(self, budget: int):
        self.budget = budget
        self.items: OrderedDict = OrderedDict()
        self.bytes = 0
        self.hits = 0
        self.misses = 0

    # The bytes, which also become the newest. Counts a hit or a miss.
    def get(self, key) -> bytes | None:
        value = self.items.get(key)
        if value is None:
            self.misses += 1
            return None
        self.items.move_to_end(key)
        self.hits += 1
        return value

    # Keep bytes as the newest, and drop the oldest ones until the total fits the budget.
    def put(self, key, value: bytes) -> None:
        # One item larger than the whole budget is not worth keeping.
        if len(value) > self.budget:
            return
        old = self.items.pop(key, None)
        if old is not None:
            self.bytes -= len(old)
        self.items[key] = value
        self.bytes += len(value)
        while self.bytes > self.budget:
            _, dropped = self.items.popitem(last=False)
            self.bytes -= len(dropped)

    # How full the store is and how often it had the answer, for /api/health.
    def stats(self) -> dict:
        return {"items": len(self.items), "bytes": self.bytes, "budget": self.budget, "hits": self.hits, "misses": self.misses}


# Never pruned: the exposure index is needed to search at all.
KEEP = ("index",)


def prune(budget: int) -> tuple[int, int]:
    """Delete the least recently written cache files until the folder fits in `budget` bytes.

    Returns (bytes kept, files deleted). On Cloud Run the cache folder is held in memory,
    so without a ceiling it would grow until the instance ran out.
    """
    files = []
    total = 0
    for folder, _, names in os.walk(config.CACHE_DIR):
        relative = Path(folder).relative_to(config.CACHE_DIR).parts
        if relative and relative[0] in KEEP:
            continue
        for name in names:
            path = os.path.join(folder, name)
            try:
                status = os.stat(path)
            except OSError:
                continue
            files.append((status.st_mtime, status.st_size, path))
            total += status.st_size
    deleted = 0
    if total > budget:
        files.sort()
        for _, size, path in files:
            # Stop a little under the ceiling so the next sweep is not needed right away.
            if total <= budget * 0.8:
                break
            try:
                os.remove(path)
            except OSError:
                continue
            total -= size
            deleted += 1
    return total, deleted


def _path(kind: str, name: str, suffix: str) -> Path:
    """File path for a cached item. Names are hashed so any key is a safe file name."""
    digest = hashlib.sha1(name.encode()).hexdigest()
    return config.CACHE_DIR / kind / digest[:2] / f"{digest}{suffix}"


# A JSON item kept on disk, or None when it is missing or unreadable.
def load_json(kind: str, name: str):
    path = _path(kind, name, ".json")
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


# Keep a JSON item on disk. A failure to write is ignored.
def save_json(kind: str, name: str, value) -> None:
    path = _path(kind, name, ".json")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(".tmp")
        temp.write_text(json.dumps(value, separators=(",", ":")))
        temp.replace(path)  # atomic, so a crash never leaves half a file
    except OSError:
        pass  # a read-only or full disk only costs speed


# A set of arrays kept on disk, or None when it is missing or unreadable.
def load_arrays(kind: str, name: str):
    path = _path(kind, name, ".npz")
    try:
        with np.load(path) as data:
            return {key: data[key] for key in data.files}
    except (OSError, ValueError):
        return None


# Keep a set of arrays on disk. A failure to write is ignored.
def save_arrays(kind: str, name: str, **arrays) -> None:
    path = _path(kind, name, ".npz")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_name(path.stem + ".tmp.npz")
        np.savez(temp, **arrays)
        temp.replace(path)
    except OSError:
        pass
