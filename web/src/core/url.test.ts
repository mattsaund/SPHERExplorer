// Tests for reading and writing the view in the page address.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { buildLink, parseLink } from "./url";
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
  });
});
