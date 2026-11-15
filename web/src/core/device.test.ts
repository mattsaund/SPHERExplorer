// The image budget must follow the computer, and never exceed what the server accepts.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { BASE_PIXELS, pixelBudget } from "./device";

describe("pixelBudget", () => {
  it("keeps the smallest budget on a phone, a tablet, and anything unknown", () => {
    expect(pixelBudget({})).toBe(BASE_PIXELS);
    expect(pixelBudget({ memory: 2, cores: 8 })).toBe(BASE_PIXELS);
    expect(pixelBudget({ memory: 4, cores: 8, desktop: true })).toBe(BASE_PIXELS);
    // An iPhone or iPad reports no memory, and is not a wide screen with a mouse.
    expect(pixelBudget({ cores: 6, desktop: false })).toBe(BASE_PIXELS);
    expect(pixelBudget({ cores: 4, desktop: true })).toBe(BASE_PIXELS);
  });
  it("gives a bigger computer two or three times as much", () => {
    expect(pixelBudget({ memory: 8, cores: 8 })).toBe(2 * BASE_PIXELS);
    expect(pixelBudget({ memory: 8, cores: 16 })).toBe(3 * BASE_PIXELS);
    // Firefox and Safari on a desktop report no memory figure.
    expect(pixelBudget({ cores: 8, desktop: true })).toBe(2 * BASE_PIXELS);
    expect(pixelBudget({ cores: 32, desktop: true })).toBe(2 * BASE_PIXELS);
  });
  it("stays inside the server's limit of 250 million pixels for one request", () => {
    for (const memory of [undefined, 0.5, 2, 4, 8]) {
      for (const cores of [undefined, 2, 8, 64]) {
        for (const desktop of [false, true]) expect(pixelBudget({ memory, cores, desktop })).toBeLessThan(2.5e8);
      }
    }
  });
});
