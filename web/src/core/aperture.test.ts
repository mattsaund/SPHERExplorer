// Tests for measuring the light in a circle.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { measureAperture, measureRing } from "./aperture";
import type { FramePixels } from "./pixels";
import type { Frame } from "./types";

/** Float32 to a float16 bit pattern, enough for test values. */
function toHalf(value: number): number {
  const f = new Float32Array([value]);
  const bits = new Uint32Array(f.buffer)[0];
  const sign = (bits >> 16) & 0x8000;
  const exponent = ((bits >> 23) & 0xff) - 127 + 15;
  const fraction = (bits >> 13) & 0x3ff;
  if (value !== value) return 0x7e00;
  if (exponent <= 0) return sign;
  if (exponent >= 31) return sign | 0x7c00;
  return sign | (exponent << 10) | fraction;
}

function scene(sky: number, add: (x: number, y: number) => number, size = 61) {
  const half = new Uint16Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) half[y * size + x] = toHalf(sky + add(x, y));
  const pixels: FramePixels = { nx: size, ny: size, half, flags: new Uint32Array(size * size) };
  const frame = {
    id: 0, key: "k", collection: "c", obsId: "o", detector: 4, mjd: 60800, wavelength: 3, bandwidth: 0.1, channel: 60, season: 0,
    track: { ra: 0, dec: 0 }, status: "ready", cx: 30, cy: 30, m: [6, 0, 0, 6], rms: 0.01,
  } as unknown as Frame;
  return { frame, pixels };
}

// One pixel of 36 square arcseconds at 1 MJy/sr is 846 microjansky.
const PER_PIXEL = 36 * 1e12 * (Math.PI / 180 / 3600) ** 2;

describe("measureAperture", () => {
  it("sums a compact source and removes the sky", () => {
    // 100 units spread over a 3 by 3 block at the center, on a sky of 0.5.
    const { frame, pixels } = scene(0.5, (x, y) => (Math.abs(x - 30) <= 1 && Math.abs(y - 30) <= 1 ? 100 / 9 : 0));
    const out = measureAperture(frame, pixels, 0, 0, 18, 0)!;
    expect(out.flux / PER_PIXEL).toBeCloseTo(100, 0);
    expect(out.sky).toBeCloseTo(0.5, 3);
    expect(out.good).toBe(true);
    expect(out.err).toBeGreaterThan(0);
  });

  it("gives zero on empty sky and scales with the circle on a flat glow", () => {
    const flat = scene(2, () => 0);
    expect(Math.abs(measureAperture(flat.frame, flat.pixels, 0, 0, 12, 0)!.flux / PER_PIXEL)).toBeLessThan(0.05);
    // A uniform disk of surface brightness 1 out to 5 pixels: a circle of radius 3 pixels holds pi * 9.
    const disk = scene(0, (x, y) => (Math.hypot(x - 30, y - 30) <= 5 ? 1 : 0));
    const out = measureAperture(disk.frame, disk.pixels, 0, 0, 18, 0)!;
    expect(out.flux / PER_PIXEL).toBeGreaterThan(26);
    expect(out.flux / PER_PIXEL).toBeLessThan(30.5);
  });

  it("follows the pixel-to-sky matrix, including a flipped frame", () => {
    // A source 2 pixels to the +x side. With east = -6 * dx, it lies 12 arcsec west.
    const { frame, pixels } = scene(0, (x, y) => (x === 32 && y === 30 ? 50 : 0));
    (frame as { m: number[] }).m = [-6, 0, 0, 6];
    expect(measureAperture(frame, pixels, -12, 0, 9, 0)!.flux / PER_PIXEL).toBeCloseTo(50, 0);
    expect(Math.abs(measureAperture(frame, pixels, 12, 0, 9, 0)!.flux / PER_PIXEL)).toBeLessThan(0.5);
  });

  it("marks a circle that holds saturated or flagged pixels, and refuses one that leaves the frame", () => {
    const { frame, pixels } = scene(0, (x, y) => (x === 30 && y === 30 ? NaN : 0));
    expect(measureAperture(frame, pixels, 0, 0, 12, 0)!.good).toBe(false);
    const flagged = scene(0, () => 0);
    flagged.pixels.flags![30 * 61 + 31] = 4;
    expect(measureAperture(flagged.frame, flagged.pixels, 0, 0, 12, 4)!.good).toBe(false);
    expect(measureAperture(flagged.frame, flagged.pixels, 170, 0, 12, 4)).toBeNull();
  });
});

describe("measureRing", () => {
  // A star with a bright core and a faint flat halo out to 6 pixels.
  const halo = (x: number, y: number) => {
    const r = Math.hypot(x - 30, y - 30);
    return r < 1.5 ? 5000 : r <= 6.5 ? 2 : 0;
  };
  it("measures the halo and ignores the core", () => {
    const { frame, pixels } = scene(0.5, halo);
    const out = measureRing(frame, pixels, 0, 0, 18, 36, 0)!;
    // The ring from 3 to 6 pixels holds about 85 pixels of 2 units each.
    expect(out.flux / PER_PIXEL).toBeGreaterThan(150);
    expect(out.flux / PER_PIXEL).toBeLessThan(190);
    expect(out.sky).toBeCloseTo(0.5, 2);
    // A halo twice as bright gives twice the signal, whatever the core does.
    const doubled = scene(0.5, (x, y) => 2 * halo(x, y));
    expect(measureRing(doubled.frame, doubled.pixels, 0, 0, 18, 36, 0)!.flux / out.flux).toBeCloseTo(2, 2);
  });
  it("fills in for a few bad pixels and gives up when most of the ring is bad", () => {
    const { frame, pixels } = scene(0.5, halo);
    const clean = measureRing(frame, pixels, 0, 0, 18, 36, 0)!;
    // A flagged column through the star, as charge bloom leaves.
    for (let y = 0; y < 61; y++) pixels.flags![y * 61 + 30] = 1;
    const bloomed = measureRing(frame, pixels, 0, 0, 18, 36, 1)!;
    expect(bloomed.flux / clean.flux).toBeCloseTo(1, 1);
    // With most of the ring flagged there is too little left to stand for the whole.
    for (let k = 0; k < pixels.flags!.length; k++) if (k % 3) pixels.flags![k] = 1;
    expect(measureRing(frame, pixels, 0, 0, 18, 36, 1)).toBeNull();
  });
  it("fills a missing pixel from its own distance, so a growing bad core does not change the answer", () => {
    // A halo that fades steeply, like a real one, with the inner part of the ring flagged.
    const steep = (x: number, y: number) => 4000 / (1 + (x - 30) ** 2 + (y - 30) ** 2) ** 1.5;
    const whole = scene(0.5, steep);
    const clean = measureRing(whole.frame, whole.pixels, 0, 0, 18, 36, 1)!;
    const bitten = scene(0.5, steep);
    // A wedge of the ring is bad, as when a bright core spills to one side.
    for (let y = 0; y < 61; y++) for (let x = 31; x < 61; x++) if (Math.abs(y - 30) <= 2) bitten.pixels.flags![y * 61 + x] = 1;
    const filled = measureRing(bitten.frame, bitten.pixels, 0, 0, 18, 36, 1)!;
    expect(filled.flux / clean.flux).toBeGreaterThan(0.95);
    expect(filled.flux / clean.flux).toBeLessThan(1.05);
  });
  it("needs room for the ring and its sky", () => {
    const { frame, pixels } = scene(0.5, halo);
    expect(measureRing(frame, pixels, 120, 0, 18, 36, 0)).toBeNull();
  });
});
