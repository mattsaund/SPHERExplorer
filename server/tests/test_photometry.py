# Forced photometry and the frame format, on synthetic data with a known answer.
# Written with Claude Code (Anthropic) assistance.

import numpy as np

from spherex_api.images import cutout, photometry
from spherex_api.images.calib import Epsf
from spherex_api.images.instrument import BAD_MASK, CHANNELS, channel_index


def gaussian_epsf(fwhm_px: float = 1.3, oversample: int = 5, size: int = 33) -> Epsf:
    """A one-zone EPSF with a Gaussian profile, normalized like the real ones (sums to 1)."""
    center = (size - 1) / 2
    yy, xx = np.indices((size, size))
    sigma = fwhm_px / 2.3548 * oversample
    stamp = np.exp(-((xx - center) ** 2 + (yy - center) ** 2) / (2 * sigma**2))
    stamp /= stamp.sum()
    return Epsf(stamp[None], [1020.0], [1020.0], oversample)


def synthetic(flux: float, x: float, y: float, sky: float, noise: float, seed: int = 3, size: int = 41):
    """An image holding one point source of `flux` (image units times pixels) on a flat sky."""
    model = gaussian_epsf()
    yy, xx = np.indices((size, size))
    profile = model.fractions(model.stamps[0], xx - x, yy - y)
    rng = np.random.default_rng(seed)
    image = (sky + flux * profile + rng.normal(0, noise, (size, size))).astype(np.float32)
    variance = np.full((size, size), noise**2, dtype=np.float32)
    flags = np.zeros((size, size), dtype=np.int32)
    return model, image, variance, flags


def test_psf_fractions_sum_to_one():
    model = gaussian_epsf()
    yy, xx = np.indices((15, 15))
    for x, y in [(7.0, 7.0), (7.3, 6.6), (6.5, 7.5)]:
        total = model.fractions(model.stamps[0], xx - x, yy - y).sum()
        assert abs(total - 1.0) < 0.02


def test_recovers_flux_and_error():
    omega = 37.93
    scale = omega * photometry.UJY_PER_MJYSR_ARCSEC2
    fluxes = []
    for seed in range(40):
        model, image, variance, flags = synthetic(50.0, 20.3, 19.6, 0.5, 0.05, seed)
        out = photometry.measure(image, variance, flags, 20.3, 19.6, model, model.stamps[0], omega)
        fluxes.append(out["flux"] / scale)
        assert out["frac"] == 1.0 and out["nan"] == 0
        assert abs(out["sky"] - 0.5) < 0.02
    fluxes = np.array(fluxes)
    assert abs(fluxes.mean() - 50.0) < 0.5                        # unbiased
    assert 0.5 < fluxes.std() / (out["err"] / scale) < 1.6        # the reported error is honest


def test_masked_and_saturated_pixels_are_skipped():
    omega = 37.93
    scale = omega * photometry.UJY_PER_MJYSR_ARCSEC2
    model, image, variance, flags = synthetic(400.0, 20.0, 20.0, 0.5, 0.05)
    image[20, 20] = np.nan                # saturated core
    flags[19, 20] = BAD_MASK & -BAD_MASK  # lowest bad bit on a neighbor
    out = photometry.measure(image, variance, flags, 20.0, 20.0, model, model.stamps[0], omega)
    assert out["nan"] == 1 and out["frac"] < 0.9
    assert abs(out["flux"] / scale - 400.0) < 15.0   # the wings still give the flux


def test_empty_sky_gives_no_measurement():
    model, image, variance, flags = synthetic(10.0, 20.0, 20.0, 0.5, 0.05)
    image[:] = np.nan
    out = photometry.measure(image, variance, flags, 20.0, 20.0, model, model.stamps[0], 37.93)
    assert out["flux"] is None and out["err"] is None


def test_frame_round_trip():
    image = np.linspace(-1, 3, 12, dtype="<f2").reshape(3, 4)
    flags = np.arange(12, dtype="<u4").reshape(3, 4)
    frame = cutout.encode({"v": 1, "key": "k", "ok": True, "nx": 4, "ny": 3}, [("image", "f2", image), ("flags", "u4", flags)])
    assert len(frame) % 4 == 0
    header, planes = cutout.decode(frame)
    assert header["planes"][0] == {"name": "image", "dtype": "f2", "bytes": 24}
    assert np.array_equal(planes["image"], image) and np.array_equal(planes["flags"], flags)
    failed, _ = cutout.decode(cutout.failure("k", "nope"))
    assert failed["ok"] is False and failed["error"] == "nope"


def test_channel_index():
    assert len(CHANNELS) == 102 and np.all(np.diff(CHANNELS) > 0)
    assert int(channel_index(1, 0.753)) == 0
    assert int(channel_index(6, 4.99)) == 101
    assert int(channel_index(5, 4.3)) == 5 * 17 - 17 + int(np.argmin(np.abs(CHANNELS[68:85] - 4.3)))
    # Overlap regions resolve by detector, not by wavelength alone.
    assert int(channel_index(2, 1.10)) == 17 and int(channel_index(1, 1.10)) == 16
