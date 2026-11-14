// Tests for the search box suggestions.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { FAMOUS, NASA_TARGETS } from "./famous";
import { fold, localSuggestions, matchScore, mergeSuggestions, rememberSearch, type Suggestion } from "./suggest";
import { TEST_TARGETS } from "./targets";

describe("the list of well-known objects", () => {
  it("starts with NASA's five test targets, in the app's own order and spelling", () => {
    expect(FAMOUS.slice(0, NASA_TARGETS).map((row) => row[0])).toEqual(TEST_TARGETS.map((target) => target.name));
  });
  it("has complete rows and no repeated search text", () => {
    const seen = new Set<string>();
    for (const [query, label, detail, also] of FAMOUS) {
      expect(query.trim()).toBe(query);
      expect(label.length).toBeGreaterThan(0);
      expect(detail.length).toBeGreaterThan(0);
      expect(also).toBe(also.toLowerCase());
      expect(seen.has(fold(query))).toBe(false);
      seen.add(fold(query));
    }
    expect(FAMOUS.length).toBeGreaterThan(100);
  });
});

describe("matchScore", () => {
  it("ranks a leading match over a word match over a match inside", () => {
    expect(matchScore(["Andromeda Galaxy (M 31)"], "andr")).toBe(3);
    expect(matchScore(["Andromeda Galaxy (M 31)"], "gal")).toBe(2);
    expect(matchScore(["Andromeda Galaxy (M 31)"], "dromed")).toBe(1);
    expect(matchScore(["Andromeda Galaxy (M 31)"], "dr")).toBe(0);
    expect(matchScore(["Andromeda Galaxy (M 31)"], "xyz")).toBe(0);
    expect(matchScore(["Andromeda Galaxy (M 31)"], "")).toBe(0);
  });
  it("ignores case, apostrophes, accents, and optional spaces", () => {
    expect(matchScore(["Barnard's Star"], "barnards")).toBe(3);
    expect(matchScore(["Barnard's Star"], "BARNARD'S ST")).toBe(3);
    expect(matchScore(["M 31"], "m31")).toBe(3);
    expect(matchScore(["Sgr A*"], "sgr a*")).toBe(3);
    expect(fold("Épsilon  Índi-B")).toBe("epsilon indi b");
  });
});

describe("localSuggestions", () => {
  const labels = (rows: Suggestion[]) => rows.map((row) => row.label);

  it("offers recent searches and the NASA targets before anything is typed", () => {
    const rows = localSuggestions("", [{ label: "Vega", query: "Vega" }]);
    expect(rows[0]).toEqual({ label: "Vega", detail: "Searched before", query: "Vega", group: "recent" });
    expect(rows[1]).toEqual({ label: "Barnard's Star", detail: "Red dwarf, fastest-moving star in the sky", query: "Barnard's Star", group: "nasa" });
    expect(rows.slice(1).map((row) => row.group)).toEqual(["nasa", "nasa", "nasa", "nasa", "nasa"]);
    expect(labels(rows.slice(1))).toEqual(["Barnard's Star", "Epsilon Indi B", "WISE 0855-0714", "RW Aurigae", "R Draconis"]);
  });
  it("finds well-known objects by any of their names", () => {
    expect(labels(localSuggestions("androm", []))).toEqual(["Andromeda Galaxy (M 31)"]);
    expect(labels(localSuggestions("m 31", []))[0]).toBe("Andromeda Galaxy (M 31)");
    expect(labels(localSuggestions("north star", []))).toContain("Polaris");
    expect(labels(localSuggestions("halley", []))).toEqual(["Halley's Comet"]);
    expect(localSuggestions("halley", [])[0]).toMatchObject({ query: "comet 1P", group: "solar" });
    expect(localSuggestions("barn", [])[0]).toMatchObject({ label: "Barnard's Star", group: "nasa" });
    expect(labels(localSuggestions("deep field", []))).toEqual(["North ecliptic pole", "South ecliptic pole"]);
  });
  it("puts names that start with the text ahead of names that only contain it", () => {
    const rows = labels(localSuggestions("m 1", []));
    expect(rows[0]).toBe("Crab Nebula (M 1)");
    expect(rows).toContain("Eagle Nebula (M 16)");
    expect(rows.length).toBeLessThanOrEqual(9);
  });
  it("reads typed coordinates and offers to go there", () => {
    const rows = localSuggestions("08h55m10.831s -7d14m42.53s", []);
    expect(rows[0]).toEqual({ label: "08h55m10.83s -07d14m42.5s", detail: "Go to these coordinates (J2000)", query: "08h55m10.831s -7d14m42.53s", group: "place" });
    expect(localSuggestions("133.795 -7.245", [])[0].group).toBe("place");
  });
  it("offers a matching recent search first and never repeats a row", () => {
    const recent = [{ label: "Barnard's Star", query: "Barnard's Star" }, { label: "NGC 1333", query: "NGC 1333" }];
    const rows = localSuggestions("barn", recent);
    expect(rows.filter((row) => row.label === "Barnard's Star")).toHaveLength(1);
    expect(rows[0].group).toBe("recent");
    expect(labels(localSuggestions("ngc 13", recent))).toEqual(["NGC 1333"]);
  });
});

describe("mergeSuggestions", () => {
  it("adds the server's rows after the local ones and drops repeats", () => {
    const local = localSuggestions("cer", []);
    const remote: Suggestion[] = [
      { label: "Ceres", detail: "Asteroid", query: "asteroid 1", group: "solar" },
      { label: "807 Ceraskia", detail: "Asteroid", query: "asteroid 807", group: "solar" },
    ];
    const rows = mergeSuggestions(local, remote);
    expect(rows.map((row) => row.label)).toEqual(["Ceres", "807 Ceraskia"]);
    expect(rows[0].query).toBe("asteroid Ceres");
  });
});

describe("rememberSearch", () => {
  it("keeps the newest first, without repeats, and works without browser storage", () => {
    let recent = rememberSearch([], { label: "Vega", query: "Vega" });
    recent = rememberSearch(recent, { label: "M 31", query: "m31" });
    recent = rememberSearch(recent, { label: "Vega", query: "vega" });
    expect(recent).toEqual([{ label: "Vega", query: "vega" }, { label: "M 31", query: "m31" }]);
    for (let i = 0; i < 12; i++) recent = rememberSearch(recent, { label: `Star ${i}`, query: `star ${i}` });
    expect(recent).toHaveLength(8);
    expect(recent[0].label).toBe("Star 11");
  });
});
