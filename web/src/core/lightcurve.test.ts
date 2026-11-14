// Tests for the brightness-over-time tool.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { formatChange, lightCurve } from "./lightcurve";
import type { SpectrumPoint } from "./spectrum";

function point(frameId: number, channel: number, season: number, flux: number, err = 1, good = true): SpectrumPoint {
  return { frameId, wavelength: 1 + channel * 0.02, bandwidth: 0.02, flux, err, mjd: 60800 + season * 180 + frameId * 0.01, detector: 1, season, channel, good };
}

describe("lightCurve", () => {
  it("finds a dimming that is the same at every wavelength", () => {
    // A red spectrum (100, 200, 400 across channels) that is 20 percent fainter in the second visit.
    const spectrum = [100, 200, 400];
    const points = spectrum.flatMap((flux, channel) => [point(channel, channel, 0, flux), point(10 + channel, channel, 1, flux * 0.8)]);
    const { visits, points: curve } = lightCurve(points);
    expect(curve).toHaveLength(6);
    expect(visits).toHaveLength(2);
    // Ratios are to the average of both visits, so 1 / 0.9 and 0.8 / 0.9.
    expect(visits[0].ratio).toBeCloseTo(1 / 0.9, 2);
    expect(visits[1].ratio).toBeCloseTo(0.8 / 0.9, 2);
    expect(visits[1].ratio / visits[0].ratio).toBeCloseTo(0.8, 3);
  });

  it("gives a steady source a ratio of one", () => {
    const points = [0, 1, 2, 3].flatMap((channel) => [point(channel, channel, 0, 50 + channel), point(10 + channel, channel, 1, 50 + channel)]);
    for (const visit of lightCurve(points).visits) expect(visit.ratio).toBeCloseTo(1, 6);
  });

  it("leaves out channels seen in one visit, weak channels, and suspect measurements", () => {
    const points = [
      point(0, 0, 0, 100), point(1, 0, 1, 100),   // usable pair
      point(2, 1, 0, 100),                         // only one visit
      point(3, 2, 0, 1, 1), point(4, 2, 1, 1, 1),  // average too weak
      point(5, 0, 1, 500, 1, false),               // flagged
    ];
    expect(lightCurve(points).points.map((p) => p.frameId)).toEqual([0, 1]);
  });
});

describe("formatChange", () => {
  it("formats percent changes", () => {
    expect(formatChange(1.12)).toBe("+12%");
    expect(formatChange(0.955)).toBe("-4.5%");
    expect(formatChange(1)).toBe("+0.0%");
  });
});
