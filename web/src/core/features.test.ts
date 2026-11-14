// Tests for finding spectral features: dips, bumps, what else could explain them, and what
// must not be reported.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { describeFeature, findFeatures, findFeaturesByVisit, fitCurve, robustLine } from "./features";
import { LINE_FAMILIES } from "./lines";
import type { SpectrumBin } from "./spectrum";

/** The 102 channel centers, as the instrument has them: 17 per detector, evenly spaced in log wavelength. */
const RANGES: [number, number][] = [[0.75, 1.11], [1.11, 1.64], [1.64, 2.42], [2.42, 3.82], [3.82, 4.42], [4.42, 5.0]];
const CHANNELS = RANGES.flatMap(([low, high]) => Array.from({ length: 17 }, (_, k) => low * (high / low) ** ((k + 0.5) / 17)));

/** A spectrum sampled at the channel centers. `shape` gives the brightness at a wavelength. */
function spectrum(shape: (wavelength: number) => number, err = 0.5): SpectrumBin[] {
  return CHANNELS.map((wavelength, channel) => ({ channel, wavelength, flux: shape(wavelength), err, count: 3, season: -1 }));
}

/** A smooth star-like spectrum: rising to 1.6 microns, then falling. */
const star = (wavelength: number) => 1000 * (wavelength / 1.6) ** (wavelength < 1.6 ? 1.5 : -2);
/** A band that removes `depth` of the light around `center`. */
const band = (wavelength: number, center: number, width: number, depth: number) => 1 - depth * Math.exp(-0.5 * ((wavelength - center) / (width / 2.355)) ** 2);

describe("fitCurve", () => {
  it("recovers a line and a parabola, with errors that grow away from the points", () => {
    const xs = [1, 2, 3, 4, 5];
    const line = fitCurve(xs, xs.map((x) => 3 + 2 * x), xs.map(() => 4), 1)!;
    expect(line.at(10)).toBeCloseTo(23, 9);
    expect(line.variance(3)).toBeCloseTo(0.25 / 5, 9);
    expect(line.variance(10)).toBeGreaterThan(line.variance(3));
    const curve = fitCurve(xs, xs.map((x) => 1 - x + 0.5 * x * x), xs.map(() => 1), 2)!;
    expect(curve.at(0)).toBeCloseTo(1, 8);
    expect(curve.at(6)).toBeCloseTo(13, 8);
  });
  it("gives up when the points can't pin the curve down", () => {
    expect(fitCurve([1], [1], [1], 1)).toBeNull();
    expect(fitCurve([2, 2, 2], [1, 2, 3], [1, 1, 1], 1)).toBeNull();
  });
});

describe("robustLine", () => {
  it("follows the bulk of the points and ignores a third of them being far off", () => {
    const xs = Array.from({ length: 15 }, (_, i) => i);
    const ys = xs.map((x) => 2 + 0.5 * x + (x % 3 === 0 ? 40 : 0));
    const line = robustLine(xs, ys);
    expect(line(0)).toBeCloseTo(2, 6);
    expect(line(10)).toBeCloseTo(7, 6);
  });
});

describe("findFeatures", () => {
  it("finds nothing in a smooth spectrum", () => {
    const report = findFeatures(spectrum(star));
    expect(report.note).toBeNull();
    expect(report.checked).toBeGreaterThan(40);
    expect(report.findings).toEqual([]);
    // Nor in the falling tail of a hot star, whose curve would fool a straight-line comparison.
    expect(findFeatures(spectrum((w) => 5000 * w ** -2)).findings).toEqual([]);
    // Nor in a black body near its peak, as a cool star is.
    const cool = (w: number) => 1e5 / (w ** 3 * (Math.exp(14388 / (w * 3200)) - 1));
    expect(findFeatures(spectrum(cool)).findings).toEqual([]);
  });

  it("does not take the peak of a cool star's spectrum, hemmed in by water, for a bright line or band", () => {
    // Steam bands at 1.4 and 1.9 microns leave a peak between them, right where methane and iron have features.
    const report = findFeatures(spectrum((w) => star(w) * band(w, 1.4, 0.12, 0.25) * band(w, 1.9, 0.16, 0.3)));
    expect(report.findings.filter((f) => f.kind === "bump")).toEqual([]);
    expect(report.findings.filter((f) => f.familyId === "water").map((f) => f.rest).sort()).toEqual([1.4, 1.9]);
  });

  it("finds a water ice dip and says how deep it is", () => {
    const report = findFeatures(spectrum((w) => star(w) * band(w, 3.05, 0.4, 0.4)));
    const ice = report.findings.find((f) => f.label === "H₂O ice")!;
    expect(ice.kind).toBe("dip");
    expect(ice.familyId).toBe("water");
    expect(ice.strength!).toBeGreaterThan(0.2);
    expect(ice.strength!).toBeLessThan(0.45);
    expect(ice.significance).toBeGreaterThan(10);
    // Ammonia has a band inside the same span, so it is offered as another reading.
    expect(ice.also).toContain("Ammonia");
    expect(describeFeature(ice)).toMatch(/^Water \(H₂O ice\): a dip of \d\d percent at 3\.05 microns\. Could also be /);
  });

  it("finds glowing carbon dioxide as a bump, as a comet shows it", () => {
    const comet = findFeatures(spectrum((w) => star(w) * (2 - band(w, 4.27, 0.08, 1)))).findings.find((f) => f.familyId === "co2")!;
    expect(comet.kind).toBe("bump");
    expect(comet.observed).toBeCloseTo(4.27, 2);
    expect(comet.strength!).toBeGreaterThan(0.3);
  });

  it("ignores a bump at a band that never glows", () => {
    // Extra light at 1.66 microns is not methane. Methane only takes light away.
    const report = findFeatures(spectrum((w) => star(w) * (2 - band(w, 1.66, 0.1, 1))));
    expect(report.findings.filter((f) => f.familyId === "methane")).toEqual([]);
  });

  it("finds a narrow bright line as a bump", () => {
    // Hydrogen's Brackett alpha line, 60 percent above the light beside it, in one channel.
    const lit = spectrum(star);
    const at = lit.reduce((best, bin, i) => (Math.abs(bin.wavelength - 4.0523) < Math.abs(lit[best].wavelength - 4.0523) ? i : best), 0);
    lit[at].flux *= 1.6;
    const line = findFeatures(lit).findings.find((f) => f.label === "Br α")!;
    expect(line.kind).toBe("bump");
    expect(line.familyId).toBe("hydrogen");
    expect(line.strength!).toBeCloseTo(0.6, 1);
  });

  it("shifts the library with redshift", () => {
    // Hydrogen alpha from a galaxy at redshift 1 lands at 1.313 microns.
    const lit = spectrum(star);
    const at = lit.reduce((best, bin, i) => (Math.abs(bin.wavelength - 1.313) < Math.abs(lit[best].wavelength - 1.313) ? i : best), 0);
    lit[at].flux *= 1.6;
    const atRest = findFeatures(lit, 0).findings.map((f) => f.label);
    expect(atRest).not.toContain("H α");
    const shifted = findFeatures(lit, 1).findings.find((f) => f.label === "H α" || f.label === "[N II]")!;
    expect(shifted.familyId).toBe("galaxy");
    expect(shifted.observed).toBeCloseTo(1.313, 1);
    expect(shifted.kind).toBe("bump");
  });

  it("does not report ripples the size of the instrument's own", () => {
    // Two percent wiggles from channel to channel, with tiny formal errors, as bright stars show.
    const rippled = spectrum(star, 0.01).map((bin, i) => ({ ...bin, flux: bin.flux * (1 + 0.02 * (i % 2 ? 1 : -1)) }));
    expect(findFeatures(rippled).findings).toEqual([]);
  });

  it("does not report features lost in the noise", () => {
    const faint = spectrum((w) => 2 * band(w, 3.05, 0.4, 0.4), 1);
    expect(findFeatures(faint).findings).toEqual([]);
  });

  it("reports a bright line with nothing beside it, as glowing gas shows", () => {
    const gas = spectrum(() => 0, 1);
    const at = gas.reduce((best, bin, i) => (Math.abs(bin.wavelength - 1.8756) < Math.abs(gas[best].wavelength - 1.8756) ? i : best), 0);
    gas[at].flux = 80;
    const line = findFeatures(gas).findings.find((f) => f.label === "Pa α")!;
    expect(line.kind).toBe("bump");
    expect(line.strength).toBeNull();
    expect(describeFeature(line)).toBe("Hydrogen (Pa α): a bump at 1.88 microns, with almost no light on either side. Could also be water.");
  });

  it("does not judge narrow lines in a spectrum shaped by wide bands", () => {
    // A brown dwarf: deep water and methane bands leave sharp peaks between them.
    const dwarf = (w: number) => star(w) * band(w, 1.4, 0.12, 0.7) * band(w, 1.9, 0.16, 0.6) * band(w, 2.7, 0.25, 0.5) * band(w, 3.32, 0.3, 0.5);
    const report = findFeatures(spectrum(dwarf));
    const families = new Set(report.findings.map((f) => f.familyId));
    expect(families.has("water")).toBe(true);
    expect(families.has("methane")).toBe(true);
    expect(report.findings.filter((f) => ["hydrogen", "helium", "h2", "oxygen", "metals", "galaxy"].includes(f.familyId))).toEqual([]);
    // One dip is one finding: the organic features inside the methane band are named as other readings.
    expect(report.findings.filter((f) => f.observed > 3.1 && f.observed < 3.6)).toHaveLength(1);
    expect(report.findings.find((f) => f.familyId === "methane" && f.rest === 3.32)!.also).toContain("Organic molecules and dust");
  });

  it("keeps one finding per family where its features overlap", () => {
    // The three carbon monoxide band heads near 2.3 microns fall in neighboring channels.
    const report = findFeatures(spectrum((w) => star(w) * band(w, 2.32, 0.1, 0.3)));
    expect(report.findings.filter((f) => f.familyId === "co" && f.observed < 2.5)).toHaveLength(1);
  });

  it("judges only wide bands in a rough spectrum", () => {
    // A water ice band and a bright hydrogen line together.
    const lit = spectrum((w) => star(w) * band(w, 3.05, 0.4, 0.4));
    const at = lit.reduce((best, bin, i) => (Math.abs(bin.wavelength - 4.0523) < Math.abs(lit[best].wavelength - 4.0523) ? i : best), 0);
    lit[at].flux *= 1.6;
    const fine = findFeatures(lit).findings.map((f) => f.label);
    expect(fine).toContain("Br α");
    expect(fine).toContain("H₂O ice");
    const rough = findFeatures(lit, 0, LINE_FAMILIES, false, true).findings.map((f) => f.label);
    expect(rough).toEqual(["H₂O ice"]);
  });

  it("says so when the spectrum is too thin to check", () => {
    const report = findFeatures(spectrum(star).slice(0, 8));
    expect(report.findings).toEqual([]);
    expect(report.note).toMatch(/Too few/);
  });

  it("covers every family in the library when asked for one", () => {
    const water = LINE_FAMILIES.filter((family) => family.id === "water");
    const report = findFeatures(spectrum((w) => star(w) * band(w, 3.05, 0.4, 0.4)), 0, water);
    expect(report.findings.every((f) => f.familyId === "water")).toBe(true);
    expect(report.findings[0].also).toEqual([]);
  });
});

describe("findFeaturesByVisit", () => {
  const names = new Map([[0, "Aug 2025"], [1, "Dec 2025"]]);
  const visit = (season: number, shape: (w: number) => number, err: number, count = 2): SpectrumBin[] =>
    spectrum(shape, err).map((bin) => ({ ...bin, season, count }));

  it("judges a source that changed a lot visit by visit, and says when a feature shows", () => {
    // A comet: faint and plain in August, far brighter in December with glowing carbon dioxide.
    const august = visit(0, (w) => 0.05 * star(w), 2);
    const december = visit(1, (w) => star(w) * (30 - 29 * band(w, 4.27, 0.08, 1)), 20);
    // All visits together disagree wildly, so their errors are huge and nothing shows there.
    const report = findFeaturesByVisit(spectrum(star, 5000), [...august, ...december], 0, names);
    const co2 = report.findings.find((f) => f.familyId === "co2")!;
    expect(co2.visit).toBe("Dec 2025");
    expect(co2.kind).toBe("bump");
    expect(describeFeature(co2)).toMatch(/^Carbon dioxide \(CO₂\): a bump at 4\.27 microns, \d+ times as bright as the light on either side, in Dec 2025\.$/);
  });

  it("judges a steady source on all visits together", () => {
    const icy = (w: number) => star(w) * band(w, 3.05, 0.4, 0.4);
    // Each visit alone is too noisy to show the ice. Together they show it.
    const report = findFeaturesByVisit(spectrum(icy, 0.5), [...visit(0, icy, 60), ...visit(1, (w) => 1.1 * icy(w), 60)], 0, names);
    const ice = report.findings.find((f) => f.label === "H₂O ice")!;
    expect(ice.visit).toBeNull();
    // A steady source seen through different channels each visit stays steady.
    const split = findFeaturesByVisit(spectrum(icy, 0.5), [...visit(0, icy, 1).filter((bin) => bin.wavelength < 3.9), ...visit(1, icy, 1).filter((bin) => bin.wavelength > 1.2)], 0, names);
    expect(split.findings.every((f) => f.visit === null)).toBe(true);
  });

  it("does not trust a narrow line from a single image of a single visit", () => {
    const flare = visit(0, (w) => 3 * star(w), 0.5, 1);
    const at = flare.reduce((best, bin, i) => (Math.abs(bin.wavelength - 4.0523) < Math.abs(flare[best].wavelength - 4.0523) ? i : best), 0);
    flare[at].flux *= 3;
    const report = findFeaturesByVisit(spectrum(star, 5000), [...flare, ...visit(1, star, 0.5, 1)], 0, names);
    expect(report.findings).toEqual([]);
  });
});

describe("glowing features beside each other", () => {
  it("does not call the gap between two glowing bands a dark band", () => {
    // A comet: water glows at 2.7 microns and organic molecules at 3.4. Water ice sits between them in the library.
    const comet = (w: number) => 100 * (1 + 3 * (1 - band(w, 2.7, 0.2, 1)) + 2 * (1 - band(w, 3.4, 0.1, 1)));
    const report = findFeatures(spectrum(comet, 1));
    expect(report.findings.filter((f) => f.kind === "bump").map((f) => f.familyId).sort()).toEqual(["organics", "water"]);
    expect(report.findings.filter((f) => f.kind === "dip")).toEqual([]);
  });
});
