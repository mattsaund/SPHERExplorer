// Tests for reading and writing the view in the page address.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { buildLink, embedSnippet, parseLink } from "./url";
import { useStore } from "./store";

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
    expect(parseLink("?color=unknown")).toEqual({ color: null });
    expect(parseLink("")).toEqual({});
  });
});

describe("buildLink", () => {
  it("is empty for the default view and round-trips a custom one", () => {
    const base = useStore.getState();
    expect(buildLink(base)).toBe("");
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
    const changes = { ...named, subtract: "previous" as const };
    expect(parseLink(buildLink(changes))).toEqual({ target: "Barnard's Star", subtract: "previous" });
  });
  it("adds or drops the compact layout on request", () => {
    const base = useStore.getState();
    const view = { ...base, target: { ra: 10, dec: 20, epoch: 2026 } };
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
