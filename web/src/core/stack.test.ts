// Tests for summing frames and building the playable sequence.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { buildSequence } from "./sequence";
import { robustNoise, stackFrames, type StackMember } from "./stack";
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

  it("median rejects a one-frame artifact", () => {
    const frames = [0, 0, 0, 0].map(() => member([6, 0, 0, 6], 0, 0, 5));
    frames.push(member([6, 0, 0, 6], 0, 0, 500));
    const stack = stackFrames(frames, { ...options, method: "median" });
    expect(stack.image[stack.cy * stack.nx + stack.cx]).toBe(5);
  });
});

describe("robustNoise", () => {
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
