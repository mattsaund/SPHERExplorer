# Builds one frame: a small crop of a Level 2 image around a sky position, with flags,
# wavelength, a pixel-to-sky transform, and forced photometry. Pixels stay in detector geometry.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import json
import math
import struct

import numpy as np
from astropy.io.fits.hdu.compressed._compression import decompress_rice_1_c

from . import calib, config, net, photometry
from .instrument import BAD_MASK, channel_index
from .layout import FileInfo, get_head, get_layout

MAGIC = b"SPXF"
FORMAT_VERSION = 1
MIN_HALF = 10        # pixels. Keeps room for the photometry sky ring.
MAX_HALF = 320       # pixels. About 1.1 degrees across.
VARIANCE_HALF = 4    # rows of variance read around the photometry position
F16_LIMIT = 65000.0  # float16 tops out near 65504


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


def failure(key: str, reason: str) -> bytes:
    """A frame that could not be built. The stream carries on."""
    return encode({"v": FORMAT_VERSION, "key": key, "ok": False, "error": reason})


async def read_rows(key: str, data_off: int, nx: int, y0: int, y1: int, x0: int, x1: int) -> np.ndarray:
    """Read rows [y0, y1) of a float32 image extension and keep columns [x0, x1)."""
    row_bytes = nx * 4
    buf = await net.s3_bytes(key, data_off + y0 * row_bytes, data_off + y1 * row_bytes)
    rows = np.frombuffer(buf, dtype=">f4").reshape(y1 - y0, nx)
    return rows[:, x0:x1].astype(np.float32)


async def read_flags(info: FileInfo, y0: int, y1: int, x0: int, x1: int) -> np.ndarray:
    """Read and decompress rows [y0, y1) of the RICE-compressed FLAGS extension."""
    size = info.flags_desc
    buf = await net.s3_bytes(info.key, info.flags_table_off + y0 * size, info.flags_table_off + y1 * size)
    descriptors = np.frombuffer(buf, dtype=">i4" if size == 8 else ">i8").reshape(-1, 2)
    lengths = descriptors[:, 0].astype(np.int64)
    offsets = descriptors[:, 1].astype(np.int64)
    start = int(offsets.min())
    end = int((offsets + lengths).max())
    heap = await net.s3_bytes(info.key, info.flags_heap_off + start, info.flags_heap_off + end)
    block, bytepix = info.flags_rice
    out = np.empty((y1 - y0, x1 - x0), dtype=np.int32)
    for row in range(y1 - y0):
        begin = int(offsets[row]) - start
        tile = decompress_rice_1_c(heap[begin:begin + int(lengths[row])], block, bytepix, info.nx)
        out[row] = np.frombuffer(tile, dtype=f"i{bytepix}")[x0:x1]
    return out


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


async def make_cutout(
    key: str,
    ra: float,
    dec: float,
    size: float,
    *,
    phot: tuple[float, float] | None = None,
    sigma_plane: bool = False,
    dtype: str = "f2",
) -> bytes:
    """Build and encode one frame. Never raises. A failed frame is encoded with ok=false."""
    try:
        return await _make(key, ra, dec, size, phot, sigma_plane, dtype)
    except asyncio.CancelledError:
        raise
    except Exception as error:  # noqa: BLE001 (one bad file must not stop a stream)
        return failure(key, f"{type(error).__name__}: {error}")


async def _make(key, ra, dec, size, phot, sigma_plane, dtype) -> bytes:
    head = await get_head(key)
    wcs = head.wcs
    x, y = (float(v) for v in wcs.sky2pix(ra, dec))
    if not (-0.5 <= x < head.nx - 0.5 and -0.5 <= y < head.ny - 0.5):
        return failure(key, "The position is off this detector")

    matrix = wcs.local_matrix(x, y, ra, dec, span=max(4.0, size / 2.0 / config.PIXEL_SCALE))
    x0, x1, y0, y1 = _window(head, x, y, matrix, size)

    # The image rows can start downloading while the rest of the file is being mapped.
    image_task = asyncio.ensure_future(read_rows(key, head.image_off, head.nx, y0, y1, x0, x1))
    try:
        info = await get_layout(key)

        # Photometry position. Defaults to the frame center.
        px, py = (x, y) if phot is None else (float(v) for v in wcs.sky2pix(phot[0], phot[1]))
        phot_inside = x0 <= px < x1 and y0 <= py < y1

        tasks = [calib.wave_grid(info)]
        tasks.append(read_flags(info, y0, y1, x0, x1) if info.flags_ok else _zeros(y1 - y0, x1 - x0))
        if sigma_plane:
            v0, v1 = y0, y1
        else:
            v0 = max(y0, int(round(py)) - VARIANCE_HALF)
            v1 = min(y1, int(round(py)) + VARIANCE_HALF + 1)
        need_variance = sigma_plane or phot_inside
        if need_variance and v1 > v0:
            tasks.append(read_rows(key, info.var_off, info.nx, v0, v1, x0, x1))
            tasks.append(calib.epsf(info))
        results = await asyncio.gather(*tasks)
        image = await image_task
    except BaseException:
        image_task.cancel()
        raise

    grid, flags = results[0], results[1]
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
    if need_variance and v1 > v0:
        variance_rows, model = results[2], results[3]
        variance = np.full(image.shape, np.nan, dtype=np.float32)
        variance[v0 - y0:v1 - y0] = variance_rows
        if phot_inside:
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
    return encode(header, planes)


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
