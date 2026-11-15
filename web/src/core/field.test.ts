// Tests for which object on the sky map is the one being studied.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { isStudied } from "./field";
import type { SkyObject, Target } from "./types";

const star: SkyObject = { id: "s1", name: "Vega", ra: 279.2347, dec: 38.7837, epoch: 2000, url: "https://simbad.example/vega" } as SkyObject;
const vesta: SkyObject = {
  id: "vesta", name: "Vesta", ra: 120.5, dec: 21.3, epoch: 2026.87, url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=4",
  solar: { query: "asteroid 4", earth: 2.1, sun: 2.4, note: "The brightest asteroid." },
} as SkyObject;

describe("isStudied", () => {
  it("knows a star by its name and place", () => {
    const target = { name: "Vega", ra: 279.2347, dec: 38.7837, epoch: 2000 } as Target;
    expect(isStudied({ target }, star)).toBe(true);
    expect(isStudied({ target: { ...target, dec: 38.79 } }, star)).toBe(false);
    expect(isStudied({ target: null }, star)).toBe(false);
  });

  it("knows a moving body by the page about it, whatever the archive calls it", () => {
    // The study names the body as JPL does, and its place is where the last image caught it.
    const target = { name: "4 Vesta (A807 FA)", ra: 95.1, dec: 18.2, epoch: 2026, url: vesta.url, moving: { command: "DES=20000004;" } } as Target;
    expect(isStudied({ target }, vesta)).toBe(true);
    expect(isStudied({ target: { ...target, url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2" } }, vesta)).toBe(false);
  });

  it("never mixes up a fixed target and a moving body", () => {
    const moving = { name: "Vega", ra: 279.2347, dec: 38.7837, epoch: 2000, url: star.url, moving: { command: "599" } } as Target;
    expect(isStudied({ target: moving }, star)).toBe(false);
    // A patch of sky at the place where the body is now is not a study of the body.
    const fixed = { name: "Vesta", ra: 120.5, dec: 21.3, epoch: 2026.87, url: vesta.url } as Target;
    expect(isStudied({ target: fixed }, vesta)).toBe(false);
    // A body with no page cannot be matched by an empty one.
    expect(isStudied({ target: { ...moving, url: undefined } }, { ...vesta, url: undefined as unknown as string })).toBe(false);
  });
});
