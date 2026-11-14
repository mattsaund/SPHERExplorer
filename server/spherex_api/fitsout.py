# Writes FITS cutouts for people who want to measure with their own tools: the exact pixels
# of a Level 2 image around a sky position, with the image's own world coordinates (TAN with
# SIP distortion), its flags, and its variance. Nothing is resampled or rescaled.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import io
import zipfile

import numpy as np
from astropy.io import fits

from . import calib, config
from .cutout import _window, _zeros, read_flags, read_rows
from .layout import WCS_KEY, get_head, get_layout
from .solarsystem import topocentric

# Header keys of the parent image that are worth carrying into a cutout.
KEEP = (
    "DETECTOR", "OBSID", "EXPIDN", "MJD-BEG", "MJD-AVG", "MJD-END", "DATE-AVG", "XPOSURE",
    "PSF_FWHM", "L1DQAFLG", "L2DQAFLG",
)
CREDIT = "NASA SPHEREx (JPL, Caltech), from NASA/IPAC IRSA"
# Files built at once for a zip. Each one is three small reads from the archive.
ZIP_CONCURRENCY = 16


class Outside(ValueError):
    """The position does not fall on this detector."""


def wcs_cards(cards: dict, x0: int, y0: int) -> list[tuple[str, object]]:
    """
    World coordinate keys for a cutout whose first pixel is (x0, y0) of the parent image.
    Only the reference pixel moves. The distortion terms are measured from the reference
    pixel, so they stay as they are.
    """
    sip = "A_ORDER" in cards
    out: list[tuple[str, object]] = [
        ("CTYPE1", "RA---TAN-SIP" if sip else "RA---TAN"),
        ("CTYPE2", "DEC--TAN-SIP" if sip else "DEC--TAN"),
        ("CUNIT1", "deg"),
        ("CUNIT2", "deg"),
        ("RADESYS", "ICRS"),
    ]
    for name, value in cards.items():
        if not WCS_KEY.match(name):
            continue
        if name == "CRPIX1":
            value = float(value) - x0
        elif name == "CRPIX2":
            value = float(value) - y0
        out.append((name, value))
    return out


def build(key: str, cards: dict, version: str, x0: int, y0: int, image, flags, variance,
          wavelength: float, bandwidth: float) -> bytes:
    """Assemble the FITS file: an empty primary header, then IMAGE, FLAGS, and VARIANCE."""
    source = key.rsplit("/", 1)[-1]
    primary = fits.Header()
    primary["ORIGIN"] = ("SPHERExplorer", "cutout made by the SPHERExplorer web tool")
    primary["TELESCOP"] = "SPHEREx"
    primary["SRCFILE"] = (source, "Level 2 file the pixels come from")
    if version:
        primary["VERSION"] = (version, "pipeline version of that file")
    primary["XCUT0"] = (x0, "first parent column in this cutout, from 0")
    primary["YCUT0"] = (y0, "first parent row in this cutout, from 0")
    primary["LAMBDA"] = (round(wavelength, 6), "[um] wavelength at the cutout position")
    primary["DLAMBDA"] = (round(bandwidth, 6), "[um] bandwidth at the cutout position")
    primary.add_comment("Pixels are copied unchanged from the Level 2 spectral image.")
    primary.add_comment("The wavelength changes across the image. LAMBDA holds its value at the center.")
    primary.add_comment(f"Data: {CREDIT}.")

    shared = fits.Header()
    for name, value in wcs_cards(cards, x0, y0):
        shared[name] = value
    for name in KEEP:
        if cards.get(name) is not None:
            shared[name] = cards[name]

    def plane(data, name: str, unit: str | None) -> fits.ImageHDU:
        header = shared.copy()
        if unit:
            header["BUNIT"] = unit
        return fits.ImageHDU(data, header=header, name=name)

    unit = str(cards.get("BUNIT") or "MJy/sr")
    hdus = fits.HDUList([
        fits.PrimaryHDU(header=primary),
        plane(np.ascontiguousarray(image, dtype=">f4"), "IMAGE", unit),
        plane(np.ascontiguousarray(flags, dtype=">i4"), "FLAGS", None),
        plane(np.ascontiguousarray(variance, dtype=">f4"), "VARIANCE", f"({unit})2"),
    ])
    buffer = io.BytesIO()
    hdus.writeto(buffer)
    return buffer.getvalue()


async def cutout(key: str, ra: float, dec: float, size: float, delta: float | None = None) -> tuple[str, bytes]:
    """
    One FITS cutout of `size` arcseconds around (ra, dec). Returns a file name and the bytes.
    delta is the distance in au of a solar system body, as in cutout.make_cutout.
    Raises Outside when the position is off the detector.
    """
    head = await get_head(key)
    wcs = head.wcs
    if delta:
        spacecraft = [head.cards.get(name) for name in ("X_SC", "Y_SC", "Z_SC")]
        if all(value is not None for value in spacecraft):
            ra, dec = topocentric(ra, dec, delta, spacecraft)
    x, y = (float(v) for v in wcs.sky2pix(ra, dec))
    if not (-0.5 <= x < head.nx - 0.5 and -0.5 <= y < head.ny - 0.5):
        raise Outside(key)
    matrix = wcs.local_matrix(x, y, ra, dec, span=max(4.0, size / 2.0 / config.PIXEL_SCALE))
    x0, x1, y0, y1 = _window(head, x, y, matrix, size)
    info = await get_layout(key)
    image, flags, variance, grid = await asyncio.gather(
        read_rows(key, head.image_off, head.nx, y0, y1, x0, x1),
        read_flags(info, y0, y1, x0, x1) if info.flags_ok else _zeros(y1 - y0, x1 - x0),
        read_rows(key, info.var_off, info.nx, y0, y1, x0, x1),
        calib.wave_grid(info),
    )
    wavelength, bandwidth = (float(v) for v in grid.at(x, y))
    name = "cutout_" + key.rsplit("/", 1)[-1]
    return name, build(key, info.cards, info.version, x0, y0, image, flags, variance, wavelength, bandwidth)


class _Sink:
    """A write-only file for zipfile. It hands back what was written since the last take()."""

    def __init__(self):
        self.parts: list[bytes] = []
        self.size = 0

    def write(self, data) -> int:
        self.parts.append(bytes(data))
        self.size += len(data)
        return len(data)

    def tell(self) -> int:
        return self.size

    def flush(self) -> None:
        pass

    def take(self) -> bytes:
        data = b"".join(self.parts)
        self.parts.clear()
        return data


async def zip_stream(jobs):
    """
    Yield a zip file piece by piece. `jobs` is a list of awaitables, each giving (name, bytes)
    or raising. A file that fails is left out, and a note at the end lists what is missing.
    The zip is written as it goes, so memory holds only the files not yet sent.
    """
    gate = asyncio.Semaphore(ZIP_CONCURRENCY)

    async def run(job):
        async with gate:
            return await job

    tasks = [asyncio.ensure_future(run(job)) for job in jobs]
    sink = _Sink()
    missing: list[str] = []
    seen: set[str] = set()
    try:
        with zipfile.ZipFile(sink, "w", zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
            for task in tasks:
                try:
                    name, data = await task
                except Outside as error:
                    missing.append(f"{str(error).rsplit('/', 1)[-1]}: the position is off this detector")
                    continue
                except Exception as error:  # one bad file must not cost the whole download
                    missing.append(f"a file could not be read: {type(error).__name__}")
                    continue
                if name in seen:
                    continue
                seen.add(name)
                archive.writestr(name, data)
                yield sink.take()
            notes = [
                "FITS cutouts of NASA SPHEREx Level 2 spectral images, made by SPHERExplorer.",
                "Each file holds IMAGE (MJy/sr), FLAGS, and VARIANCE, with the image's own world coordinates.",
                "Pixels are copied unchanged. Every exposure is at a different wavelength: see LAMBDA in each file.",
                f"Data: {CREDIT}.",
                "",
                f"Files: {len(seen)}",
            ]
            if missing:
                notes += ["Left out:"] + missing
            archive.writestr("README.txt", "\n".join(notes) + "\n")
        yield sink.take()
    finally:
        for task in tasks:
            task.cancel()
