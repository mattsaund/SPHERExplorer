// Tests for which object on the sky map is the one being studied.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { separation } from "../sky/astro";
import { bodyNow, fieldCenter, fieldIsNow, isStudied, mapHome } from "./field";
import { solarPlaces } from "../sky/solar";
import type { Frame, SkyObject, Target } from "../types";

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

describe("fieldCenter", () => {
  const player = { index: 0, playing: false } as never;
  const filmMoved = false;
  // A body the sky map marks (Vesta, known by the page about it), and one it does not.
  const marked = { name: "4 Vesta (A807 FA)", ra: 0, dec: 0, epoch: 2026, url: vesta.url, moving: { command: "DES=20000004;" } } as Target;
  const unmarked = { ...marked, name: "C/1995 O1 (Hale-Bopp)", url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1995%20O1" } as Target;
  const frames = [{ id: 0, center: { ra: 95.1, dec: 18.2 } }, { id: 1, center: { ra: 96.4, dec: 18.5 } }] as unknown as Frame[];
  const first = { key: "e0", label: "", frameIds: [0], mjd: 0, wavelength: 0 };
  const second = { key: "e1", label: "", frameIds: [1], mjd: 0, wavelength: 0 };

  it("is the target's own place for a star or a patch of sky", () => {
    const target = { name: "Vega", ra: 279.2347, dec: 38.7837, epoch: 2000 } as Target;
    expect(fieldCenter({ target, frames: [], sequence: [], player, filmMoved })).toBe(target);
    expect(mapHome({ target, frames: [], sequence: [], player, filmMoved })).toBe(target);
    expect(fieldCenter({ target: null, frames: [], sequence: [], player, filmMoved })).toBeNull();
    expect(bodyNow(target)).toBeNull();
  });

  it("opens a marked body's study with the square on its marker, where the body is now", () => {
    const marker = solarPlaces(new Date()).find((body) => body.id === "vesta")!;
    const rest = { target: marked, frames, sequence: [first, second], player, filmMoved };
    const place = fieldCenter(rest)!;
    // The same place the map draws the marker, to well within the marker's own size.
    expect(separation(place, marker).arcsec).toBeLessThan(30);
    expect(fieldIsNow(rest)).toBe(true);
    // The same while its images are still being found.
    expect(fieldCenter({ target: marked, frames: [], sequence: [], player, filmMoved })).toEqual(place);
    // The map goes to the marker when the body is searched by name.
    expect(mapHome(rest)).toEqual(place);
    expect(bodyNow(marked)).toEqual(place);
  });

  it("lets the square cross the map along the body's path once the film moves", () => {
    const study = { target: marked, frames, sequence: [first, second], player };
    // Not moved yet: on the marker, whatever step the film happens to rest on. The step
    // number drifts while earlier images arrive, so it says nothing about the person's wish.
    expect(fieldIsNow({ ...study, filmMoved: false, player: { index: 1, playing: false } as never })).toBe(true);
    // Played or stepped: the square is where the image on screen was taken.
    const moved = { ...study, filmMoved: true };
    expect(fieldCenter(moved)).toEqual({ ra: 95.1, dec: 18.2 });
    expect(fieldCenter({ ...moved, player: { index: 1, playing: false } as never })).toEqual({ ra: 96.4, dec: 18.5 });
    expect(fieldIsNow(moved)).toBe(false);
  });

  it("puts any other moving body's square where the image on screen was taken", () => {
    expect(bodyNow(unmarked)).toBeNull();
    // Nothing to show until its images are found.
    expect(fieldCenter({ target: unmarked, frames: [], sequence: [], player, filmMoved })).toBeNull();
    expect(mapHome({ target: unmarked, frames: [], sequence: [], player, filmMoved })).toBeNull();
    expect(fieldCenter({ target: unmarked, frames, sequence: [], player, filmMoved })).toEqual({ ra: 95.1, dec: 18.2 });
    expect(fieldCenter({ target: unmarked, frames, sequence: [second], player, filmMoved })).toEqual({ ra: 96.4, dec: 18.5 });
    expect(fieldIsNow({ target: unmarked, frames, sequence: [second], player, filmMoved })).toBe(false);
    // The map goes to its first image.
    expect(mapHome({ target: unmarked, frames, sequence: [second], player, filmMoved })).toEqual({ ra: 95.1, dec: 18.2 });
  });
});
