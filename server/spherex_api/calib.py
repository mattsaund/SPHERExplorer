# Per-detector calibration tables that ride along in every Level 2 file:
# the wavelength grid (WCS-WAVE) and the effective PSF (EPSF). Read once, then cached.
# Written with Claude Code (Anthropic) assistance.

import asyncio

import numpy as np

from . import cache, net
from .fitshdr import parse_header, table_dtype
from .layout import FileInfo


class WaveGrid:
    """Central wavelength and bandwidth across a detector, from a grid of control points.

    Values are in microns. Lookup is bilinear, which is how the FITS -TAB convention defines it.
    """

    def __init__(self, xs, ys, values):
        self.xs = np.asarray(xs, dtype=float) - 1.0  # FITS pixels are 1-based
        self.ys = np.asarray(ys, dtype=float) - 1.0
        self.values = np.asarray(values, dtype=float)  # (ny, nx, 2)

    def _cell(self, grid, coord):
        index = np.clip(np.searchsorted(grid, coord, side="right") - 1, 0, len(grid) - 2)
        frac = (coord - grid[index]) / (grid[index + 1] - grid[index])
        return index, frac

    def at(self, x, y):
        """Return (wavelength, bandwidth) at pixel positions."""
        x = np.asarray(x, dtype=float)
        y = np.asarray(y, dtype=float)
        ix, fx = self._cell(self.xs, x)
        iy, fy = self._cell(self.ys, y)
        v = self.values
        out = (
            v[iy, ix] * ((1 - fx) * (1 - fy))[..., None]
            + v[iy, ix + 1] * (fx * (1 - fy))[..., None]
            + v[iy + 1, ix] * ((1 - fx) * fy)[..., None]
            + v[iy + 1, ix + 1] * (fx * fy)[..., None]
        )
        return out[..., 0], out[..., 1]

    def gradient(self, x: float, y: float):
        """Wavelength change per pixel in x and y at one position."""
        wl, _ = self.at(np.array([x + 2, x - 2, x, x]), np.array([y, y, y + 2, y - 2]))
        return float(wl[0] - wl[1]) / 4.0, float(wl[2] - wl[3]) / 4.0


class Epsf:
    """Effective PSF stamps for the zones of one detector."""

    def __init__(self, stamps, xcenter, ycenter, oversample):
        self.stamps = np.asarray(stamps, dtype=np.float32)  # (zones, n, n), each sums to 1
        self.xcenter = np.asarray(xcenter, dtype=float)
        self.ycenter = np.asarray(ycenter, dtype=float)
        self.oversample = int(oversample)

    def zone(self, x: float, y: float) -> np.ndarray:
        """The stamp of the zone nearest to a detector position."""
        index = int(np.argmin((self.xcenter - x) ** 2 + (self.ycenter - y) ** 2))
        return self.stamps[index]

    def fractions(self, stamp: np.ndarray, dx, dy):
        """Fraction of a point source's flux that lands in pixels offset (dx, dy) from it."""
        center = (stamp.shape[0] - 1) / 2.0
        fx = center + np.asarray(dx, dtype=float) * self.oversample
        fy = center + np.asarray(dy, dtype=float) * self.oversample
        limit = stamp.shape[0] - 1
        inside = (fx >= 0) & (fx <= limit) & (fy >= 0) & (fy <= limit)
        ix = np.clip(np.floor(fx).astype(int), 0, limit - 1)
        iy = np.clip(np.floor(fy).astype(int), 0, limit - 1)
        tx = fx - ix
        ty = fy - iy
        value = (
            stamp[iy, ix] * (1 - tx) * (1 - ty)
            + stamp[iy, ix + 1] * tx * (1 - ty)
            + stamp[iy + 1, ix] * (1 - tx) * ty
            + stamp[iy + 1, ix + 1] * tx * ty
        )
        # A stamp sums to 1 over the oversampled grid, so scale to whole pixels.
        return np.where(inside, value * self.oversample**2, 0.0)


_waves: dict[tuple[int, str], WaveGrid] = {}
_epsfs: dict[tuple[int, str], Epsf] = {}
_latest_wave: dict[int, WaveGrid] = {}
_locks: dict[str, asyncio.Lock] = {}


def _lock(name: str) -> asyncio.Lock:
    return _locks.setdefault(name, asyncio.Lock())


async def _read_table(key: str, start: int, end: int):
    """Read one binary-table extension that spans [start, end)."""
    buf = await net.s3_bytes(key, start, end)
    cards, _, length = parse_header(buf)
    dtype = table_dtype(cards)
    rows = np.frombuffer(buf, dtype=dtype, count=int(cards["NAXIS2"]), offset=length)
    return cards, rows


async def wave_grid(info: FileInfo) -> WaveGrid:
    """The wavelength grid that applies to a mapped file."""
    ident = (info.detector, info.calib.get("spectral_wcs", info.version))
    grid = _waves.get(ident)
    if grid is not None:
        return grid
    name = f"wave-{ident[0]}-{ident[1]}"
    async with _lock(name):
        grid = _waves.get(ident)
        if grid is None:
            stored = cache.load_arrays("calib", name)
            if stored is None:
                _, rows = await _read_table(info.key, info.wave_hdr_off, info.total)
                stored = {"xs": rows["X"][0], "ys": rows["Y"][0], "values": rows["VALUES"][0]}
                cache.save_arrays("calib", name, **stored)
            grid = WaveGrid(stored["xs"], stored["ys"], stored["values"])
            _waves[ident] = grid
            _latest_wave[info.detector] = grid
    return grid


def any_wave_grid(detector: int) -> WaveGrid | None:
    """A recent wavelength grid for a detector, for estimates before a file is opened."""
    return _latest_wave.get(detector)


async def epsf(info: FileInfo) -> Epsf:
    """The effective PSF that applies to a mapped file."""
    ident = (info.detector, info.calib.get("epsf", info.version))
    model = _epsfs.get(ident)
    if model is not None:
        return model
    name = f"epsf-{ident[0]}-{ident[1]}"
    async with _lock(name):
        model = _epsfs.get(ident)
        if model is None:
            stored = cache.load_arrays("calib", name)
            if stored is None:
                cards, rows = await _read_table(info.key, info.epsf_hdr_off, info.wave_hdr_off)
                column = "EPSF" if "EPSF" in rows.dtype.names else "PSF"
                stored = {
                    "stamps": rows[column].astype(np.float32),
                    "xcenter": rows["XCENTER"].astype(np.float32),
                    "ycenter": rows["YCENTER"].astype(np.float32),
                    "oversample": np.array(int(cards.get("OVSMPX", 5))),
                }
                cache.save_arrays("calib", name, **stored)
            model = Epsf(stored["stamps"], stored["xcenter"], stored["ycenter"], int(stored["oversample"]))
            _epsfs[ident] = model
    return model
