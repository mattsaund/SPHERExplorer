// The FITS files written in the browser must follow the format to the byte.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { fitsCard, fitsComment, writeFits } from "./fitsfile";

describe("fitsCard", () => {
  it("lays out every kind of value in 80 characters", () => {
    const cards = [fitsCard("SIMPLE", true), fitsCard("NAXIS1", 512), fitsCard("CDELT1", -0.0017083333), fitsCard("CTYPE1", "RA---TAN"), fitsCard("OBJECT", "Barnard's Star", "the target")];
    for (const card of cards) expect(card).toHaveLength(80);
    expect(cards[0].slice(0, 30)).toBe("SIMPLE  =                    T");
    expect(cards[1].slice(0, 30)).toBe("NAXIS1  =                  512");
    expect(Number(cards[2].slice(10, 30))).toBeCloseTo(-0.0017083333, 12);
    expect(cards[3].slice(0, 20)).toBe("CTYPE1  = 'RA---TAN'");
    // A quote inside a string is doubled, and the comment follows a slash.
    expect(cards[4]).toContain("'Barnard''s Star'");
    expect(cards[4]).toContain("/ the target");
  });

  it("writes small and large numbers a FITS reader can parse", () => {
    expect(Number(fitsCard("TINY", 1.5e-9).slice(10, 30).replace("E", "e"))).toBeCloseTo(1.5e-9, 18);
    expect(fitsCard("MJD", 60961.432951791).slice(10, 30).trim()).toBe("60961.432951791");
  });

  it("splits a long comment over lines of 80 characters", () => {
    const lines = fitsComment("x".repeat(100));
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toHaveLength(80);
    expect(lines[0].startsWith("COMMENT ")).toBe(true);
  });
});

describe("writeFits", () => {
  it("writes whole blocks, big-endian pixels, and NaN for no data", async () => {
    const image = new Float32Array([1.5, -2, Infinity, NaN, 0, 3]);
    const blob = writeFits(image, 3, 2, [["BUNIT", "MJy/sr"]], ["made in a test"]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.length).toBe(2880 * 2);
    const header = new TextDecoder().decode(bytes.subarray(0, 2880));
    expect(header.slice(0, 30)).toBe("SIMPLE  =                    T");
    expect(header).toContain("NAXIS1  =                    3");
    expect(header).toContain("NAXIS2  =                    2");
    expect(header).toContain("BUNIT   = 'MJy/sr  '");
    expect(header).toContain("COMMENT made in a test");
    // END is the last card, and the rest of the block is spaces.
    const end = header.indexOf("END     ");
    expect(end % 80).toBe(0);
    expect(header.slice(end + 80).trim()).toBe("");
    const view = new DataView(bytes.buffer, 2880);
    expect(view.getFloat32(0, false)).toBe(1.5);
    expect(view.getFloat32(4, false)).toBe(-2);
    expect(Number.isNaN(view.getFloat32(8, false))).toBe(true);
    expect(Number.isNaN(view.getFloat32(12, false))).toBe(true);
    expect(view.getFloat32(20, false)).toBe(3);
  });
});
