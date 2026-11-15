// Tests for spectrum assembly and binning.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { LINE_FAMILIES } from "./lines";
import { abMagnitude, binSpectrum, formatFlux, spectrumOf } from "./spectrum";
import type { Frame } from "../types";

function frame(id: number, wavelength: number, channel: number, season: number, flux: number | null, err: number, extra: Partial<Frame["phot"]> = {}): Frame {
  return {
    id, key: `k${id}`, collection: "c", obsId: "o", detector: 5, mjd: 60800 + id, wavelength, bandwidth: 0.03, channel, season,
    track: { ra: 0, dec: 0 }, status: "ready",
    phot: { flux, err, sky: 0.5, skyRms: 0.05, frac: 1, bits: 0, nan: 0, x: 10, y: 10, ...extra },
  };
}

describe("spectrumOf", () => {
  it("keeps measured frames, sorts by wavelength, and marks suspect ones", () => {
    const frames = [
      frame(0, 4.6, 93, 0, 600, 90),
      frame(1, 4.2, 80, 0, 500, 80, { nan: 2 }),
      frame(2, 4.4, 85, 0, null, 80),
      frame(3, 4.0, 74, 0, 300, 70, { bits: 1 << 6 }),
      frame(4, 3.9, 71, 0, 250, 70, { frac: 0.4 }),
      { ...frame(5, 4.1, 77, 0, 280, 60), status: "pending" as const },
    ];
    const points = spectrumOf(frames, 1 << 6);
    expect(points.map((p) => p.frameId)).toEqual([4, 3, 1, 0]);
    expect(points.map((p) => p.good)).toEqual([false, false, false, true]);
  });
});

describe("binSpectrum", () => {
  const frames = [
    frame(0, 4.60, 93, 0, 100, 10), frame(1, 4.61, 93, 0, 120, 10),
    frame(2, 4.60, 93, 1, 200, 10), frame(3, 4.20, 80, 1, 50, 5),
  ];
  const points = spectrumOf(frames, 0);

  it("averages by channel with inverse-variance weights", () => {
    const bins = binSpectrum(points, false);
    expect(bins).toHaveLength(2);
    const bin = bins.find((b) => b.channel === 93)!;
    expect(bin.flux).toBeCloseTo(140, 6);
    expect(bin.count).toBe(3);
    expect(bin.season).toBe(-1);
    // The three values disagree far more than 10 each, so the error grows past the formal 5.77.
    expect(bin.err).toBeGreaterThan(20);
  });

  it("keeps visits apart when asked", () => {
    const bins = binSpectrum(points, true);
    expect(bins.map((b) => [b.season, b.channel, Math.round(b.flux)])).toEqual([[0, 93, 110], [1, 80, 50], [1, 93, 200]]);
  });
});

describe("helpers", () => {
  it("converts and formats flux", () => {
    expect(abMagnitude(3631e6)).toBeCloseTo(0, 2);
    expect(abMagnitude(-5)).toBeNaN();
    expect(formatFlux(570)).toBe("570 µJy");
    expect(formatFlux(27400)).toBe("27.4 mJy");
    expect(formatFlux(2.5e6)).toBe("2.50 Jy");
  });

  it("has a consistent line library", () => {
    const ids = LINE_FAMILIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const family of LINE_FAMILIES) {
      for (const feature of family.features) {
        expect(feature.wavelength).toBeGreaterThan(0.3);
        expect(feature.wavelength).toBeLessThan(5.1);
      }
    }
  });
});
