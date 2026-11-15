# Forced photometry of a point source on a small SPHEREx cutout.
# The flux is a matched-filter fit of the effective PSF over the good pixels,
# so masked and saturated pixels are skipped instead of biasing the sum.
# Written with Claude Code (Anthropic) assistance.

import math

import numpy as np

from .calib import Epsf
from .instrument import BAD_MASK, SOURCE_MASK

FIT_RADIUS = 3.0  # pixels. The EPSF stamps reach 3.2 pixels from the center.
SKY_IN = 5.0      # inner radius of the sky ring, pixels
SKY_OUT = 9.0     # outer radius of the sky ring, pixels
CORE_RADIUS = 1.5  # flags inside this radius are reported with the measurement

# MJy/sr times one square arcsecond, in microjansky.
UJY_PER_MJYSR_ARCSEC2 = 1e12 * (math.pi / 180.0 / 3600.0) ** 2


def _box(shape, x: float, y: float, reach: float):
    """The part of an image within `reach` pixels of (x, y), as slices and its pixel coordinates.

    Everything measured here lies within a few pixels of the source. Working on that small box
    costs the same for a 5 arcminute cutout and a 60 arcminute one. The coordinates count from
    the corner of the whole image, so every number comes out exactly as it would on the whole image.
    """
    margin = int(math.ceil(reach)) + 1
    y0 = max(0, int(math.floor(y)) - margin)
    y1 = min(shape[0], int(math.floor(y)) + margin + 2)
    x0 = max(0, int(math.floor(x)) - margin)
    x1 = min(shape[1], int(math.floor(x)) + margin + 2)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    return (slice(y0, y1), slice(x0, x1)), xx, yy


def sky_level(image: np.ndarray, flags: np.ndarray, x: float, y: float):
    """Robust local background around (x, y). Returns (level, scatter, pixels used) in image units."""
    box, xx, yy = _box(image.shape, x, y, SKY_OUT)
    image, flags = image[box], flags[box]
    radius = np.hypot(xx - x, yy - y)
    ring = (radius >= SKY_IN) & (radius <= SKY_OUT) & np.isfinite(image) & ((flags & BAD_MASK) == 0)
    # Prefer pixels outside known-source masks. Fall back when a crowded field leaves too few.
    clean = ring & ((flags & SOURCE_MASK) == 0)
    values = image[clean] if clean.sum() >= 30 else image[ring]
    if values.size < 8:
        return math.nan, math.nan, 0
    for _ in range(4):
        middle = np.median(values)
        spread = 1.4826 * np.median(np.abs(values - middle))
        if spread == 0:
            break
        keep = np.abs(values - middle) <= 3.0 * spread
        if keep.all():
            break
        values = values[keep]
    middle = float(np.median(values))
    spread = float(1.4826 * np.median(np.abs(values - middle)))
    return middle, spread, int(values.size)


def measure(image, variance, flags, x: float, y: float, model: Epsf, stamp, omega: float) -> dict:
    """Measure a point source at pixel (x, y).

    image and variance are in MJy/sr and (MJy/sr)^2. omega is the pixel solid angle in square
    arcseconds. Returns flux and error in microjansky plus quality numbers.
    """
    sky, scatter, sky_count = sky_level(image, flags, x, y)
    box, xx, yy = _box(image.shape, x, y, FIT_RADIUS)
    image, variance, flags = image[box], variance[box], flags[box]
    dx = xx - x
    dy = yy - y
    radius = np.hypot(dx, dy)
    core = radius <= FIT_RADIUS
    profile = model.fractions(stamp, dx[core], dy[core])
    data = image[core]
    var = variance[core]
    bits = flags[core]
    good = np.isfinite(data) & np.isfinite(var) & (var > 0) & ((bits & BAD_MASK) == 0)

    near = radius[core] <= CORE_RADIUS
    result = {
        "sky": sky if math.isfinite(sky) else None,
        "skyRms": scatter if math.isfinite(scatter) else None,
        "bits": int(np.bitwise_or.reduce(bits[near])) if near.any() else 0,
        "nan": int(np.isnan(data[near]).sum()),
        "flux": None,
        "err": None,
        "frac": 0.0,
    }
    weight_all = float(np.sum(profile**2))
    weight = float(np.sum(profile[good] ** 2))
    if weight <= 0 or weight_all <= 0 or not math.isfinite(sky):
        return result

    flux = float(np.sum(profile[good] * (data[good] - sky))) / weight
    variance_flux = float(np.sum(profile[good] ** 2 * var[good])) / weight**2
    # The sky level is uncertain too. Its error scales with the profile sum.
    variance_flux += (scatter**2 / max(sky_count, 1)) * (float(np.sum(profile[good])) / weight) ** 2
    scale = omega * UJY_PER_MJYSR_ARCSEC2
    result["flux"] = flux * scale
    result["err"] = math.sqrt(variance_flux) * scale
    result["frac"] = weight / weight_all  # share of the PSF weight that fell on usable pixels
    return result
