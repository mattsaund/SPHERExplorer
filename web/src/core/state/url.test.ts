// Tests for reading and writing the view in the page address.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { buildLink, embedSnippet, parseLink, stepNear } from "./url";
import { useStore } from "./store";
import type { SequenceItem } from "../types";

describe("parseLink", () => {
  it("reads coordinates in the form NASA asks for", () => {
    expect(parseLink("?ra=133.795129&dec=-7.245147")).toEqual({ ra: 133.795129, dec: -7.245147 });
  });
  it("reads a named target with view settings", () => {
    expect(parseLink("?target=Barnard%27s%20Star&fov=600&mode=visits&color=long&det=56&embed=1")).toEqual({
      target: "Barnard's Star", fieldSize: 600, mode: "visits", color: "long",
      detectors: [false, false, false, false, true, true], embed: true,
    });
  });
  it("reads coordinates written the way NASA's challenge page writes them", () => {
    const link = parseLink("?ra=08h55m10.831s&dec=-7d14m42.53s");
    expect(link.ra).toBeCloseTo(133.795129, 5);
    expect(link.dec).toBeCloseTo(-7.245147, 5);
    const colons = parseLink("?ra=17:57:48.5&dec=%2B04:41:36");
    expect(colons.ra).toBeCloseTo(269.452083, 5);
    expect(colons.dec).toBeCloseTo(4.693333, 5);
    // A plus sign that was not escaped arrives as a space and still reads as north.
    expect(parseLink("?ra=10.5&dec=+41.25")).toEqual({ ra: 10.5, dec: 41.25 });
  });
  it("reads subtraction and autoplay", () => {
    expect(parseLink("?ra=10&dec=20&sub=first&play=1")).toEqual({ ra: 10, dec: 20, subtract: "first", play: true });
    expect(parseLink("?sub=none&play=yes")).toEqual({});
  });
  it("reads map settings", () => {
    expect(parseLink("?layer=wise&ch=47&proj=SIN")).toEqual({ layer: "wise", channel: 47, projection: "SIN" });
  });
  it("ignores bad values", () => {
    expect(parseLink("?ra=400&dec=10")).toEqual({});
    expect(parseLink("?ra=10")).toEqual({});
    expect(parseLink("?fov=5&mode=nope&det=789&layer=x&ch=500&proj=ZZZ&embed=yes")).toEqual({});
    // The widest field is 50 arcminutes. An older link that asks for more opens at that width.
    expect(parseLink("?fov=3000").fieldSize).toBe(3000);
    expect(parseLink("?fov=3600").fieldSize).toBe(3000);
    expect(parseLink("?fov=59").fieldSize).toBeUndefined();
    expect(parseLink("?color=unknown")).toEqual({ color: null });
    expect(parseLink("")).toEqual({});
  });
});

describe("buildLink", () => {
  it("is empty for the default view and round-trips a custom one", () => {
    const start = useStore.getState();
    expect(buildLink(start)).toBe("");
    // A study opens with the map and the images side by side.
    const base = { ...start, layout: { screen: "both" as const, tool: null } };
    const custom = {
      ...base,
      target: { ra: 133.759762, dec: -7.242182, epoch: 2026 },
      fieldSize: 600,
      mode: "visits" as const,
      filters: { ...base.filters, detectors: [false, false, false, false, true, true] },
      map: { ...base.map, layer: "wise", projection: "SIN" },
    };
    const link = buildLink(custom);
    expect(parseLink(link)).toEqual({
      ra: 133.75976, dec: -7.24218, fieldSize: 600, mode: "visits",
      detectors: [false, false, false, false, true, true], layer: "wise", projection: "SIN",
    });
    const named = { ...base, target: { name: "Barnard's Star", source: "SIMBAD", ra: 1, dec: 2, epoch: 2026 } };
    expect(parseLink(buildLink(named))).toEqual({ target: "Barnard's Star" });
    // Showing only changes holds the sky still and sets its own brightness scale, so neither needs a word.
    const changes = { ...named, subtract: "previous" as const, follow: false, display: { ...base.display, stretch: "linear" as const, lo: -12, hi: 12 } };
    expect(parseLink(buildLink(changes))).toEqual({ target: "Barnard's Star", subtract: "previous" });
    expect(parseLink(buildLink({ ...changes, follow: true }))).toEqual({ target: "Barnard's Star", subtract: "previous", follow: true });
  });
  it("adds or drops the compact layout on request", () => {
    const base = useStore.getState();
    const view = { ...base, target: { ra: 10, dec: 20, epoch: 2026 }, layout: { screen: "both" as const, tool: null } };
    expect(buildLink(view, { embed: true })).toBe("?ra=10.00000&dec=20.00000&embed=1");
    expect(buildLink({ ...view, embed: true })).toBe("?ra=10.00000&dec=20.00000&embed=1");
    expect(buildLink({ ...view, embed: true }, { embed: false })).toBe("?ra=10.00000&dec=20.00000");
    expect(buildLink(view, { play: true })).toBe("?ra=10.00000&dec=20.00000&play=1");
  });
});

describe("embedSnippet", () => {
  it("writes a frame that points at the compact layout", () => {
    const base = useStore.getState();
    const named = { ...base, mode: "visits" as const, target: { name: "Barnard's Star", source: "SIMBAD", ra: 1, dec: 2, epoch: 2026 } };
    const html = embedSnippet(named, "https://example.org/", 800, 600);
    expect(html).toBe(
      '<iframe src="https://example.org/?target=Barnard%27s+Star&amp;mode=visits&amp;embed=1" width="800" height="600" style="border:0;max-width:100%" loading="lazy" allowfullscreen title="SPHEREx images of Barnard\'s Star"></iframe>',
    );
    // The address the frame loads must parse back to the same view.
    const src = html.match(/src="([^"]+)"/)![1].replace(/&amp;/g, "&");
    expect(parseLink(new URL(src).search)).toEqual({ target: "Barnard's Star", mode: "visits", embed: true });
  });
  it("names a plain position and starts playing when the view is playing", () => {
    const base = useStore.getState();
    const view = { ...base, target: { ra: 133.795129, dec: -7.245147, epoch: 2026 }, player: { ...base.player, playing: true } };
    const html = embedSnippet(view, "https://example.org/");
    expect(html).toContain('src="https://example.org/?ra=133.79513&amp;dec=-7.24515&amp;play=1&amp;embed=1"');
    expect(html).toContain('width="640" height="560"');
    expect(html).toContain('title="SPHEREx images of RA 133.7951, Dec -7.2451"');
  });
  it("escapes a name that holds markup", () => {
    const base = useStore.getState();
    const odd = { ...base, target: { name: 'a"><script>', source: "SIMBAD", ra: 1, dec: 2, epoch: 2026 } };
    const html = embedSnippet(odd, "https://example.org/");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });
});

describe("the whole view in a link", () => {
  /** A step of a film, for these tests. */
  const step = (mjd: number, wavelength: number): SequenceItem => ({ key: `${mjd}-${wavelength}`, label: "", frameIds: [0], mjd, wavelength });

  it("reads every part of the view", () => {
    const link = parseLink(
      "?view=images&tool=graphs&t=60961.4330&w=3.421&zoom=2.5&x=30&y=-20&curve=log&lo=-2&hi=80&cmap=viridis&inv=1&smooth=1&marks=mg" +
        "&follow=0&fps=8&blink=wise-w2&plot=vl&ap=12&rs=0.5&feat=water,nope,co2&spot=40,-12.5&mra=83.6&mdec=22&mfov=1.5&ov=lsgc",
    );
    expect(link).toEqual({
      view: "images", tool: "graphs", time: 60961.433, wavelength: 3.421, zoom: 2.5, east: 30, north: -20,
      stretch: "log", lo: -2, hi: 80, colorMap: "viridis", invert: true, smooth: true,
      marks: { showMarker: true, showObjects: false, showGaia: true, showChanges: false, showFlags: false },
      follow: false, fps: 8, blink: "wise-w2",
      plot: { perVisit: true, showPoints: false, log: true, showSurveys: false },
      aperture: 12, redshift: 0.5, families: ["water", "co2"], spot: [40, -12.5],
      mapRa: 83.6, mapDec: 22, mapFov: 1.5,
      overlays: { labels: true, solar: true, grid: true, coverage: true, deepFields: false, tiles: false },
    });
    expect(parseLink("?ap=halo&marks=0&ov=0")).toEqual({
      aperture: "halo",
      marks: { showMarker: false, showObjects: false, showGaia: false, showChanges: false, showFlags: false },
      overlays: { labels: false, solar: false, grid: false, coverage: false, deepFields: false, tiles: false },
    });
  });

  it("ignores bad values", () => {
    expect(parseLink("?view=sideways&tool=<b>&t=12&w=99&zoom=0&x=1e9&curve=cube&cmap=rainbow&marks=mz&blink=hubble&plot=q&ap=1&rs=-1&feat=nope&spot=1&mra=400&mdec=0&mfov=0&ov=x")).toEqual({});
  });

  it("writes only what differs from the default view", () => {
    const base = useStore.getState();
    const target = { ra: 10, dec: 20, epoch: 2026 };
    const study = { ...base, target, layout: { screen: "both" as const, tool: null } };
    // A study opens with the map and the images side by side, so that screen needs no word.
    expect(buildLink(study)).toBe("?ra=10.00000&dec=20.00000");
    expect(buildLink({ ...study, layout: { screen: "images", tool: "graphs" } })).toBe("?ra=10.00000&dec=20.00000&view=images&tool=graphs");
    // Without a study the map is alone, and a tool can still be open.
    expect(buildLink({ ...base, layout: { screen: "map", tool: "about" } })).toBe("?tool=about");
    expect(buildLink({ ...base, map: { ...base.map, grid: true, labels: false } })).toBe("?ov=sg");
  });

  it("carries the image on screen, its zoom, and how it is drawn", () => {
    const base = useStore.getState();
    const study = {
      ...base,
      target: { ra: 10, dec: 20, epoch: 2026 },
      layout: { screen: "both" as const, tool: null },
      sequence: [step(60900.5, 1.2), step(60961.43301, 3.4214)],
      player: { index: 1, playing: false, fps: 8 },
      view: { east: 30.04, north: -20, zoom: 2.5 },
      follow: false,
      display: { ...base.display, stretch: "log" as const, lo: -2, hi: 80.126, colorMap: "viridis" as const, invert: true, showGaia: true, showObjects: false },
    };
    const link = buildLink(study);
    expect(link).toBe("?ra=10.00000&dec=20.00000&t=60961.4330&w=3.421&zoom=2.5&x=30&y=-20&follow=0&fps=8&curve=log&lo=-2&hi=80.13&cmap=viridis&inv=1&marks=mgc");
    expect(parseLink(link)).toEqual({
      ra: 10, dec: 20, time: 60961.433, wavelength: 3.421, zoom: 2.5, east: 30, north: -20, follow: false, fps: 8,
      stretch: "log", lo: -2, hi: 80.13, colorMap: "viridis", invert: true,
      marks: { showMarker: true, showObjects: false, showGaia: true, showChanges: true, showFlags: false },
    });
    // The compact layout shows the same image, so it keeps the image's part of the link.
    expect(buildLink(study, { embed: true })).toBe("?ra=10.00000&dec=20.00000&embed=1&t=60961.4330&w=3.421&zoom=2.5&x=30&y=-20&follow=0&fps=8&curve=log&lo=-2&hi=80.13&cmap=viridis&inv=1&marks=mgc");
    // Wavelength sums are named by wavelength alone, and visit sums by time alone.
    expect(buildLink({ ...study, mode: "channels" })).toContain("mode=channels&w=3.421&zoom");
    expect(buildLink({ ...study, mode: "visits" })).toContain("mode=visits&t=60961.4330&zoom");
  });

  it("leaves out the brightness scale that showing only changes sets by itself", () => {
    const base = useStore.getState();
    const study = { ...base, target: { ra: 10, dec: 20, epoch: 2026 }, layout: { screen: "both" as const, tool: null }, subtract: "first" as const, follow: false };
    const changes = { ...study, display: { ...base.display, stretch: "linear" as const, lo: -12, hi: 12 } };
    expect(buildLink(changes)).toBe("?ra=10.00000&dec=20.00000&sub=first");
    expect(buildLink({ ...changes, display: { ...changes.display, lo: -5, hi: 5 } })).toBe("?ra=10.00000&dec=20.00000&sub=first&lo=-5&hi=5");
  });

  it("carries the spectrum, blinking, and the page", () => {
    const base = useStore.getState();
    const study = {
      ...base,
      target: { name: "RW Aur", source: "SIMBAD", ra: 76.9562, dec: 30.4012, epoch: 2026 },
      layout: { screen: "both" as const, tool: "graphs" },
      blink: { on: true, choice: "2mass" as const, older: true },
      spectrum: { ...base.spectrum, log: true, showPoints: false, aperture: 12, redshift: 0.5, families: ["water", "co2"], probe: [40, -12.5] as [number, number] },
    };
    const link = buildLink(study);
    expect(link).toBe("?target=RW+Aur&tool=graphs&blink=2mass&plot=vls&ap=12&rs=0.5&feat=water%2Cco2&spot=40%2C-12.5");
    expect(parseLink(link)).toEqual({
      target: "RW Aur", tool: "graphs", blink: "2mass",
      plot: { perVisit: true, showPoints: false, log: true, showSurveys: true },
      aperture: 12, redshift: 0.5, families: ["water", "co2"], spot: [40, -12.5],
    });
    expect(buildLink({ ...study, spectrum: { ...study.spectrum, halo: true } })).toContain("ap=halo");
  });

  it("writes where the map looks only when it was moved away from the study", () => {
    const base = useStore.getState();
    const target = { ra: 10, dec: 20, epoch: 2026 };
    const study = { ...base, target, targetState: "ready" as const, layout: { screen: "both" as const, tool: null } };
    // The map goes to a study by itself: centered on it, 2 degrees wide.
    const settled = { ...study, map: { ...base.map, ready: true, center: { ra: 10.001, dec: 20 }, fov: 2 } };
    expect(buildLink(settled)).toBe("?ra=10.00000&dec=20.00000");
    const moved = { ...study, map: { ...base.map, ready: true, center: { ra: 12.34567, dec: 21.23456 }, fov: 0.75 } };
    expect(buildLink(moved)).toBe("?ra=10.00000&dec=20.00000&mra=12.3457&mdec=21.2346&mfov=0.75");
    // A map that is not up yet, or a study still being found, says nothing about the map.
    expect(buildLink({ ...moved, map: { ...moved.map, ready: false } })).toBe("?ra=10.00000&dec=20.00000");
    expect(buildLink({ ...moved, targetState: "loading" })).toBe("?ra=10.00000&dec=20.00000");
    // With no study, the whole sky is the starting view.
    expect(buildLink({ ...base, map: { ...base.map, ready: true } })).toBe("");
    expect(buildLink({ ...base, map: { ...base.map, ready: true, center: { ra: 83.82, dec: -5.39 }, fov: 3 } })).toBe("?mra=83.82&mdec=-5.39&mfov=3");
  });
});

describe("stepNear", () => {
  const step = (mjd: number, wavelength: number): SequenceItem => ({ key: `${mjd}-${wavelength}`, label: "", frameIds: [0], mjd, wavelength });

  it("finds an exposure by time, and tells apart the two detectors that expose together", () => {
    const film = [step(60900.1, 1.1), step(60900.2, 0.9), step(60900.2, 3.4), step(60900.3, 2.0)];
    expect(stepNear(film, "exposures", 60900.2, 3.4)).toBe(2);
    expect(stepNear(film, "exposures", 60900.2, 0.9)).toBe(1);
    expect(stepNear(film, "exposures", 60900.2)).toBe(1);
    expect(stepNear(film, "exposures", 60900.31, 9)).toBe(3);
  });
  it("finds a wavelength sum by wavelength, whatever its mean time has become", () => {
    const film = [step(61000, 1.1), step(60990, 2.2), step(61010, 3.3)];
    expect(stepNear(film, "channels", 60990, 3.3)).toBe(2);
    expect(stepNear(film, "channels", undefined, 2.25)).toBe(1);
  });
  it("starts at the first step when the link names none", () => {
    expect(stepNear([step(1, 1), step(2, 2)], "exposures")).toBe(0);
    expect(stepNear([], "visits", 60900)).toBe(0);
    expect(stepNear([step(NaN, NaN), step(60900, 2)], "visits", 60900)).toBe(1);
  });
});
