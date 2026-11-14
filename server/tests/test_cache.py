# The frame memory, the cache folder ceiling, and shared frame builds.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import os

from spherex_api import cache, config, cutout


def test_byte_lru_keeps_the_most_recent_items_within_its_budget():
    lru = cache.ByteLRU(100)
    lru.put("a", b"x" * 40)
    lru.put("b", b"x" * 40)
    assert lru.get("a") == b"x" * 40          # "a" is now the most recently used
    lru.put("c", b"x" * 40)                   # over budget, so the oldest ("b") goes
    assert lru.get("b") is None
    assert lru.get("a") is not None and lru.get("c") is not None
    assert lru.bytes == 80
    lru.put("a", b"y" * 10)                   # replacing an item corrects the total
    assert lru.bytes == 50
    lru.put("huge", b"z" * 500)               # larger than the whole budget: not kept
    assert lru.get("huge") is None and lru.bytes == 50
    stats = lru.stats()
    assert stats["items"] == 2 and stats["hits"] == 3 and stats["misses"] == 2


def test_prune_deletes_the_oldest_files_and_spares_the_index(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "CACHE_DIR", tmp_path)
    for i in range(10):
        path = tmp_path / "layout" / f"{i}.json"
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(b"x" * 1000)
        os.utime(path, (1000 + i, 1000 + i))   # file 0 is the oldest
    index = tmp_path / "index" / "exposures.npz"
    index.parent.mkdir()
    index.write_bytes(b"x" * 50_000)
    os.utime(index, (1, 1))

    assert cache.prune(20_000) == (10_000, 0)   # under the ceiling: nothing happens
    kept, deleted = cache.prune(5000)
    assert kept <= 4000 and deleted == 6        # trimmed to 80 percent of the ceiling
    assert not (tmp_path / "layout" / "0.json").exists()
    assert (tmp_path / "layout" / "9.json").exists()
    assert index.exists()


async def test_a_frame_is_built_once_and_then_served_from_memory(monkeypatch):
    calls = []

    async def fake(key, ra, dec, size, phot, sigma_plane, dtype, delta=None):
        calls.append(key)
        await asyncio.sleep(0.01)
        if key == "broken":
            raise OSError("network down")
        return cutout.encode({"v": 1, "key": key, "ok": True})

    monkeypatch.setattr(cutout, "_make", fake)
    monkeypatch.setattr(cutout, "_frames", cache.ByteLRU(1_000_000))

    # Two viewers ask for the same frame at once. One build serves both.
    first, second = await asyncio.gather(cutout.make_cutout("a", 10, 20, 300), cutout.make_cutout("a", 10, 20, 300))
    assert first == second and calls == ["a"]
    # Later requests come from memory.
    assert await cutout.make_cutout("a", 10, 20, 300) == first
    assert calls == ["a"]
    # Any change to what is asked for is a different frame.
    await cutout.make_cutout("a", 10, 20, 600)
    await cutout.make_cutout("a", 10, 20, 300, phot=(10.001, 20))
    assert calls == ["a", "a", "a"]
    # A failure is reported but not remembered, so the next request tries again.
    header, _ = cutout.decode(await cutout.make_cutout("broken", 1, 2, 300))
    assert header["ok"] is False and "network down" in header["error"]
    await cutout.make_cutout("broken", 1, 2, 300)
    assert calls.count("broken") == 2
    assert cutout.cache_stats()["items"] == 3 and cutout.cache_stats()["building"] == 0


async def test_a_viewer_leaving_does_not_cancel_a_shared_build(monkeypatch):
    started = asyncio.Event()

    async def slow(key, ra, dec, size, phot, sigma_plane, dtype, delta=None):
        started.set()
        await asyncio.sleep(0.05)
        return cutout.encode({"v": 1, "key": key, "ok": True})

    monkeypatch.setattr(cutout, "_make", slow)
    monkeypatch.setattr(cutout, "_frames", cache.ByteLRU(1_000_000))
    leaver = asyncio.ensure_future(cutout.make_cutout("a", 10, 20, 300))
    stayer = asyncio.ensure_future(cutout.make_cutout("a", 10, 20, 300))
    await started.wait()
    leaver.cancel()
    header, _ = cutout.decode(await stayer)
    assert header["ok"] is True
    assert leaver.cancelled()
