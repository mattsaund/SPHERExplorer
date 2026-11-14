# Pointing geometry shared by the exposure index and its builder.
# One exposure is described by a single 3x3 frame matrix. The six detectors sit at fixed
# angles from each other, so every detector's footprint follows from that one matrix.
# Written with Claude Code (Anthropic) assistance.

import math

import numpy as np

D2R = math.pi / 180.0


def unit_vector(ra_deg, dec_deg):
    """Unit vector(s) on the sky for ICRS degrees. Shape (..., 3)."""
    ra = np.asarray(ra_deg, dtype=float) * D2R
    dec = np.asarray(dec_deg, dtype=float) * D2R
    return np.stack([np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)], axis=-1)


def tangent_basis(ra_deg: float, dec_deg: float) -> np.ndarray:
    """Columns are the east, north, and outward unit vectors at a sky position."""
    ra = ra_deg * D2R
    dec = dec_deg * D2R
    east = [-math.sin(ra), math.cos(ra), 0.0]
    north = [-math.sin(dec) * math.cos(ra), -math.sin(dec) * math.sin(ra), math.cos(dec)]
    out = [math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec)]
    return np.array([east, north, out]).T


def polar(cd: np.ndarray):
    """Split a 2x2 pixel matrix into an orthogonal part and a symmetric scale part: cd = r @ s."""
    u, sigma, vt = np.linalg.svd(cd)
    return u @ vt, vt.T @ np.diag(sigma) @ vt


def detector_frame(cards: dict):
    """Frame matrix and scale matrix of one detector image from its header cards.

    A pixel offset (u, v) from the reference pixel points along
    frame @ normalize([s @ (u, v), 1]). SIP distortion is left out. It is a few pixels at most.
    """
    if "CD1_1" in cards:
        cd = np.array([[cards["CD1_1"], cards.get("CD1_2", 0.0)], [cards.get("CD2_1", 0.0), cards["CD2_2"]]], dtype=float)
    else:
        d1 = float(cards.get("CDELT1", 1.0))
        d2 = float(cards.get("CDELT2", 1.0))
        cd = np.array([[d1 * cards["PC1_1"], d1 * cards["PC1_2"]], [d2 * cards["PC2_1"], d2 * cards["PC2_2"]]], dtype=float)
    rotation, scale = polar(cd * D2R)
    frame = tangent_basis(float(cards["CRVAL1"]), float(cards["CRVAL2"]))
    lift = np.eye(3)
    lift[:2, :2] = rotation
    return frame @ lift, scale


def project(frames: np.ndarray, scale_inverse: np.ndarray, target: np.ndarray, crpix: float = 1020.5):
    """Pixel position of a sky direction on detectors with the given frames.

    frames has shape (n, 3, 3). Returns 0-based (x, y) and a mask of frames facing the target.
    """
    local = np.einsum("nji,j->ni", frames, target)  # frame transpose times target
    facing = local[:, 2] > 0.2
    depth = np.where(facing, local[:, 2], 1.0)
    plane = local[:, :2] / depth[:, None]
    uv = plane @ scale_inverse.T
    return uv[:, 0] + crpix - 1.0, uv[:, 1] + crpix - 1.0, facing
