# FITS cutouts: the world coordinates must still point at the same sky, and a zip must hold every file.
# Written with Claude Code (Anthropic) assistance.

import io
import zipfile

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS

from spherex_api import fitsout

# A plain tangent-plane image header, 6.15 arcsec pixels, with one small distortion term.
CARDS = {
    "CRPIX1": 1020.5, "CRPIX2": 1020.5, "CRVAL1": 150.0, "CRVAL2": -20.0,
    "CD1_1": -0.0017083, "CD1_2": 0.0, "CD2_1": 0.0, "CD2_2": 0.0017083,
    "A_ORDER": 2, "B_ORDER": 2, "A_2_0": 1.0e-7, "B_0_2": -2.0e-7,
    "DETECTOR": 3, "OBSID": "2025W30_1A_0123_1", "MJD-AVG": 60875.5, "BUNIT": "MJy/sr",
}
KEY = "qr3/level2/2025W30_1A/l2b-v27-2026-197/3/level2_2025W30_1A_0123_1D3_spx_l2b-v27-2026-197.fits"


def parent_wcs() -> WCS:
    header = fits.Header()
    for name, value in fitsout.wcs_cards(CARDS, 0, 0):
        header[name] = value
    return WCS(header)


def test_cutout_keeps_its_place_on_the_sky():
    x0, y0 = 700, 1200
    image = np.arange(30 * 40, dtype=np.float32).reshape(30, 40)
    flags = np.ones((30, 40), dtype=np.int32)
    variance = np.full((30, 40), 0.25, dtype=np.float32)
    data = fitsout.build(KEY, CARDS, "7.0.5", x0, y0, image, flags, variance, 1.9, 0.045)

    with fits.open(io.BytesIO(data)) as hdus:
        assert [hdu.name for hdu in hdus] == ["PRIMARY", "IMAGE", "FLAGS", "VARIANCE"]
        assert hdus[0].header["SRCFILE"].startswith("level2_2025W30_1A_0123_1D3")
        assert hdus[0].header["XCUT0"] == x0 and hdus[0].header["LAMBDA"] == 1.9
        assert np.array_equal(hdus["IMAGE"].data, image)
        assert hdus["IMAGE"].header["BUNIT"] == "MJy/sr" and hdus["IMAGE"].header["DETECTOR"] == 3
        assert hdus["FLAGS"].data.dtype.kind == "i" and hdus["VARIANCE"].data[0, 0] == 0.25
        cut = WCS(hdus["IMAGE"].header)
        # A pixel of the cutout and the same pixel of the parent image are the same sky position.
        for px, py in ((0, 0), (39, 29), (17.3, 8.8)):
            got = cut.all_pix2world([[px, py]], 0)[0]
            want = parent_wcs().all_pix2world([[px + x0, py + y0]], 0)[0]
            assert np.allclose(got, want, atol=1e-9)


def test_header_without_distortion_is_plain_tan():
    plain = {name: value for name, value in CARDS.items() if not name.startswith(("A_", "B_"))}
    types = dict(fitsout.wcs_cards(plain, 10, 20))
    assert types["CTYPE1"] == "RA---TAN" and types["CRPIX1"] == 1010.5 and types["CRPIX2"] == 1000.5


async def test_zip_holds_every_file_and_names_what_is_missing():
    async def good(name):
        return name, b"SIMPLE  =                    T"

    async def off():
        raise fitsout.Outside("dir/level2_missed.fits")

    chunks = [chunk async for chunk in fitsout.zip_stream([good("a.fits"), off(), good("b.fits"), good("a.fits")])]
    archive = zipfile.ZipFile(io.BytesIO(b"".join(chunks)))
    assert sorted(archive.namelist()) == ["README.txt", "a.fits", "b.fits"]
    notes = archive.read("README.txt").decode()
    assert "Files: 2" in notes and "level2_missed.fits" in notes
    assert archive.testzip() is None
