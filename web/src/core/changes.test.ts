// Tests for the change finder: source detection, motion fits, like-wavelength brightness
// comparison, and a whole synthetic field with a mover, a variable, and a newcomer.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { channelAt, chooseEpochs, compareVisit, describeChange, detectSources, findChanges, fitMotion, saturatedPatches, type ChannelSum } from "./changes";
import { setPixels } from "./pixels";
import type { Stack } from "./stack";
import { useStore, type AppState } from "./store";
import type { Frame, Meta, Visit } from "./types";

/** A repeatable random number source, so the tests never flicker. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal noise from two uniform draws. */
function normal(next: () => number): number {
  return Math.sqrt(-2 * Math.log(next() + 1e-12)) * Math.cos(2 * Math.PI * next());
}

/** Float32 to a float16 bit pattern. */
function toHalf(value: number): number {
  if (value !== value) return 0x7e00;
  const bits = new Uint32Array(new Float32Array([value]).buffer)[0];
  const sign = (bits >> 16) & 0x8000;
  const exponent = ((bits >> 23) & 0xff) - 127 + 15;
  if (exponent <= 0) return sign;
  if (exponent >= 31) return sign | 0x7c00;
  return sign | (exponent << 10) | ((bits >> 13) & 0x3ff);
}

/** Error function, good to about 1e-7. */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/** Share of a Gaussian source that lands in the pixel centered at (x, y). Sizes in pixels. */
function share(x: number, y: number, sx: number, sy: number, sigma: number): number {
  const part = (c: number, s: number) => 0.5 * (erf((c + 0.5 - s) / (Math.SQRT2 * sigma)) - erf((c - 0.5 - s) / (Math.SQRT2 * sigma)));
  return part(x, sx) * part(y, sy);
}

function gaussianStack(sources: { east: number; north: number; peak: number }[], size = 97, scale = 3.075, noise = 0): Stack {
  const center = (size - 1) / 2;
  const next = random(7);
  const image = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let value = noise ? noise * normal(next) : 0;
      for (const s of sources) {
        const de = -(i - center) * scale - s.east;
        const dn = (j - center) * scale - s.north;
        value += s.peak * Math.exp(-(de * de + dn * dn) / (2 * 3.5 * 3.5));
      }
      image[j * size + i] = value;
    }
  }
  return { nx: size, ny: size, cx: center, cy: center, m: [-scale, 0, 0, scale], image, rms: noise || 1, count: 10 };
}

describe("detectSources", () => {
  it("finds separate sources, brightest first, and merges close peaks", () => {
    const stack = gaussianStack([
      { east: 40, north: -30, peak: 30 },
      { east: -60, north: 55, peak: 80 },
      { east: -55, north: 58, peak: 20 },   // 5.8 arcsec from the one above: the same source
      { east: 10, north: 12, peak: 6 },
    ], 97, 3.075, 0.5);
    const found = detectSources(stack);
    expect(found).toHaveLength(3);
    expect(found[0].east).toBeCloseTo(-60, -1);
    expect(found[0].north).toBeCloseTo(55, -1);
    expect(found[1].east).toBeCloseTo(40, -1);
    expect(found[2].north).toBeCloseTo(12, -1);
    expect(found[0].snr).toBeGreaterThan(found[1].snr);
  });
  it("skips the field edge, treats a saturated core as a peak, and finds nothing in plain noise", () => {
    const stack = gaussianStack([{ east: 140, north: 0, peak: 50 }, { east: 0, north: 0, peak: 400 }], 97, 3.075, 0.5);
    for (let k = 0; k < stack.image.length; k++) if (stack.image[k] > 200) stack.image[k] = Infinity;
    const found = detectSources(stack);
    expect(found).toHaveLength(1);
    expect(Math.hypot(found[0].east, found[0].north)).toBeLessThan(4);
    expect(detectSources(gaussianStack([], 97, 3.075, 0.5))).toHaveLength(0);
  });
});

describe("saturatedPatches", () => {
  it("turns a saturated core into one patch at its middle, however ragged its edge", () => {
    const stack = gaussianStack([{ east: 20, north: -10, peak: 4000 }, { east: -90, north: 80, peak: 300 }, { east: 60, north: 60, peak: 20 }], 97, 3.075, 0.5);
    for (let k = 0; k < stack.image.length; k++) if (stack.image[k] > 200) stack.image[k] = Infinity;
    // One lone saturated pixel elsewhere is a defect, not a star.
    stack.image[5 * 97 + 5] = Infinity;
    const patches = saturatedPatches(stack);
    expect(patches).toHaveLength(2);
    // The middle of a patch is good to about half an output pixel.
    expect(Math.abs(patches[0].east - 20)).toBeLessThan(1.6);
    expect(Math.abs(patches[0].north + 10)).toBeLessThan(1.6);
    // The 4000-unit star is past the limit out to about 8.6 arcsec.
    expect(patches[0].radius).toBeGreaterThan(7);
    expect(patches[0].radius).toBeLessThan(12);
    expect(patches[0].pixels).toBeGreaterThan(patches[1].pixels);
    expect(Math.abs(patches[1].east + 90)).toBeLessThan(1.6);
    expect(saturatedPatches(gaussianStack([{ east: 0, north: 0, peak: 50 }]))).toEqual([]);
  });
});

describe("fitMotion", () => {
  it("recovers a steady drift and its significance", () => {
    const points = [0, 0.5, 1].map((t) => ({ year: 2025.4 + t, east: 3 - 8 * t, north: -1 + 0.6 * t, err: 0.3 }));
    const line = fitMotion(points)!;
    expect(line.rateEast).toBeCloseTo(-8, 6);
    expect(line.rateNorth).toBeCloseTo(0.6, 6);
    expect(line.errEast).toBeCloseTo(0.3 / Math.sqrt(0.5), 6);
    expect(line.significance).toBeGreaterThan(15);
    expect(line.year).toBeCloseTo(2025.9, 6);
    expect(line.east).toBeCloseTo(-1, 6);
  });
  it("needs two different times", () => {
    expect(fitMotion([{ year: 2025, east: 0, north: 0, err: 1 }])).toBeNull();
    expect(fitMotion([{ year: 2025, east: 0, north: 0, err: 1 }, { year: 2025, east: 1, north: 0, err: 1 }])).toBeNull();
  });
});

describe("compareVisit", () => {
  /** A source measured in `count` channels with a sloped spectrum, in three visits. */
  function sums(gain: number[], count = 20, err = 1): Map<number, Map<number, ChannelSum>> {
    const out = new Map<number, Map<number, ChannelSum>>();
    gain.forEach((g, season) => {
      const channels = new Map<number, ChannelSum>();
      for (let c = 0; c < count; c++) {
        const flux = (100 + 20 * c) * g;
        channels.set(c, { weight: 1 / (err * err), flux: flux / (err * err) });
      }
      out.set(season, channels);
    });
    return out;
  }
  it("measures a visit against the others at the same channels", () => {
    const result = compareVisit(sums([1, 1.3, 1]), 1)!;
    expect(result.ratio).toBeCloseTo(1.3, 6);
    expect(result.channels).toBe(20);
    expect(result.ratioErr).toBeLessThan(0.05);
    expect(compareVisit(sums([1, 1.3, 1]), 0)!.ratio).toBeCloseTo(1 / 1.15, 6);
  });
  it("is not fooled by a visit that covers only the red end", () => {
    const data = sums([1, 1, 1]);
    // Visit 2 saw only the ten reddest, brightest channels. Its plain average is far higher.
    for (let c = 0; c < 10; c++) data.get(2)!.delete(c);
    const result = compareVisit(data, 2)!;
    expect(result.channels).toBe(10);
    expect(result.ratio).toBeCloseTo(1, 6);
  });
  it("needs enough shared channels", () => {
    expect(compareVisit(sums([1, 1], 5), 0)).toBeNull();
    expect(compareVisit(sums([1]), 0)).toBeNull();
  });
  it("can compare one part of the spectrum on its own", () => {
    const data = sums([1, 1, 1]);
    // Visit 1 doubled, but only in channels 10 to 19.
    for (let c = 10; c < 20; c++) data.get(1)!.get(c)!.flux *= 2;
    expect(compareVisit(data, 1, (c) => c < 10, 4)!.ratio).toBeCloseTo(1, 6);
    expect(compareVisit(data, 1, (c) => c >= 10, 4)!.ratio).toBeCloseTo(2, 6);
    expect(compareVisit(data, 1, (c) => c < 3, 4)).toBeNull();
  });
});

describe("chooseEpochs", () => {
  /** Frames for one visit: `channels` channels starting at `first`, one image each, from day `start`. */
  const visit = (season: number, start: number, channels: number, first = 0): Frame[] =>
    Array.from({ length: channels }, (_, i) => ({ id: season * 1000 + i, season, channel: first + i, mjd: start + i * 0.1 }) as unknown as Frame);
  const names = (count: number): Visit[] => Array.from({ length: count }, (_, season) => ({ season, start: 0, end: 0, count: 0, label: `${["May", "Jun", "Jul", "Aug", "Nov"][season]} 2025` }));

  it("keeps ordinary visits as they are", () => {
    const { epochs, skipped } = chooseEpochs([...visit(0, 60800, 100), ...visit(1, 60983, 100), ...visit(2, 61166, 98)], names(3));
    expect(epochs.map((e) => e.label)).toEqual(["May 2025", "Jun 2025", "Jul 2025"]);
    expect(skipped).toEqual([]);
  });
  it("leaves out a visit with thin coverage when it would cost the others their shared wavelengths", () => {
    const { epochs, skipped } = chooseEpochs([...visit(0, 60800, 100), ...visit(1, 60983, 24, 40), ...visit(2, 61166, 100)], names(3));
    expect(epochs.map((e) => e.label)).toEqual(["May 2025", "Jul 2025"]);
    expect(skipped).toEqual(["Jun 2025"]);
  });
  it("leaves out a visit with too few images", () => {
    const { epochs, skipped } = chooseEpochs([...visit(0, 60800, 100), ...visit(1, 60983, 4), ...visit(2, 61166, 100)], names(3));
    expect(epochs).toHaveLength(2);
    expect(skipped).toEqual(["Jun 2025"]);
  });
  it("joins the months of a deep field until each group covers most wavelengths", () => {
    // Four months in a row, each seeing a different quarter of the spectrum, then a full visit later.
    const frames = [...visit(0, 60800, 25, 0), ...visit(1, 60830, 25, 25), ...visit(2, 60860, 25, 50), ...visit(3, 60890, 25, 75), ...visit(4, 61000, 100)];
    const { epochs, skipped } = chooseEpochs(frames, names(5));
    expect(epochs.map((e) => e.label)).toEqual(["May to Aug 2025", "Nov 2025"]);
    expect(epochs[0].seasons).toEqual([0, 1, 2, 3]);
    expect(skipped).toEqual([]);
  });
});

describe("channelAt", () => {
  it("steps the channel with the wavelength drift across the frame, within the detector", () => {
    const frame = { channel: 20, bandwidth: 0.03, dwl: [0.0003, 0], m: [-6.15, 0, 0, 6.15] } as unknown as Frame;
    expect(channelAt(frame, 0, 0)).toBe(20);
    // 615 arcseconds west is 100 pixels, which is 0.03 microns: one channel.
    expect(channelAt(frame, -615, 0)).toBe(21);
    expect(channelAt(frame, 615, 0)).toBe(19);
    expect(channelAt(frame, 6150, 0)).toBe(17);    // never leaves the detector's 17 channels
    expect(channelAt({ channel: 20 } as unknown as Frame, 100, 100)).toBe(20);
  });
});

// ---- A whole synthetic field ----------------------------------------------------------------

interface Star {
  east: number;
  north: number;
  /** Brightness at 1.5 microns in MJy/sr times pixels, and spectral slope. */
  flux: number;
  slope: number;
  /** Motion in arcseconds per year, brightness factor per visit, and the only visit it exists in. */
  motion?: [number, number];
  gain?: number[];
  only?: number;
  /** Brightness factor per visit that applies above 1.1 microns only (detector 2 in these tests). */
  redGain?: number[];
  /** True for a very bright star, drawn with the wide halo that real star images have. */
  halo?: boolean;
}

const PIXEL = 6.15;
const NOISE = 0.02;
const SATURATION = 60;
const VISIT_MJD = [60800, 60983, 61166];

/** Build frames for three visits. Each exposure has its own wavelength, pointing offset, and roll. */
function field(stars: Star[], session: number, channelsPerVisit = [34, 34, 26]): AppState {
  const next = random(1234 + session);
  const frames: Frame[] = [];
  const size = 71;
  VISIT_MJD.forEach((start, season) => {
    for (let channel = 0; channel < channelsPerVisit[season]; channel++) {
      const id = frames.length;
      const wavelength = 0.75 * 1.024 ** channel * (channel >= 17 ? 1.01 : 1);
      const mjd = start + channel * 0.3;
      const years = (mjd - VISIT_MJD[0]) / 365.25;
      // Pointing lands a different fraction of a pixel off each time, and the roll flips between visits.
      const cx = 35 + (next() - 0.5);
      const cy = 35 + (next() - 0.5);
      const roll = ((season % 2 ? 172 : 8) + 6 * (next() - 0.5)) * (Math.PI / 180);
      const m: [number, number, number, number] = [-PIXEL * Math.cos(roll), PIXEL * Math.sin(roll), PIXEL * Math.sin(roll), PIXEL * Math.cos(roll)];
      const det = m[0] * m[3] - m[1] * m[2];
      const half = new Uint16Array(size * size);
      const flags = new Uint32Array(size * size);
      const values = new Float32Array(size * size);
      for (let k = 0; k < values.length; k++) values[k] = 0.3 + NOISE * normal(next);
      for (const star of stars) {
        if (star.only !== undefined && star.only !== season) continue;
        const east = star.east + (star.motion?.[0] ?? 0) * years;
        const north = star.north + (star.motion?.[1] ?? 0) * years;
        const sx = cx + (m[3] * east - m[1] * north) / det;
        const sy = cy + (-m[2] * east + m[0] * north) / det;
        const total = star.flux * (wavelength / 1.5) ** star.slope * (star.gain?.[season] ?? 1) * (channel >= 17 ? star.redGain?.[season] ?? 1 : 1);
        const reach = star.halo ? 30 : 4;
        for (let y = Math.max(0, Math.floor(sy) - reach); y <= Math.min(size - 1, Math.floor(sy) + reach + 1); y++) {
          for (let x = Math.max(0, Math.floor(sx) - reach); x <= Math.min(size - 1, Math.floor(sx) + reach + 1); x++) {
            // A real star image has a core plus a halo that fades as the cube of the distance.
            values[y * size + x] += star.halo ? total / (2 * Math.PI) / (1 + (x - sx) ** 2 + (y - sy) ** 2) ** 1.5 : total * share(x, y, sx, sy, 0.45);
          }
        }
      }
      // Pixels past the detector's range are flagged and hold no usable value.
      for (let k = 0; k < values.length; k++) {
        if (values[k] > SATURATION) {
          values[k] = NaN;
          flags[k] = 1;
        }
        half[k] = toHalf(values[k]);
      }
      setPixels(id, { nx: size, ny: size, half, flags });
      frames.push({
        id, key: `k${id}`, collection: "test", obsId: `o${id}`, detector: channel < 17 ? 1 : 2, mjd, wavelength, bandwidth: wavelength / 41,
        channel, season, track: { ra: 150, dec: 20 }, status: "ready", nx: size, ny: size, cx, cy, m, dwl: [0, 0], bg: 0.3, rms: NOISE,
      } as Frame);
    }
  });
  const meta = { pixelScale: PIXEL, badMask: 1, stackMask: 1 } as unknown as Meta;
  const visits: Visit[] = ["May 2025", "Nov 2025", "May 2026"].map((label, season) => ({ season, start: VISIT_MJD[season], end: VISIT_MJD[season] + 12, count: channelsPerVisit[season], label }));
  return { ...useStore.getState(), session, meta, visits, target: { ra: 150, dec: 20, epoch: 2026 }, frames, fieldSize: 300, fieldObjects: [], follow: false };
}

/** Steady stars spread over the field, with assorted brightness and color. */
function steadyStars(seed: number, count = 14): Star[] {
  const next = random(seed);
  const stars: Star[] = [];
  while (stars.length < count) {
    const east = (next() - 0.5) * 230;
    const north = (next() - 0.5) * 230;
    if (stars.some((s) => Math.hypot(s.east - east, s.north - north) < 30)) continue;
    stars.push({ east, north, flux: 1.5 + 12 * next(), slope: -2 + 3 * next() });
  }
  return stars;
}

describe("findChanges", () => {
  it("reports nothing in a field of steady stars", async () => {
    const report = await findChanges(field(steadyStars(5), 9001));
    expect(report.note).toBeNull();
    expect(report.visits).toEqual(["May 2025", "Nov 2025", "May 2026"]);
    expect(report.skipped).toEqual([]);
    expect(report.channels).toBe(26);
    expect(report.sources).toBeGreaterThanOrEqual(12);
    expect(report.positionReferences).toBeGreaterThanOrEqual(5);
    expect(report.brightnessReferences).toBeGreaterThanOrEqual(5);
    expect(report.positionScatter).toBeLessThan(0.5);
    expect(report.brightnessScatter).toBeLessThan(0.05);
    expect(report.changes).toEqual([]);
  });

  it("finds a mover, a star that brightened, and a newcomer among steady stars", async () => {
    // Keep the three special sources clear of the steady ones.
    const stars = steadyStars(11).filter((s) => [[-70, 60], [80, -75], [10, -20]].every(([e, n]) => Math.hypot(s.east - e, s.north - n) > 35));
    stars.push({ east: -70, north: 60, flux: 4, slope: -1, motion: [-7.5, 2.0] });
    stars.push({ east: 80, north: -75, flux: 5, slope: 0.5, gain: [1, 1.3, 1] });
    stars.push({ east: 10, north: -20, flux: 3, slope: -0.5, only: 2 });
    const report = await findChanges(field(stars, 9002));
    const near = (east: number, north: number) => report.changes.filter((c) => Math.hypot(c.east - east, c.north - north) < 12);

    const moved = near(-74, 61);
    expect(moved.map((c) => c.kind)).toEqual(["moved"]);
    expect(moved[0].rate!).toBeGreaterThan(6.5);
    expect(moved[0].rate!).toBeLessThan(9);
    expect(moved[0].angle!).toBeGreaterThan(270);       // west, a little north
    expect(moved[0].angle!).toBeLessThan(300);
    expect(moved[0].shift!).toBeCloseTo(7.76, 0);
    expect(moved[0].significance).toBeGreaterThan(5);
    expect(describeChange(moved[0])).toMatch(/^Moved 7\.\d arcsec to the west between May 2025 and May 2026\. That is [78]\.\d arcsec per year/);

    const brighter = near(80, -75);
    expect(brighter.map((c) => c.kind)).toEqual(["brightened"]);
    expect(brighter[0].visit).toBe(1);
    expect(brighter[0].ratio!).toBeGreaterThan(1.24);
    expect(brighter[0].ratio!).toBeLessThan(1.36);
    expect(brighter[0].band).toBeNull();
    expect(describeChange(brighter[0])).toMatch(/^(2[5-9]|3[0-5]) percent brighter in Nov 2025 than in the other visits, at the same wavelengths\.$/);

    const newcomer = near(10, -20);
    expect(newcomer.map((c) => c.kind)).toEqual(["appeared"]);
    expect(newcomer[0].visit).toBe(2);
    expect(describeChange(newcomer[0])).toBe("Seen in May 2026 only. It is missing from the other visits.");

    // Nothing else is flagged.
    expect(report.changes).toHaveLength(3);
  });

  it("finds a change that is confined to part of the spectrum", async () => {
    const stars = steadyStars(21).filter((s) => Math.hypot(s.east - 40, s.north - 50) > 35);
    // Fainter in blue light and brighter in red light during the second visit, as dust can do.
    stars.push({ east: 40, north: 50, flux: 6, slope: 0, gain: [1, 0.75, 1], redGain: [1, 2.2, 1] });
    const report = await findChanges(field(stars, 9004));
    expect(report.changes).toHaveLength(1);
    const change = report.changes[0];
    expect(Math.hypot(change.east - 40, change.north - 50)).toBeLessThan(3);
    expect(change.visit).toBe(1);
    const blue = change.bands!.find((band) => band.detector === 1)!;
    const red = change.bands!.find((band) => band.detector === 2)!;
    expect(blue.ratio).toBeCloseTo(0.75, 1);
    expect(red.ratio).toBeCloseTo(0.75 * 2.2, 1);
    expect(blue.range[0]).toBeCloseTo(0.75, 2);
    // The sentence names both directions.
    expect(describeChange(change)).toMatch(/brighter in Nov 2025 .* it was \d+(\.\d)? percent fainter\./);
  });

  it("measures a star too bright for the detector from its halo, and does not call it a mover", async () => {
    const stars = steadyStars(31).filter((s) => Math.hypot(s.east, s.north) > 75);
    // A very bright, wide star in the middle. Its core is past the detector's range in every image.
    stars.push({ east: 0, north: 0, flux: 9000, slope: 0, halo: true, gain: [1, 1, 1.6] });
    const report = await findChanges(field(stars, 9005));
    const star = report.changes.filter((c) => Math.hypot(c.east, c.north) < 12);
    expect(star.map((c) => c.kind)).toEqual(["brightened"]);
    expect(star[0].saturated).toBe(true);
    expect(star[0].halo).toBe(true);
    expect(star[0].visit).toBe(2);
    expect(star[0].ratio!).toBeGreaterThan(1.45);
    expect(star[0].ratio!).toBeLessThan(1.75);
    expect(describeChange(star[0])).toMatch(/outer halo/);
    // Its glare must not turn the steady stars around it into false alarms.
    expect(report.changes.filter((c) => Math.hypot(c.east, c.north) >= 12)).toEqual([]);
  });

  it("says why when there is nothing to compare", async () => {
    const one = field(steadyStars(5), 9003);
    const report = await findChanges({ ...one, frames: one.frames.filter((f) => f.season === 0) });
    expect(report.changes).toEqual([]);
    expect(report.note).toMatch(/one visit/);
    const moving = await findChanges({ ...one, target: { ...one.target!, moving: { command: "599" } } as AppState["target"] });
    expect(moving.note).toMatch(/solar system/);
  });
});
