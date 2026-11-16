// The About tab's credits: every row has a name, a use, and a secure link.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { ACKNOWLEDGMENTS, CHALLENGE, CODE, DOCS, NASA_DATA, PARTNER_DATA, REPO, SI_TOOL, TEAM } from "./credits";

const lists = { NASA_DATA, PARTNER_DATA, CODE };
const everyLink = [
  ...TEAM,
  SI_TOOL,
  ...Object.values(lists).flatMap((list) => list.flatMap((credit) => credit.links)),
  ...Object.entries(DOCS).map(([name, url]) => ({ name, url })),
  { name: "repository", url: REPO },
  { name: "challenge", url: CHALLENGE },
];

describe("credits", () => {
  it("names the two team members with their own sites", () => {
    expect(TEAM).toEqual([
      { name: "Matthew Saunders", url: "https://msaunders.dev" },
      { name: "Austin Laubach", url: "https://laubach.dev" },
    ]);
  });

  it("gives every link a name and an https address that parses", () => {
    for (const link of everyLink) {
      expect(link.name.trim(), link.url).not.toBe("");
      expect(link.url, link.name).toMatch(/^https:\/\//);
      expect(() => new URL(link.url), link.url).not.toThrow();
    }
  });

  it("says what each credit is used for, and names each one once in its list", () => {
    for (const [title, list] of Object.entries(lists)) {
      expect(list.length, title).toBeGreaterThan(0);
      const first = list.map((credit) => credit.links[0].name);
      expect(new Set(first).size, title).toBe(first.length);
      for (const credit of list) {
        expect(credit.links.length, title).toBeGreaterThan(0);
        expect(credit.use.trim(), credit.links[0].name).not.toBe("");
        expect(credit.use.endsWith("."), credit.links[0].name).toBe(false);
      }
    }
  });

  it("keeps the documents in this project's repository", () => {
    for (const url of Object.values(DOCS)) expect(url.startsWith(`${REPO}/blob/main/docs/`)).toBe(true);
  });

  it("carries the SPHEREx and IRSA acknowledgments in the archives' own words", () => {
    expect(ACKNOWLEDGMENTS.some((text) => text.startsWith("This publication makes use of data products from the Spectro-Photometer"))).toBe(true);
    expect(ACKNOWLEDGMENTS.some((text) => text.startsWith("This research has made use of the NASA/IPAC Infrared Science Archive"))).toBe(true);
  });
});
