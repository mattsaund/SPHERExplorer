// Tests for locating a source and fitting its motion.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { compass, locate } from "./motion";
import type { Stack } from "./stack";

/** A summed image with one Gaussian source at a sky offset, on flat noise-free sky. */
function blob(east: number, north: number, peak = 50, size = 97, scale = 3.075): Stack {
  const center = (size - 1) / 2;
  const image = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const de = -(i - center) * scale - east;
      const dn = (j - center) * scale - north;
      image[j * size + i] = peak * Math.exp(-(de * de + dn * dn) / (2 * 3.5 * 3.5));
    }
  }
  return { nx: size, ny: size, cx: center, cy: center, m: [-scale, 0, 0, scale], image, rms: 1, count: 10 };
}

describe("locate", () => {
  it("finds a source to a small fraction of a pixel", () => {
    const found = locate(blob(12.3, -7.9), [10, -6])!;
    expect(found.east).toBeCloseTo(12.3, 1);
    expect(found.north).toBeCloseTo(-7.9, 1);
    expect(found.snr).toBeGreaterThan(40);
    expect(found.err).toBeLessThan(0.3);
  });
  it("copes with a saturated core", () => {
    const stack = blob(4, 4, 500);
    for (let k = 0; k < stack.image.length; k++) if (stack.image[k] > 250) stack.image[k] = Infinity;
    const found = locate(stack, [3, 3])!;
    expect(found.east).toBeCloseTo(4, 0);
    expect(found.north).toBeCloseTo(4, 0);
    expect(found.saturated).toBe(true);
    expect(found.err).toBeGreaterThanOrEqual(1);
    // An unsaturated source has the smaller error floor.
    const clean = locate(blob(4, 4, 500), [3, 3])!;
    expect(clean.saturated).toBe(false);
    expect(clean.err).toBeLessThan(0.5);
  });
  it("gives up when nothing is near the expected spot", () => {
    expect(locate(blob(80, 80), [0, 0])).toBeNull();
    const empty = blob(0, 0, 0);
    expect(locate(empty, [0, 0])).toBeNull();
  });
});

describe("compass", () => {
  it("names directions", () => {
    expect(compass(0)).toBe("north");
    expect(compass(121.8)).toBe("southeast");
    expect(compass(274.7)).toBe("west");
    expect(compass(355.6)).toBe("north");
  });
});
