# Packing frames for the stream, and the stream itself. A packed frame must unpack to the
# very bytes it was made from, whatever its size.
# Written with Claude Code (Anthropic) assistance.

import struct
import zlib

import numpy as np
import pytest
from fastapi.testclient import TestClient

from spherex_api import cache
from spherex_api.images import cutout
from spherex_api.main import app


def frame_of(rows: int, cols: int, seed: int = 0) -> bytes:
    """A plain frame like the ones the web app is sent: a float16 image and uint32 flags."""
    rng = np.random.default_rng(seed)
    image = rng.normal(0.3, 0.05, (rows, cols)).astype("<f2")
    image[rng.integers(0, rows, 3), rng.integers(0, cols, 3)] = np.nan
    flags = np.zeros((rows, cols), dtype="<u4")
    flags[rng.integers(0, rows, 9), rng.integers(0, cols, 9)] = 1 << rng.integers(0, 22, 9)
    header = {"v": 1, "key": "k", "ok": True, "nx": cols, "ny": rows, "wl": 1.234}
    return cutout.encode(header, [("image", "f2", image), ("flags", "u4", flags)])


@pytest.mark.parametrize("rows,cols", [(1, 1), (3, 5), (7, 7), (21, 20), (73, 69), (417, 400)])
def test_a_packed_frame_unpacks_to_the_same_bytes(rows, cols):
    frame = frame_of(rows, cols, seed=rows * cols)
    packed = cutout.pack(frame)
    assert packed[:4] == cutout.PACKED and packed != frame
    assert cutout.unpack(packed) == frame
    # The header travels unpacked, so a reader can see what the frame is before unpacking it.
    (length,) = struct.unpack("<I", packed[4:8])
    assert packed[8:8 + length] == frame[8:8 + length]


def test_packing_is_smaller_than_deflating_the_frame_whole():
    frame = frame_of(200, 200, seed=5)
    assert len(cutout.pack(frame)) < len(zlib.compress(frame, 5))


def test_frames_without_the_usual_planes_are_left_as_they_are():
    failed = cutout.failure("k", "nope")
    assert cutout.pack(failed) == failed and cutout.unpack(failed) == failed
    float32 = cutout.encode({"v": 1, "key": "k", "ok": True, "nx": 2, "ny": 2}, [("image", "f4", np.ones((2, 2), "<f4")), ("flags", "u4", np.zeros((2, 2), "<u4"))])
    assert cutout.pack(float32) == float32
    with_sigma = cutout.encode(
        {"v": 1, "key": "k", "ok": True, "nx": 2, "ny": 2},
        [("image", "f2", np.ones((2, 2), "<f2")), ("flags", "u4", np.zeros((2, 2), "<u4")), ("sigma", "f2", np.ones((2, 2), "<f2"))],
    )
    assert cutout.pack(with_sigma) == with_sigma
    # A frame kept deflated whole comes back too.
    assert cutout.unpack(cutout.SQUEEZED + zlib.compress(with_sigma, 1)) == with_sigma


def records(body: bytes) -> list[bytes]:
    """Split a stream body into its records."""
    out = []
    offset = 0
    while offset < len(body):
        (length,) = struct.unpack("<I", body[offset:offset + 4])
        out.append(body[offset + 4:offset + 4 + length])
        offset += 4 + length
    return out


def test_the_stream_sends_packed_frames_as_they_are_and_plain_ones_on_request(monkeypatch):
    plain = {f"dr1/level2/a/b/{i}.fits": frame_of(30, 31, seed=i) for i in range(4)}
    broken = "dr1/level2/a/b/broken.fits"

    async def fake(key, ra, dec, size, phot, sigma_plane, dtype, delta=None):
        if key == broken:
            raise OSError("network down")
        return cutout.pack(plain[key])

    monkeypatch.setattr(cutout, "_make", fake)
    monkeypatch.setattr(cutout, "_frames", cache.ByteLRU(10_000_000))
    request = {"ra": 10, "dec": 20, "size": 300, "frames": [{"key": key} for key in [*plain, broken]]}
    client = TestClient(app)

    packed = client.post("/api/cutouts", json={**request, "pack": True})
    assert packed.status_code == 200 and "content-encoding" not in packed.headers
    got = records(packed.content)
    assert len(got) == 5
    good = [record for record in got if record[:4] == cutout.PACKED]
    assert sorted(cutout.unpack(record) for record in good) == sorted(plain.values())
    # A frame that failed has no pixels to pack, so it comes plain, and says why.
    failed = [record for record in got if record[:4] == cutout.MAGIC]
    assert len(failed) == 1 and cutout.decode(failed[0])[0]["ok"] is False

    # Without the word, the stream is the older one: plain frames, gzip over the whole stream.
    older = client.post("/api/cutouts", json=request)
    assert older.headers["content-encoding"] == "gzip"
    assert sorted(record for record in records(older.content) if cutout.decode(record)[0]["ok"]) == sorted(plain.values())

    # One frame on its own is plain as well.
    key = next(iter(plain))
    one = client.get("/api/cutout", params={"key": key, "ra": 10, "dec": 20})
    assert one.content == plain[key]
