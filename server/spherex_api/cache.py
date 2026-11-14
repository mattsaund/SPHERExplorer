# Small caches: an in-memory LRU and a JSON or NumPy file store under the cache directory.
# Written with Claude Code (Anthropic) assistance.

import hashlib
import json
from collections import OrderedDict
from pathlib import Path

import numpy as np

from . import config


class LRU:
    """Least-recently-used map with a fixed number of entries."""

    def __init__(self, size: int):
        self.size = size
        self.items: OrderedDict = OrderedDict()

    def get(self, key):
        if key in self.items:
            self.items.move_to_end(key)
            return self.items[key]
        return None

    def put(self, key, value):
        self.items[key] = value
        self.items.move_to_end(key)
        while len(self.items) > self.size:
            self.items.popitem(last=False)


def _path(kind: str, name: str, suffix: str) -> Path:
    """File path for a cached item. Names are hashed so any key is a safe file name."""
    digest = hashlib.sha1(name.encode()).hexdigest()
    return config.CACHE_DIR / kind / digest[:2] / f"{digest}{suffix}"


def load_json(kind: str, name: str):
    path = _path(kind, name, ".json")
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def save_json(kind: str, name: str, value) -> None:
    path = _path(kind, name, ".json")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(".tmp")
        temp.write_text(json.dumps(value, separators=(",", ":")))
        temp.replace(path)  # atomic, so a crash never leaves half a file
    except OSError:
        pass  # a read-only or full disk only costs speed


def load_arrays(kind: str, name: str):
    path = _path(kind, name, ".npz")
    try:
        with np.load(path) as data:
            return {key: data[key] for key in data.files}
    except (OSError, ValueError):
        return None


def save_arrays(kind: str, name: str, **arrays) -> None:
    path = _path(kind, name, ".npz")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_name(path.stem + ".tmp.npz")
        np.savez(temp, **arrays)
        temp.replace(path)
    except OSError:
        pass
