// Aperture photometry in the browser: the light inside a circle, minus the sky around it.
// It works on the frames already loaded, so the spectrum of any spot, with any circle size,
// appears at once. A circle suits extended things (galaxies, nebulae, comet comas), where the
// point-source fit done by the server would miss light.
// Written with Claude Code (Anthropic) assistance.
import { halfToFloat } from "./half";
import type { FramePixels } from "./pixels";
import type { Frame } from "./types";

/** One square arcsecond of sky at 1 MJy/sr, in microjansky. */
const UJY_PER_MJYSR_ARCSEC2 = 1e12 * (Math.PI / 180 / 3600) ** 2;
/** The sky ring starts this many pixels outside the circle and is this many pixels wide. */
const SKY_GAP = 2;
const SKY_WIDTH = 5;
/** Each edge pixel is split into this many parts per side to find how much of it is inside. */
const SUBSAMPLE = 4;

export interface ApertureResult {
  /** Flux density in microjansky and its uncertainty. */
  flux: number;
  err: number;
  /** Sky level in MJy/sr. */
  sky: number;
  /** False when saturated or flagged pixels fall inside the circle, or the circle leaves the frame. */
  good: boolean;
}

/**
 * Measure the light in a circle on one frame.
 * east and north are the circle's center as a sky offset from the frame's center, in arcseconds.
 */
export function measureAperture(frame: Frame, pixels: FramePixels, east: number, north: number, radius: number, badMask: number): ApertureResult | null {
  if (!frame.m || frame.cx === undefined || frame.cy === undefined || !frame.rms) return null;
  const [a, b, c, d] = frame.m;
  const det = a * d - b * c;
  if (!det) return null;
  // Center of the circle in frame pixels.
  const x0 = frame.cx + (d * east - b * north) / det;
  const y0 = frame.cy + (-c * east + a * north) / det;
  const area = Math.abs(det); // square arcseconds per pixel
  const r = radius / Math.sqrt(area); // radius in pixels
  const skyIn = r + SKY_GAP;
  const skyOut = skyIn + SKY_WIDTH;
  const { nx, ny, half, flags } = pixels;
  if (x0 - skyOut < 0 || y0 - skyOut < 0 || x0 + skyOut > nx - 1 || y0 + skyOut > ny - 1) return null;

  // Sky: median of the usable ring pixels.
  const ring: number[] = [];
  const xa = Math.floor(x0 - skyOut), xb = Math.ceil(x0 + skyOut);
  const ya = Math.floor(y0 - skyOut), yb = Math.ceil(y0 + skyOut);
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const distance = Math.hypot(x - x0, y - y0);
      if (distance < skyIn || distance > skyOut) continue;
      const at = y * nx + x;
      const value = halfToFloat(half[at]);
      if (value !== value || (flags && flags[at] & badMask)) continue;
      ring.push(value);
    }
  }
  if (ring.length < 8) return null;
  ring.sort((p, q) => p - q);
  const sky = ring[Math.floor(ring.length / 2)];

  // Light inside the circle. Pixels on the edge count by the share that lies inside.
  let total = 0;
  let covered = 0;
  let good = true;
  for (let y = Math.floor(y0 - r - 1); y <= Math.ceil(y0 + r + 1); y++) {
    for (let x = Math.floor(x0 - r - 1); x <= Math.ceil(x0 + r + 1); x++) {
      const distance = Math.hypot(x - x0, y - y0);
      if (distance > r + 0.75) continue;
      let share = 1;
      if (distance > r - 0.75) {
        let inside = 0;
        for (let j = 0; j < SUBSAMPLE; j++) {
          for (let i = 0; i < SUBSAMPLE; i++) {
            const sx = x - 0.5 + (i + 0.5) / SUBSAMPLE;
            const sy = y - 0.5 + (j + 0.5) / SUBSAMPLE;
            if (Math.hypot(sx - x0, sy - y0) <= r) inside++;
          }
        }
        share = inside / (SUBSAMPLE * SUBSAMPLE);
      }
      if (share === 0) continue;
      const at = y * nx + x;
      const value = halfToFloat(half[at]);
      if (value !== value || (flags && flags[at] & badMask)) {
        good = false; // light is missing here, so the sum is a lower limit
        continue;
      }
      total += share * (value - sky);
      covered += share;
    }
  }
  if (covered === 0) return null;
  const scale = area * UJY_PER_MJYSR_ARCSEC2;
  // Noise of the sum, plus the uncertainty of the sky level spread over the circle.
  const err = frame.rms * Math.sqrt(covered + (covered * covered) / ring.length) * scale;
  return { flux: total * scale, err, sky, good };
}
