# Fast TAN-SIP sky transforms for SPHEREx Level 2 images, in plain NumPy.
# Pixel coordinates are 0-based with integers at pixel centers, as in NumPy and JavaScript.
# Checked against astropy.wcs in the tests.
# Written with Claude Code (Anthropic) assistance.

import math

import numpy as np

D2R = math.pi / 180.0
ARCSEC = 3600.0 / D2R  # arcseconds per radian


def _poly(cards: dict, prefix: str):
    """Collect SIP polynomial terms as (p, q, coefficient) for one of A, B, AP, BP."""
    order = int(cards.get(f"{prefix}_ORDER", 0) or 0)
    terms = []
    for p in range(order + 1):
        for q in range(order + 1 - p):
            value = cards.get(f"{prefix}_{p}_{q}")
            if value:
                terms.append((p, q, float(value)))
    return terms


# The value of a distortion polynomial at pixel offsets (u, v).
def _eval(terms, u, v):
    total = 0.0
    for p, q, coefficient in terms:
        total = total + coefficient * u**p * v**q
    return total


def gnomonic(ra, dec, ra0, dec0):
    """Project sky positions (radians) onto the tangent plane at (ra0, dec0).

    Returns (xi, eta) in radians. xi grows toward east, eta toward north.
    """
    dra = ra - ra0
    cosc = math.sin(dec0) * np.sin(dec) + math.cos(dec0) * np.cos(dec) * np.cos(dra)
    xi = np.cos(dec) * np.sin(dra) / cosc
    eta = (math.cos(dec0) * np.sin(dec) - math.sin(dec0) * np.cos(dec) * np.cos(dra)) / cosc
    return xi, eta


def gnomonic_inverse(xi, eta, ra0, dec0):
    """Inverse of gnomonic. Returns (ra, dec) in radians."""
    denom = math.cos(dec0) - eta * math.sin(dec0)
    ra = ra0 + np.arctan2(xi, denom)
    dec = np.arctan2(math.sin(dec0) + eta * math.cos(dec0), np.hypot(xi, denom))
    return ra, dec


class TanSip:
    """The sky WCS of one image (RA---TAN-SIP with LONPOLE 180)."""

    # Read the transform from an image header: reference pixel and sky position, matrix, and distortion terms.
    def __init__(self, cards: dict):
        self.crpix1 = float(cards["CRPIX1"])
        self.crpix2 = float(cards["CRPIX2"])
        self.ra0 = float(cards["CRVAL1"]) * D2R
        self.dec0 = float(cards["CRVAL2"]) * D2R
        if "CD1_1" in cards:
            cd = [
                [float(cards["CD1_1"]), float(cards.get("CD1_2", 0.0))],
                [float(cards.get("CD2_1", 0.0)), float(cards["CD2_2"])],
            ]
        else:
            d1 = float(cards.get("CDELT1", 1.0))
            d2 = float(cards.get("CDELT2", 1.0))
            cd = [
                [d1 * float(cards.get("PC1_1", 1.0)), d1 * float(cards.get("PC1_2", 0.0))],
                [d2 * float(cards.get("PC2_1", 0.0)), d2 * float(cards.get("PC2_2", 1.0))],
            ]
        self.cd = np.array(cd) * D2R  # radians per pixel
        self.cdi = np.linalg.inv(self.cd)
        self.a = _poly(cards, "A")
        self.b = _poly(cards, "B")
        self.ap = _poly(cards, "AP")
        self.bp = _poly(cards, "BP")

    def pix2sky(self, x, y):
        """Pixel to sky. Returns (ra, dec) in degrees."""
        u = np.asarray(x, dtype=float) + 1.0 - self.crpix1
        v = np.asarray(y, dtype=float) + 1.0 - self.crpix2
        up = u + _eval(self.a, u, v)
        vp = v + _eval(self.b, u, v)
        xi = self.cd[0, 0] * up + self.cd[0, 1] * vp
        eta = self.cd[1, 0] * up + self.cd[1, 1] * vp
        ra, dec = gnomonic_inverse(xi, eta, self.ra0, self.dec0)
        return np.mod(ra / D2R, 360.0), dec / D2R

    def sky2pix(self, ra_deg, dec_deg):
        """Sky (degrees) to pixel. Returns (x, y)."""
        xi, eta = gnomonic(np.asarray(ra_deg, dtype=float) * D2R, np.asarray(dec_deg, dtype=float) * D2R, self.ra0, self.dec0)
        big_u = self.cdi[0, 0] * xi + self.cdi[0, 1] * eta
        big_v = self.cdi[1, 0] * xi + self.cdi[1, 1] * eta
        # Start from the header's inverse polynomial, then polish against the forward one.
        u = big_u + _eval(self.ap, big_u, big_v)
        v = big_v + _eval(self.bp, big_u, big_v)
        for _ in range(3):
            u = u + (big_u - (u + _eval(self.a, u, v)))
            v = v + (big_v - (v + _eval(self.b, u, v)))
        return u + self.crpix1 - 1.0, v + self.crpix2 - 1.0

    def offsets(self, x, y, ra_c_deg: float, dec_c_deg: float):
        """Tangent-plane offsets of pixels from a sky center, in arcseconds (east, north)."""
        ra, dec = self.pix2sky(x, y)
        xi, eta = gnomonic(ra * D2R, dec * D2R, ra_c_deg * D2R, dec_c_deg * D2R)
        return xi * ARCSEC, eta * ARCSEC

    def local_matrix(self, x: float, y: float, ra_c_deg: float, dec_c_deg: float, span: float = 8.0):
        """Best linear map from pixel steps to sky offsets around (x, y).

        Returns [[de/dx, de/dy], [dn/dx, dn/dy]] in arcseconds per pixel.
        Central differences over +/- span pixels average out the small SIP curvature.
        """
        xs = np.array([x + span, x - span, x, x])
        ys = np.array([y, y, y + span, y - span])
        east, north = self.offsets(xs, ys, ra_c_deg, dec_c_deg)
        step = 2.0 * span
        return [
            [float(east[0] - east[1]) / step, float(east[2] - east[3]) / step],
            [float(north[0] - north[1]) / step, float(north[2] - north[3]) / step],
        ]
