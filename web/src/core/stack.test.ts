// Tests for summing frames and building the playable sequence.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { buildSequence } from "./sequence";
import { robustNoise, stackFrames, startStack, type StackMember } from "./stack";
import type { Filters, Frame } from "./types";

/** A frame-sized member with a single bright pixel at a sky offset, drawn through a given matrix. */
function member(m: [number, number, number, number], starEast: number, starNorth: number, value: number, rms = 1): StackMember {
  const nx = 41, ny = 41, cx = 20, cy = 20;
  const image = new Float32Array(nx * ny);
  const [a, b, c, d] = m;
  const det = a * d - b * c;
  const px = Math.round(cx + (d * starEast - b * starNorth) / det);
  const py = Math.round(cy + (-c * starEast + a * starNorth) / det);
  image[py * nx + px] = value;
  return { nx, ny, cx, cy, m, bg: 0, rms, image, flags: null, shift: [0, 0] };
}

const options = { size: 120, scale: 6, method: "mean" as const, badMask: 0 };

describe("stackFrames", () => {
  it("puts north up and east left whatever the frame orientation", () => {
    // One frame with east along +x, another rotated 180 degrees. The star is 18 arcsec east, 12 north.
    const upright = stackFrames([member([6, 0, 0, 6], 18, 12, 10)], options);
    const flipped = stackFrames([member([-6, 0, 0, -6], 18, 12, 10)], options);
    for (const stack of [upright, flipped]) {
      const peak = stack.image.indexOf(10);
      const x = peak % stack.nx, y = Math.floor(peak / stack.nx);
      expect(x - stack.cx).toBe(-3); // east is to the left
      expect(y - stack.cy).toBe(2); // north is up (larger y)
    }
  });

  it("averages aligned frames and weights by noise", () => {
    const stack = stackFrames([member([6, 0, 0, 6], 0, 0, 10, 1), member([-6, 0, 0, -6], 0, 0, 20, 2)], options);
    // Weights 1 and 1/4: (10 + 20/4) / 1.25 = 12
    expect(stack.image[stack.cy * stack.nx + stack.cx]).toBeCloseTo(12, 5);
    expect(stack.count).toBe(2);
  });

  it("follows a moving target when members carry a shift", () => {
    // The star sits 12 arcsec east in the second frame. Shifting that frame re-centers it.
    const first = member([6, 0, 0, 6], 0, 0, 10);
    const second = { ...member([6, 0, 0, 6], 12, 0, 10), shift: [12, 0] as [number, number] };
    const stack = stackFrames([first, second], options);
    expect(stack.image[stack.cy * stack.nx + stack.cx]).toBeCloseTo(10, 5);
  });

  it("skips flagged and empty pixels", () => {
    const flagged = member([6, 0, 0, 6], 0, 0, 100);
    flagged.flags = new Uint32Array(flagged.image.length);
    flagged.flags[20 * 41 + 20] = 4;
    const empty = member([6, 0, 0, 6], 0, 0, NaN);
    const good = member([6, 0, 0, 6], 0, 0, 7);
    const stack = stackFrames([flagged, empty, good], { ...options, badMask: 4 });
    expect(stack.image[stack.cy * stack.nx + stack.cx]).toBeCloseTo(7, 5);
  });

  it("clipped mean drops a one-frame artifact but keeps honest scatter", () => {
    const steady = [4.8, 5.1, 5.0, 4.9, 5.2, 5.0].map((v) => member([6, 0, 0, 6], 0, 0, v));
    const hit = member([6, 0, 0, 6], 0, 0, 900);
    const clipped = stackFrames([...steady, hit], { ...options, method: "clipped" });
    expect(clipped.image[clipped.cy * clipped.nx + clipped.cx]).toBeCloseTo(5.0, 5);
    // A source whose brightness really varies from frame to frame is not clipped away.
    const varied = [10, 60, 25, 90, 40, 75, 15].map((v) => member([6, 0, 0, 6], 0, 0, v));
    const kept = stackFrames(varied, { ...options, method: "clipped" });
    expect(kept.image[kept.cy * kept.nx + kept.cx]).toBeCloseTo(45, 5);
  });

  it("clips artifacts in large sets without keeping every sample", () => {
    // 100 steady frames with small scatter, plus three wild ones.
    const steady = Array.from({ length: 100 }, (_, i) => member([6, 0, 0, 6], 0, 0, 5 + ((i % 5) - 2) * 0.05));
    const wild = [member([6, 0, 0, 6], 0, 0, 900), member([6, 0, 0, 6], 0, 0, -400), member([6, 0, 0, 6], 0, 0, 2500)];
    const stack = stackFrames([...steady, ...wild], { ...options, method: "clipped" });
    expect(stack.image[stack.cy * stack.nx + stack.cx]).toBeCloseTo(5.0, 2);
    // The plain mean is pulled far off by the same three frames.
    const plain = stackFrames([...steady, ...wild], { ...options, method: "mean" });
    expect(plain.image[plain.cy * plain.nx + plain.cx]).toBeGreaterThan(20);
  });

  it("marks uncovered pixels NaN and covered-but-unusable pixels Infinity", () => {
    const saturated = member([6, 0, 0, 6], 0, 0, NaN);
    const stack = stackFrames([saturated], options);
    expect(stack.image[stack.cy * stack.nx + stack.cx]).toBe(Infinity);
    // A frame only 41 pixels wide cannot cover the corner of a much larger field.
    const wide = stackFrames([member([6, 0, 0, 6], 0, 0, 5)], { ...options, size: 600 });
    expect(wide.image[0]).toBeNaN();
    expect(Number.isFinite(wide.rms) || Number.isNaN(wide.rms)).toBe(true);
  });

  it("median rejects a one-frame artifact", () => {
    const frames = [0, 0, 0, 0].map(() => member([6, 0, 0, 6], 0, 0, 5));
    frames.push(member([6, 0, 0, 6], 0, 0, 500));
    const stack = stackFrames(frames, { ...options, method: "median" });
    expect(stack.image[stack.cy * stack.nx + stack.cx]).toBe(5);
  });
});

// ---- The fast code against the plain definition ------------------------------------------------
// stackFrames is written for speed: it works a band of rows at a time and sorts by hand.
// plainStack below says the same thing in the most direct way, one output pixel at a time.
// The two must agree to the last bit, on awkward input too.

/** A small repeatable random source, so a failure can be run again. */
function randomSource(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Frames with random turns, offsets, noise, empty pixels, flags, and a few frames that cannot be used. */
function awkwardMembers(count: number, seed: number): StackMember[] {
  const random = randomSource(seed);
  const nx = 31;
  return Array.from({ length: count }, (_, k) => {
    const angle = random() * 2 * Math.PI;
    const s = 6.15 * (0.98 + 0.04 * random());
    const image = new Float32Array(nx * nx);
    const flags = k % 5 === 4 ? null : new Uint32Array(nx * nx);
    const bg = 0.2 + 0.2 * random();
    for (let i = 0; i < image.length; i++) {
      const r = random();
      image[i] = r < 0.01 ? NaN : bg + (random() - 0.5) * 0.06 + (r > 0.99 ? 5 * random() : 0);
      if (flags && r > 0.95) flags[i] = 1 << Math.floor(random() * 6);
    }
    return {
      nx, ny: nx,
      // Half the sets sit well off center, so parts of the field have no frame at all.
      cx: 15 + (seed % 2 ? (random() - 0.5) * 24 : (random() - 0.5) * 3),
      cy: 15 + (seed % 2 ? (random() - 0.5) * 24 : (random() - 0.5) * 3),
      m: [-s * Math.cos(angle), s * Math.sin(angle), s * Math.sin(angle), s * Math.cos(angle)] as [number, number, number, number],
      bg,
      rms: k % 11 === 10 ? 0 : 0.01 + 0.02 * random(), // a frame with no noise estimate is left out
      image, flags,
      shift: [(random() - 0.5) * 30, (random() - 0.5) * 30] as [number, number],
    };
  });
}

/** Median by sorting a copy. */
function sortedMedian(values: number[]): number {
  const sorted = Float32Array.from(values).sort();
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/** The sum, written one output pixel at a time with nothing clever. */
function plainStack(members: StackMember[], options: { size: number; scale: number; method: "mean" | "clipped" | "median"; badMask: number }): Float32Array {
  const n = Math.max(3, Math.round(options.size / options.scale) | 1);
  const center = (n - 1) / 2;
  const image = new Float32Array(n * n);
  const keepSamples = options.method === "median" || (options.method === "clipped" && members.length <= 48);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const values: number[] = [];
      const weights: number[] = [];
      let covered = 0;
      for (const member of members) {
        const [a, b, c, d] = member.m;
        const det = a * d - b * c;
        if (!det || !(member.rms > 0)) continue;
        const north = (j - center) * options.scale + member.shift[1];
        const east = -(i - center) * options.scale + member.shift[0];
        const px = Math.round(member.cx + (d / det) * east + (-b / det) * north);
        const py = Math.round(member.cy + (-c / det) * east + (a / det) * north);
        if (px < 0 || py < 0 || px >= member.nx || py >= member.ny) continue;
        covered++;
        const value = member.image[py * member.nx + px];
        if (Number.isNaN(value) || (member.flags && member.flags[py * member.nx + px] & options.badMask)) continue;
        values.push(value - member.bg);
        weights.push(1 / (member.rms * member.rms));
      }
      const out = j * n + i;
      if (!values.length) {
        image[out] = covered ? Infinity : NaN;
      } else if (keepSamples) {
        const single = values.map(Math.fround);
        const middle = sortedMedian(single);
        if (options.method === "median") {
          image[out] = middle;
          continue;
        }
        const limit = single.length >= 5 ? 4.5 * 1.4826 * sortedMedian(single.map((v) => Math.abs(v - middle))) : Infinity;
        let top = 0;
        let bottom = 0;
        single.forEach((v, k) => {
          if (Math.abs(v - middle) > limit) return;
          top += weights[k] * v;
          bottom += weights[k];
        });
        image[out] = bottom > 0 ? top / bottom : middle;
      } else {
        let mean = 0;
        let limit = Infinity;
        let kept = values.length;
        for (let round = 0; options.method === "clipped" && round < 3; round++) {
          const inside = values.filter((v) => !(Math.abs(v - mean) > limit));
          kept = inside.length;
          if (!kept) continue;
          const plain = inside.reduce((sum, v) => sum + v, 0);
          const squares = inside.reduce((sum, v) => sum + v * v, 0);
          mean = Math.fround(plain / kept);
          limit = Math.fround(3.5 * Math.sqrt(Math.max(0, squares / kept - mean * mean)));
        }
        let sum = 0;
        let weight = 0;
        values.forEach((v, k) => {
          if (Math.abs(v - mean) > limit) return;
          sum += weights[k] * v;
          weight += weights[k];
        });
        image[out] = weight > 0 ? sum / weight : kept ? mean : Infinity;
      }
    }
  }
  return image;
}

/** How many values differ in their bits. Two NaNs count as the same. */
function differing(a: Float32Array, b: Float32Array): number {
  let count = 0;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) count++;
  return a.length === b.length ? count : Infinity;
}

describe("stackFrames against the plain definition", () => {
  for (const method of ["mean", "clipped", "median"] as const) {
    // 48 and 49 frames sit on either side of the switch between the two ways of clipping.
    it(`${method}: the same bits for 1 to 80 frames, turned, shifted, flagged, and partly off the field`, () => {
      for (const count of [1, 2, 5, 9, 48, 49, 80]) {
        for (const seed of [1, 2]) {
          const members = awkwardMembers(count, 100 * count + seed);
          for (const size of [70, 190]) {
            const settings = { size, scale: 3.075, method, badMask: seed === 2 ? 0 : 0b1101 };
            expect(differing(stackFrames(members, settings).image, plainStack(members, settings))).toBe(0);
          }
        }
      }
    });
  }

  it("gives the same image when the work is split into many tiles", () => {
    // Many frames on a field wide enough that the sum is worked in dozens of tiles.
    const members = awkwardMembers(60, 7);
    const settings = { size: 400, scale: 0.5, method: "clipped" as const, badMask: 0b1101 };
    expect(startStack(members, settings).tiles).toBeGreaterThan(30);
    expect(differing(stackFrames(members, settings).image, plainStack(members, settings))).toBe(0);
  });

  it("can be worked a tile at a time, in any order", () => {
    // A sum made in the background is worked in pieces. The order of the pieces must not matter.
    const members = awkwardMembers(80, 11);
    const settings = { size: 300, scale: 1, method: "clipped" as const, badMask: 0b1101 };
    const whole = stackFrames(members, settings);
    const job = startStack(members, settings);
    expect(job.tiles).toBeGreaterThan(4);
    for (let index = job.tiles - 1; index >= 0; index -= 2) job.work(index);
    for (let index = job.tiles - 2; index >= 0; index -= 2) job.work(index);
    const pieced = job.finish();
    expect(differing(pieced.image, whole.image)).toBe(0);
    expect(pieced.rms).toBe(whole.rms);
    expect(pieced.count).toBe(80);
  });
});

describe("robustNoise", () => {
  it("finds the same median and spread as sorting does", () => {
    const random = randomSource(42);
    for (const length of [1, 2, 3, 10, 11, 1000, 1001]) {
      const values = Float32Array.from({ length }, () => (random() < 0.1 ? NaN : random() < 0.05 ? Infinity : Math.round(random() * 40) / 8));
      const finite = Array.from(values).filter(Number.isFinite);
      const { median, rms } = robustNoise(values);
      if (!finite.length) {
        expect(median).toBeNaN();
        continue;
      }
      const middle = sortedMedian(finite);
      expect(median).toBe(middle);
      expect(rms).toBe(1.4826 * sortedMedian(finite.map((v) => Math.fround(Math.abs(v - middle)))));
    }
  });

  it("ignores outliers and empty pixels", () => {
    const values = new Float32Array(1001);
    for (let i = 0; i < 1000; i++) values[i] = (i % 2 ? 1 : -1) * 0.6745; // MAD of 0.6745 gives rms 1
    values[1000] = NaN;
    values[0] = 1e6;
    const { median, rms } = robustNoise(values);
    expect(Math.abs(median)).toBeLessThanOrEqual(0.6745);
    expect(rms).toBeCloseTo(1, 1);
  });
});

describe("buildSequence", () => {
  const filters: Filters = { detectors: [true, true, true, true, true, true], wlMin: 0.7, wlMax: 5.1 };
  const frame = (id: number, detector: number, mjd: number, wavelength: number, channel: number, season: number, status: Frame["status"] = "ready"): Frame => ({
    id, key: `k${id}`, collection: "spherex_dr1", obsId: `o${id}`, detector, mjd, wavelength, bandwidth: 0.03, channel, season,
    track: { ra: 0, dec: 0 }, status,
  });
  const frames = [
    frame(0, 1, 60800, 0.8, 2, 0), frame(1, 6, 60801, 4.6, 93, 0), frame(2, 6, 60980, 4.61, 93, 1),
    frame(3, 6, 60981, 4.9, 100, 1, "pending"),
  ];

  it("lists ready exposures in time order", () => {
    const sequence = buildSequence(frames, "exposures", filters);
    expect(sequence.map((s) => s.frameIds)).toEqual([[0], [1], [2]]);
  });
  it("groups by visit and by channel", () => {
    expect(buildSequence(frames, "visits", filters).map((s) => s.frameIds)).toEqual([[0, 1], [2]]);
    expect(buildSequence(frames, "channels", filters).map((s) => s.frameIds)).toEqual([[0], [1, 2]]);
  });
  it("applies detector and wavelength filters", () => {
    const onlySix = { ...filters, detectors: [false, false, false, false, false, true] };
    expect(buildSequence(frames, "exposures", onlySix).map((s) => s.frameIds)).toEqual([[1], [2]]);
    expect(buildSequence(frames, "exposures", { ...filters, wlMax: 1 }).map((s) => s.frameIds)).toEqual([[0]]);
  });
  it("changes a sum's key when its members change", () => {
    const before = buildSequence(frames, "visits", filters)[1].key;
    const after = buildSequence(frames.map((f) => (f.id === 3 ? { ...f, status: "ready" as const } : f)), "visits", filters)[1].key;
    expect(after).not.toBe(before);
  });
});
