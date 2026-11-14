// Measures how a source moves across the sky from one visit to the next.
// For each visit the frames are summed with the sky held still, the source is located near
// where it is expected, and a straight line is fitted through the positions over time.
// Written with Claude Code (Anthropic) assistance.
import { mjdToYear } from "./astro";
import { fixedSum } from "./layers";
import { passes } from "./sequence";
import type { Stack } from "./stack";
import type { AppState } from "./store";

/** Where the source was found during one visit. Offsets are from the field center, in arcseconds. */
export interface MotionPoint {
  season: number;
  /** Mean time of the visit's images, Modified Julian Date. */
  mjd: number;
  east: number;
  north: number;
  /** One-sigma uncertainty of the position, arcseconds. */
  err: number;
  /** How strongly the source stands out from the noise. */
  snr: number;
  /** True when the source's core is saturated, which makes the position less certain. */
  saturated: boolean;
}

/** The fitted motion of a source. Rates are in arcseconds per year. */
export interface MotionFit {
  points: MotionPoint[];
  rateEast: number;
  rateNorth: number;
  /** Total speed and its uncertainty, arcseconds per year. */
  speed: number;
  speedErr: number;
  /** Direction of travel in degrees, counted from north through east. */
  angle: number;
  /** The catalog motion of the target for comparison, when known. */
  catalog: { speed: number; angle: number } | null;
  /** True when any visit's position came from a saturated source. */
  saturated: boolean;
  /** True when the target's known parallax wobble was removed before fitting. */
  parallaxRemoved: boolean;
}

/** Width of the window used to find the source, as a Gaussian sigma in arcseconds. About one PSF. */
const WINDOW_SIGMA = 7;
/** How far from the expected position the source may sit, arcseconds. */
const SEARCH_RADIUS = 20;
/** A visit must hold this many images and detect the source this strongly to count. */
const MIN_IMAGES = 3;
const MIN_SNR = 4;
/** Saturated pixels count as this many times the brightest measured pixel nearby. */
const SATURATED_LEVEL = 1.5;
/** Smallest believable position error, arcseconds: for a normal source, and for a saturated one. */
const PIXEL_FLOOR = 0.25;
const SATURATED_FLOOR = 1.0;

/**
 * Locate a source in a summed image near an expected sky offset.
 * Uses a Gaussian-windowed centroid, repeated until it settles.
 * Saturated pixels (stored as Infinity) are the brightest part of a bright star. They are
 * counted at a level above the brightest measured pixel, so the core still anchors the position.
 */
export function locate(stack: Stack, expected: [number, number]): { east: number; north: number; err: number; snr: number; saturated: boolean } | null {
  const scale = Math.abs(stack.m[0]);
  // The brightest measured pixel near the expected spot sets the level given to saturated ones.
  let cap = 0;
  let saturatedPixels = 0;
  const reach = 3 * WINDOW_SIGMA;
  for (let j = 0; j < stack.ny; j++) {
    const dn = (j - stack.cy) * scale - expected[1];
    if (Math.abs(dn) > reach) continue;
    for (let i = 0; i < stack.nx; i++) {
      const de = -(i - stack.cx) * scale - expected[0];
      if (Math.abs(de) > reach) continue;
      const value = stack.image[j * stack.nx + i];
      if (value === Infinity) saturatedPixels++;
      else if (value > cap) cap = value;
    }
  }
  const saturated = saturatedPixels >= 2;
  const fill = cap * SATURATED_LEVEL;

  let east = expected[0];
  let north = expected[1];
  let peak = 0;
  for (let round = 0; round < 12; round++) {
    let total = 0;
    let sumEast = 0;
    let sumNorth = 0;
    peak = 0;
    for (let j = 0; j < stack.ny; j++) {
      const pixelNorth = (j - stack.cy) * scale;
      const dn = pixelNorth - north;
      if (Math.abs(dn) > reach) continue;
      for (let i = 0; i < stack.nx; i++) {
        const pixelEast = -(i - stack.cx) * scale;
        const de = pixelEast - east;
        if (Math.abs(de) > reach) continue;
        let value = stack.image[j * stack.nx + i];
        if (value === Infinity) value = fill;
        if (!(value > 0)) continue; // also skips NaN
        const weight = Math.exp(-(de * de + dn * dn) / (2 * WINDOW_SIGMA * WINDOW_SIGMA)) * value;
        total += weight;
        sumEast += weight * pixelEast;
        sumNorth += weight * pixelNorth;
        if (value > peak && de * de + dn * dn < WINDOW_SIGMA * WINDOW_SIGMA) peak = value;
      }
    }
    if (!(total > 0)) return null;
    const nextEast = sumEast / total;
    const nextNorth = sumNorth / total;
    const moved = Math.hypot(nextEast - east, nextNorth - north);
    east = nextEast;
    north = nextNorth;
    if (moved < 0.005) break;
  }
  if (Math.hypot(east - expected[0], north - expected[1]) > SEARCH_RADIUS) return null;
  const snr = stack.rms > 0 ? peak / stack.rms : 0;
  // A centroid is good to about the source width divided by its signal-to-noise, but never
  // better than the floor set by the coarse pixels. A saturated core is worse still.
  const floor = saturated ? SATURATED_FLOOR : PIXEL_FLOOR;
  return { east, north, err: snr > 0 ? Math.hypot(WINDOW_SIGMA / snr, floor) : Infinity, snr, saturated };
}

/** Weighted straight-line fit y = a + b t. Returns the slope and its uncertainty. */
function slope(t: number[], y: number[], err: number[]): { rate: number; rateErr: number } {
  let s = 0, st = 0, sy = 0, stt = 0, sty = 0;
  for (let i = 0; i < t.length; i++) {
    const w = 1 / (err[i] * err[i]);
    s += w;
    st += w * t[i];
    sy += w * y[i];
    stt += w * t[i] * t[i];
    sty += w * t[i] * y[i];
  }
  const det = s * stt - st * st;
  return { rate: (s * sty - st * sy) / det, rateErr: Math.sqrt(s / det) };
}

/** A compass word for a direction in degrees from north through east. */
export function compass(angle: number): string {
  const names = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return names[Math.round((((angle % 360) + 360) % 360) / 45) % 8];
}

/** Measure the motion of the source at the target position, using the frames that pass the current filters. */
export function measureMotion(state: AppState): MotionFit | null {
  if (!state.target || state.target.moving) return null;
  const parallax = state.target.parallax ?? 0;
  const groups = new Map<number, number[]>();
  for (const frame of state.frames) {
    if (frame.status !== "ready" || !passes(frame, state.filters)) continue;
    const group = groups.get(frame.season);
    if (group) group.push(frame.id);
    else groups.set(frame.season, [frame.id]);
  }
  const points: MotionPoint[] = [];
  for (const [season, ids] of groups) {
    if (ids.length < MIN_IMAGES) continue;
    const sum = fixedSum(ids, `motion${season}`, state);
    if (!sum) continue;
    const found = locate(sum.stack, sum.expected);
    if (!found || found.snr < MIN_SNR) continue;
    const mjd = ids.reduce((total, id) => total + state.frames[id].mjd, 0) / ids.length;
    // A nearby object also swings back and forth each year (parallax). When the target's
    // parallax is known, take that swing out so it is not mistaken for motion.
    if (parallax) {
      let pe = 0;
      let pn = 0;
      for (const id of ids) {
        pe += state.frames[id].parallaxFactor?.[0] ?? 0;
        pn += state.frames[id].parallaxFactor?.[1] ?? 0;
      }
      found.east -= (parallax / 1000) * (pe / ids.length);
      found.north -= (parallax / 1000) * (pn / ids.length);
    }
    points.push({ season, mjd, ...found });
  }
  if (points.length < 2) return null;
  points.sort((a, b) => a.mjd - b.mjd);

  const years = points.map((p) => mjdToYear(p.mjd));
  const errors = points.map((p) => Math.max(p.err, 0.05));
  const east = slope(years, points.map((p) => p.east), errors);
  const north = slope(years, points.map((p) => p.north), errors);
  const speed = Math.hypot(east.rate, north.rate);
  const target = state.target;
  const catalog = target.pmRa !== undefined && target.pmDec !== undefined
    ? { speed: Math.hypot(target.pmRa, target.pmDec) / 1000, angle: ((Math.atan2(target.pmRa, target.pmDec) * 180) / Math.PI + 360) % 360 }
    : null;
  return {
    points,
    rateEast: east.rate,
    rateNorth: north.rate,
    speed,
    speedErr: speed > 0 ? Math.hypot(east.rate * east.rateErr, north.rate * north.rateErr) / speed : Math.hypot(east.rateErr, north.rateErr),
    angle: ((Math.atan2(east.rate, north.rate) * 180) / Math.PI + 360) % 360,
    catalog,
    saturated: points.some((p) => p.saturated),
    parallaxRemoved: parallax > 0,
  };
}
