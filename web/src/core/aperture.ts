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

/** The halo ring is split into thin rings this many pixels wide, so missing pixels are filled from their own radius. */
const RING_STEP = 0.5;

/**
 * Measure the light in a ring around a spot on one frame: the outer halo of a star.
 * A star too bright for the detector has a useless core, but its halo rises and falls with it,
 * so the ring still tracks brightness changes. The halo fades quickly with distance, and bad
 * pixels crowd its bright inner edge. So the ring is cut into thin rings, and each bad pixel
 * is replaced by the average of the good pixels at the same distance from the star.
 * Radii are in arcseconds. The result is in microjansky, not corrected to the star's total light.
 * minGood is the share of the whole ring that must be usable.
 */
export function measureRing(frame: Frame, pixels: FramePixels, east: number, north: number, inner: number, outer: number, badMask: number, minGood = 0.7): ApertureResult | null {
  if (!frame.m || frame.cx === undefined || frame.cy === undefined || !frame.rms) return null;
  const [a, b, c, d] = frame.m;
  const det = a * d - b * c;
  if (!det) return null;
  const x0 = frame.cx + (d * east - b * north) / det;
  const y0 = frame.cy + (-c * east + a * north) / det;
  const area = Math.abs(det);
  const size = Math.sqrt(area);
  const rIn = inner / size;
  const rOut = outer / size;
  const skyIn = rOut + SKY_GAP;
  const skyOut = skyIn + SKY_WIDTH;
  const { nx, ny, half, flags } = pixels;
  if (x0 - skyOut < 0 || y0 - skyOut < 0 || x0 + skyOut > nx - 1 || y0 + skyOut > ny - 1) return null;

  const steps = Math.max(1, Math.ceil((rOut - rIn) / RING_STEP));
  const total = new Float64Array(steps);
  const used = new Uint32Array(steps);
  const wanted = new Uint32Array(steps);
  const sky: number[] = [];
  for (let y = Math.floor(y0 - skyOut); y <= Math.ceil(y0 + skyOut); y++) {
    for (let x = Math.floor(x0 - skyOut); x <= Math.ceil(x0 + skyOut); x++) {
      const distance = Math.hypot(x - x0, y - y0);
      const inRing = distance >= rIn && distance < rOut;
      const inSky = distance >= skyIn && distance <= skyOut;
      if (!inRing && !inSky) continue;
      const step = inRing ? Math.min(steps - 1, Math.floor((distance - rIn) / RING_STEP)) : -1;
      if (inRing) wanted[step]++;
      const at = y * nx + x;
      const value = halfToFloat(half[at]);
      if (value !== value || (flags && flags[at] & badMask)) continue;
      if (inRing) {
        total[step] += value;
        used[step]++;
      } else sky.push(value);
    }
  }
  if (sky.length < 8) return null;
  sky.sort((p, q) => p - q);
  const level = sky[Math.floor(sky.length / 2)];
  let sum = 0;
  let count = 0;
  let good = 0;
  let noise = 0;
  for (let step = 0; step < steps; step++) {
    if (!wanted[step]) continue;
    // A thin ring with nothing usable in it can't be filled in. The ring must start further out.
    if (!used[step]) return null;
    sum += (total[step] / used[step] - level) * wanted[step];
    noise += (wanted[step] * wanted[step]) / used[step];
    count += wanted[step];
    good += used[step];
  }
  if (!count || good < minGood * count) return null;
  const scale = area * UJY_PER_MJYSR_ARCSEC2;
  return { flux: sum * scale, err: frame.rms * Math.sqrt(noise + (count * count) / sky.length) * scale, sky: level, good: true };
}
