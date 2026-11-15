# Builds one frame: a small crop of a Level 2 image around a sky position, with flags,
# wavelength, a pixel-to-sky transform, and forced photometry. Pixels stay in detector geometry.
#
# The work is split in two. Whatever waits on the archive runs on the event loop. Whatever
# only computes (decoding the flags, statistics, photometry, packing) runs on a worker thread,
# so the loop keeps reading and every processor works on one target.
#
# A finished frame is packed once, kept in that form, and sent in that form. A frame that was
# opened before then costs nothing to send again.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import json
import math
import os
import struct
import zlib
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from astropy.io.fits.hdu.compressed._compression import decompress_rice_1_c

from . import calib, config, net, photometry
from .cache import ByteLRU
from .instrument import BAD_MASK, channel_index
from .layout import FileInfo, flags_table, get_head, get_layout
from .solarsystem import topocentric

MAGIC = b"SPXF"      # a plain frame: header, then the planes as they are
PACKED = b"SPXZ"     # a packed frame, the form the web app is sent
SQUEEZED = b"SPXC"   # a plain frame deflated whole, for the kinds the web app never asks for
FORMAT_VERSION = 1
MIN_HALF = 10        # pixels. Keeps room for the photometry sky ring.
MAX_HALF = 320       # pixels. About 1.1 degrees across.
VARIANCE_HALF = 4    # rows of variance read around the photometry position
F16_LIMIT = 65000.0  # float16 tops out near 65504

# Finished frames, packed. Level 2 files never change, so a frame built once stays right.
_frames = ByteLRU(config.FRAME_CACHE_MB * 1_000_000)
# Frames being built now, so two viewers asking for the same frame share one build.
_building: dict[tuple, asyncio.Future] = {}
# The threads that compute frames. One per processor: more would only take turns.
_workers = ThreadPoolExecutor(max_workers=max(2, min(8, os.cpu_count() or 2)), thread_name_prefix="frame")
# A plain frame this small is kept as it is. Packing it would save nothing.
SMALL_FRAME = 4096


def _clean(value):
    """JSON has no NaN or infinity. Send null for them."""
    if value is None:
        return None
    value = float(value)
    return value if math.isfinite(value) else None


def encode(header: dict, planes=()) -> bytes:
    """Pack a frame: magic, header length, JSON header, then raw planes padded to 4 bytes."""
    listing = []
    blobs = []
    for name, dtype, array in planes:
        raw = array.tobytes()
        listing.append({"name": name, "dtype": dtype, "bytes": len(raw)})
        blobs.append(raw + b"\0" * (-len(raw) % 4))
    header["planes"] = listing
    text = json.dumps(header, separators=(",", ":"), allow_nan=False).encode()
    text += b" " * (-len(text) % 4)
    return MAGIC + struct.pack("<I", len(text)) + text + b"".join(blobs)


def pack(frame: bytes) -> bytes:
    """Pack a plain frame into the form the web app is sent. The reverse is unpack.

    A float16 image is half noise. Its low bytes do not compress at all, and its high bytes
    and the flags compress well once each byte position is gathered together. So the high
    bytes and the flags are deflated, and the low bytes are sent as they are. That is smaller
    than deflating the frame whole, and several times cheaper.

    Layout: "SPXZ", header length, header, pixel count, deflated length, the deflated high
    bytes and flags, then the low bytes. A frame without the usual planes is returned unchanged.
    """
    (length,) = struct.unpack("<I", frame[4:8])
    head = frame[8:8 + length]
    planes = json.loads(head).get("planes", [])
    if [(plane["name"], plane["dtype"]) for plane in planes] != [("image", "f2"), ("flags", "u4")]:
        return frame
    count = planes[0]["bytes"] // 2
    if planes[1]["bytes"] != 4 * count:
        return frame
    offset = 8 + length
    image = np.frombuffer(frame, dtype=np.uint8, count=2 * count, offset=offset).reshape(count, 2)
    offset += 2 * count + (-2 * count % 4)
    flags = np.frombuffer(frame, dtype=np.uint8, count=4 * count, offset=offset).reshape(count, 4)
    # Level 1 is the fastest, and on these bytes the higher levels gain only a few percent.
    squeezed = zlib.compress(image[:, 1].tobytes() + flags.T.tobytes(), 1)
    return b"".join((PACKED, frame[4:8], head, struct.pack("<II", count, len(squeezed)), squeezed, image[:, 0].tobytes()))


def unpack(record: bytes) -> bytes:
    """The plain frame inside a record from the frame memory, whatever form it was kept in."""
    kind = record[:4]
    if kind == MAGIC:
        return record
    if kind == SQUEEZED:
        return zlib.decompress(record[4:])
    (length,) = struct.unpack("<I", record[4:8])
    head = record[8:8 + length]
    count, size = struct.unpack("<II", record[8 + length:16 + length])
    start = 16 + length
    plain = zlib.decompress(record[start:start + size])
    image = np.empty((count, 2), dtype=np.uint8)
    image[:, 0] = np.frombuffer(record, dtype=np.uint8, count=count, offset=start + size)
    image[:, 1] = np.frombuffer(plain, dtype=np.uint8, count=count)
    flags = np.frombuffer(plain, dtype=np.uint8, count=4 * count, offset=count).reshape(4, count).T
    return b"".join((MAGIC, record[4:8], head, image.tobytes(), b"\0" * (-2 * count % 4), flags.tobytes()))


def failure(key: str, reason: str, code: str = "error") -> bytes:
    """A frame that could not be built. The stream carries on.

    code is "outside" when the position simply is not on this detector, "error" for real failures.
    """
    return encode({"v": FORMAT_VERSION, "key": key, "ok": False, "error": reason, "code": code})


def rows_array(buf: bytes, nx: int, x0: int, x1: int) -> np.ndarray:
    """Whole rows of a float32 image extension, as read from the file, cut to columns [x0, x1)."""
    return np.frombuffer(buf, dtype=">f4").reshape(-1, nx)[:, x0:x1].astype(np.float32)


async def read_rows(key: str, data_off: int, nx: int, y0: int, y1: int, x0: int, x1: int) -> np.ndarray:
    """Read rows [y0, y1) of a float32 image extension and keep columns [x0, x1)."""
    row_bytes = nx * 4
    return rows_array(await net.s3_bytes(key, data_off + y0 * row_bytes, data_off + y1 * row_bytes), nx, x0, x1)


async def read_flag_rows(info: FileInfo, y0: int, y1: int):
    """Read the compressed rows [y0, y1) of the FLAGS extension. Returns (lengths, offsets, start, heap).

    The row descriptors come from memory when the file was mapped a moment ago. Then this is one read.
    """
    table = flags_table(info.key)
    if table is not None:
        rows = table[y0:y1]
    else:
        size = info.flags_desc
        buf = await net.s3_bytes(info.key, info.flags_table_off + y0 * size, info.flags_table_off + y1 * size)
        rows = np.frombuffer(buf, dtype=">i4" if size == 8 else ">i8").reshape(-1, 2).astype(np.int64)
    lengths = rows[:, 0]
    offsets = rows[:, 1]
    start = int(offsets.min())
    end = int((offsets + lengths).max())
    heap = await net.s3_bytes(info.key, info.flags_heap_off + start, info.flags_heap_off + end)
    return lengths, offsets, start, heap


def flags_array(rows, info: FileInfo, x0: int, x1: int) -> np.ndarray:
    """Decompress FLAGS rows read by read_flag_rows and keep columns [x0, x1)."""
    lengths, offsets, start, heap = rows
    block, bytepix = info.flags_rice
    out = np.empty((len(lengths), x1 - x0), dtype=np.int32)
    for row in range(len(lengths)):
        begin = int(offsets[row]) - start
        tile = decompress_rice_1_c(heap[begin:begin + int(lengths[row])], block, bytepix, info.nx)
        out[row] = np.frombuffer(tile, dtype=f"i{bytepix}")[x0:x1]
    return out


async def read_flags(info: FileInfo, y0: int, y1: int, x0: int, x1: int) -> np.ndarray:
    """Read and decompress rows [y0, y1) of the RICE-compressed FLAGS extension."""
    return flags_array(await read_flag_rows(info, y0, y1), info, x0, x1)


def _window(info: FileInfo, x: float, y: float, matrix, size: float):
    """Pixel window that covers a north-up square of `size` arcseconds centered on (x, y)."""
    (a, b), (c, d) = matrix
    det = a * d - b * c
    # Invert the pixel-to-sky matrix to see how far the square's corners reach in pixels.
    half = size / 2.0
    reach_x = (abs(d) + abs(b)) * half / abs(det)
    reach_y = (abs(c) + abs(a)) * half / abs(det)
    half_x = int(min(MAX_HALF, max(MIN_HALF, math.ceil(reach_x) + 1)))
    half_y = int(min(MAX_HALF, max(MIN_HALF, math.ceil(reach_y) + 1)))
    x0 = max(0, int(round(x)) - half_x)
    x1 = min(info.nx, int(round(x)) + half_x + 1)
    y0 = max(0, int(round(y)) - half_y)
    y1 = min(info.ny, int(round(y)) + half_y + 1)
    return x0, x1, y0, y1


def _name(key, ra, dec, size, phot, sigma_plane, dtype, delta) -> tuple:
    """What tells one frame from another in the frame memory."""
    return (
        key, round(ra, 7), round(dec, 7), round(size, 2),
        None if phot is None else (round(phot[0], 7), round(phot[1], 7)),
        sigma_plane, dtype, None if delta is None else round(delta, 9),
    )


async def _record(key, ra, dec, size, phot, sigma_plane, dtype, delta) -> bytes:
    """The frame as the frame memory keeps it. Built once, however many viewers ask at the same time."""
    name = _name(key, ra, dec, size, phot, sigma_plane, dtype, delta)
    stored = _frames.get(name)
    if stored is not None:
        return stored
    running = _building.get(name)
    if running is None:
        running = asyncio.ensure_future(_build(name, key, ra, dec, size, phot, sigma_plane, dtype, delta))
        _building[name] = running
        running.add_done_callback(lambda _: _building.pop(name, None))
    # Shielded, so one viewer leaving does not cancel a build another viewer is waiting for.
    return await asyncio.shield(running)


async def make_cutout(
    key: str,
    ra: float,
    dec: float,
    size: float,
    *,
    phot: tuple[float, float] | None = None,
    sigma_plane: bool = False,
    dtype: str = "f2",
    delta: float | None = None,
) -> bytes:
    """Build one frame and return it plain. Never raises. A failed frame is encoded with ok=false.

    delta is the distance in au of a solar system body at (ra, dec) as seen from the center of
    the Earth. When given, the position is shifted to what the spacecraft saw.
    """
    return unpack(await _record(key, ra, dec, size, phot, sigma_plane, dtype, delta))


async def make_packed(
    key: str,
    ra: float,
    dec: float,
    size: float,
    *,
    phot: tuple[float, float] | None = None,
    delta: float | None = None,
) -> bytes:
    """Build one frame and return it packed, as the web app's stream sends it. Never raises.

    The answer starts with "SPXZ" for a packed frame, or "SPXF" for a failed one, which has no pixels to pack.
    """
    record = await _record(key, ra, dec, size, phot, False, "f2", delta)
    return unpack(record) if record[:4] == SQUEEZED else record


async def _build(name: tuple, key, ra, dec, size, phot, sigma_plane, dtype, delta) -> bytes:
    """Build one frame and remember it. A failure is returned but not remembered, since it may pass."""
    try:
        frame = await _make(key, ra, dec, size, phot, sigma_plane, dtype, delta)
    except asyncio.CancelledError:
        raise
    except Exception as error:  # noqa: BLE001 (one bad file must not stop a stream)
        return failure(key, f"{type(error).__name__}: {error}")
    if frame[:4] == MAGIC and len(frame) > SMALL_FRAME:
        # A kind the web app does not stream: a sigma plane, or float32. Deflate it whole.
        frame = SQUEEZED + await asyncio.get_running_loop().run_in_executor(_workers, zlib.compress, frame, 1)
    _frames.put(name, frame)
    return frame


def cache_stats() -> dict:
    """How full the frame memory is and how often it answered."""
    return {**_frames.stats(), "building": len(_building)}


async def _make(key, ra, dec, size, phot, sigma_plane, dtype, delta=None) -> bytes:
    """Do the work of one frame. Returns it packed when it is the usual kind, and plain otherwise.

    The reads wait on the event loop. The computing is handed to a worker thread.
    """
    parts = await _collect(key, ra, dec, size, phot, sigma_plane, delta)
    if isinstance(parts, bytes):
        return parts  # the position is not on this detector
    return await asyncio.get_running_loop().run_in_executor(_workers, _assemble, parts, sigma_plane, dtype)


async def _collect(key, ra, dec, size, phot, sigma_plane, delta):
    """Find the pixel window and read everything a frame needs from the archive.

    Returns what _assemble needs, or a failure frame when the position is off the detector.
    Nothing here computes on pixels, so the event loop is only held for moments.
    """
    head = await get_head(key)
    wcs = head.wcs
    if delta:
        spacecraft = [head.cards.get(name) for name in ("X_SC", "Y_SC", "Z_SC")]
        if all(value is not None for value in spacecraft):
            ra, dec = topocentric(ra, dec, delta, spacecraft)
    x, y = (float(v) for v in wcs.sky2pix(ra, dec))
    if not (-0.5 <= x < head.nx - 0.5 and -0.5 <= y < head.ny - 0.5):
        return failure(key, "The position is off this detector", "outside")

    matrix = wcs.local_matrix(x, y, ra, dec, span=max(4.0, size / 2.0 / config.PIXEL_SCALE))
    x0, x1, y0, y1 = _window(head, x, y, matrix, size)
    row_bytes = head.nx * 4

    # The image rows can start downloading while the rest of the file is being mapped.
    image_task = asyncio.ensure_future(net.s3_bytes(key, head.image_off + y0 * row_bytes, head.image_off + y1 * row_bytes))
    try:
        info = await get_layout(key)

        # Photometry position. Defaults to the frame center.
        px, py = (x, y) if phot is None else (float(v) for v in wcs.sky2pix(phot[0], phot[1]))
        phot_inside = x0 <= px < x1 and y0 <= py < y1

        tasks = [calib.wave_grid(info), read_flag_rows(info, y0, y1) if info.flags_ok else _nothing()]
        if sigma_plane:
            v0, v1 = y0, y1
        else:
            v0 = max(y0, int(round(py)) - VARIANCE_HALF)
            v1 = min(y1, int(round(py)) + VARIANCE_HALF + 1)
        need_variance = (sigma_plane or phot_inside) and v1 > v0
        if need_variance:
            tasks.append(net.s3_bytes(key, info.var_off + v0 * row_bytes, info.var_off + v1 * row_bytes))
            tasks.append(calib.epsf(info))
        results = await asyncio.gather(*tasks)
        image_rows = await image_task
    except BaseException:
        image_task.cancel()
        raise
    return {
        "key": key, "ra": ra, "dec": dec, "x": x, "y": y, "px": px, "py": py, "phot_inside": phot_inside,
        "matrix": matrix, "window": (x0, x1, y0, y1), "info": info, "grid": results[0],
        "image_rows": image_rows, "flag_rows": results[1],
        "variance_rows": results[2] if need_variance else None, "variance_window": (v0, v1),
        "model": results[3] if need_variance else None,
    }


def _assemble(parts: dict, sigma_plane: bool, dtype: str) -> bytes:
    """Turn what was read into a finished frame: decode, measure, and pack. Runs on a worker thread."""
    key, info, matrix = parts["key"], parts["info"], parts["matrix"]
    x, y, px, py = parts["x"], parts["y"], parts["px"], parts["py"]
    x0, x1, y0, y1 = parts["window"]
    v0, v1 = parts["variance_window"]
    grid = parts["grid"]
    image = rows_array(parts["image_rows"], info.nx, x0, x1)
    flags = flags_array(parts["flag_rows"], info, x0, x1) if parts["flag_rows"] is not None else np.zeros((y1 - y0, x1 - x0), dtype=np.int32)

    cards = info.cards
    wavelength, bandwidth = (float(v) for v in grid.at(x, y))
    gradient = grid.gradient(x, y)
    omega = float(cards.get("OMEGA_MEDIAN") or abs(matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]))

    # Frame statistics from usable pixels, for a steady display stretch across frames.
    usable = np.isfinite(image) & ((flags & BAD_MASK) == 0)
    if usable.any():
        values = image[usable]
        level = float(np.median(values))
        spread = float(1.4826 * np.median(np.abs(values - level)))
    else:
        level = spread = math.nan

    header = {
        "v": FORMAT_VERSION,
        "key": key,
        "ok": True,
        "nx": x1 - x0,
        "ny": y1 - y0,
        "x0": x0,
        "y0": y0,
        "cx": x - x0,
        "cy": y - y0,
        "ra": parts["ra"],
        "dec": parts["dec"],
        "m": [matrix[0][0], matrix[0][1], matrix[1][0], matrix[1][1]],
        "det": info.detector,
        "mjd": _clean(cards.get("MJD-AVG")),
        "exp": _clean(cards.get("XPOSURE")),
        "wl": wavelength,
        "bw": bandwidth,
        "dwl": [gradient[0], gradient[1]],
        "chan": int(channel_index(info.detector, wavelength)),
        "fwhm": _clean(cards.get("PSF_FWHM")),
        "omega": omega,
        "bg": _clean(level),
        "rms": _clean(spread),
        "nan": int(np.isnan(image).sum()),
        "bits": int(np.bitwise_or.reduce(flags.ravel())) if flags.size else 0,
        "qa": {
            "l2": cards.get("L2DQAFLG"),
            "astrom": cards.get("FINAST"),
            "survey": cards.get("SPS_FLAGS"),
            "airglow": bool(cards.get("HE_AIRGLOW_CONT")),
            "aurora": bool(cards.get("AURORA_CONT")),
            "glow": bool(cards.get("SHUTTLE_GLOW_CONT")),
        },
    }

    planes = []
    if parts["variance_rows"] is not None:
        variance = np.full(image.shape, np.nan, dtype=np.float32)
        variance[v0 - y0:v1 - y0] = rows_array(parts["variance_rows"], info.nx, x0, x1)
        if parts["phot_inside"]:
            model = parts["model"]
            stamp = model.zone(px, py)
            measured = photometry.measure(image, variance, flags, px - x0, py - y0, model, stamp, omega)
            measured["x"] = px - x0
            measured["y"] = py - y0
            measured["flux"] = _clean(measured["flux"])
            measured["err"] = _clean(measured["err"])
            header["phot"] = measured
    else:
        variance = None

    if dtype == "f4":
        planes.append(("image", "f4", image.astype("<f4")))
    else:
        planes.append(("image", "f2", np.clip(image, -F16_LIMIT, F16_LIMIT).astype("<f2")))
    planes.append(("flags", "u4", flags.astype("<u4")))
    if sigma_plane and variance is not None:
        sigma = np.sqrt(np.clip(variance, 0, None))
        planes.append(("sigma", "f4", sigma.astype("<f4")) if dtype == "f4" else ("sigma", "f2", np.clip(sigma, 0, F16_LIMIT).astype("<f2")))
    frame = encode(header, planes)
    # The usual kind is packed here, on the worker, so the loop never touches the pixels.
    return frame if sigma_plane or dtype != "f2" else pack(frame)


async def _nothing():
    """Stands in for the FLAGS read of a file whose FLAGS extension is not in the expected layout."""
    return None


async def _zeros(rows: int, cols: int) -> np.ndarray:
    """Stand-in flags plane for files whose FLAGS extension is not in the expected layout."""
    return np.zeros((rows, cols), dtype=np.int32)


def decode(frame: bytes):
    """Unpack a frame. The inverse of encode, used by tests and tools."""
    if frame[:4] != MAGIC:
        raise ValueError("Not a frame")
    (length,) = struct.unpack("<I", frame[4:8])
    header = json.loads(frame[8:8 + length])
    offset = 8 + length
    planes = {}
    for plane in header.get("planes", []):
        raw = frame[offset:offset + plane["bytes"]]
        offset += plane["bytes"] + (-plane["bytes"] % 4)
        planes[plane["name"]] = np.frombuffer(raw, dtype="<" + plane["dtype"]).reshape(header["ny"], header["nx"])
    return header, planes
