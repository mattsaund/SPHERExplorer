// Tests for the colors of a saved animation's frames.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { indexFrame, isColorPicture } from "./gifcolor";

/** A picture of `width` by `height` pixels, with each pixel's color given by a function. */
function picture(width: number, height: number, color: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = color(x, y);
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return rgba;
}

/** The color the frame gives one pixel. */
function shown(frame: { palette: number[][]; index: Uint8Array }, pixel: number): number[] {
  return frame.palette[frame.index[pixel]];
}

describe("the colors of a saved frame", () => {
  it("keeps every shade of a gray picture exactly", () => {
    const rgba = picture(256, 8, (x) => [x, x, x]);
    const frame = indexFrame(rgba, 256);
    expect(frame.palette.length).toBe(256);
    for (let p = 0; p < 256 * 8; p++) expect(shown(frame, p)).toEqual([rgba[p * 4], rgba[p * 4], rgba[p * 4]]);
  });

  it("keeps a gray picture within one step when colored marks are drawn on it", () => {
    // Every gray, with a yellow line, a cyan line, and their soft edges.
    const rgba = picture(256, 40, (x, y) => {
      if (y === 10) return [255, 210, 74];
      if (y === 11) return [Math.round((255 + x) / 2), Math.round((210 + x) / 2), Math.round((74 + x) / 2)];
      if (y === 20) return [155, 232, 255];
      if (y === 21) return [Math.round((155 + x) / 2), Math.round((232 + x) / 2), Math.round((255 + x) / 2)];
      return [x, x, x];
    });
    expect(isColorPicture(rgba)).toBe(false);
    const frame = indexFrame(rgba, 256);
    expect(frame.palette.length).toBeLessThanOrEqual(256);
    for (let x = 0; x < 256; x++) {
      const gray = shown(frame, x);
      expect(gray[0]).toBe(gray[1]);
      expect(gray[1]).toBe(gray[2]);
      expect(Math.abs(gray[0] - x)).toBeLessThanOrEqual(1);
    }
    // The marks keep their own colors.
    for (const [row, color] of [[10, [255, 210, 74]], [20, [155, 232, 255]]] as const) {
      const mark = shown(frame, row * 256 + 100);
      for (let c = 0; c < 3; c++) expect(Math.abs(mark[c] - color[c])).toBeLessThanOrEqual(6);
    }
  });

  it("still treats a picture as gray when solid fills cover much of it", () => {
    // Half the field has no data and is one solid color. A fifth is flagged, in another.
    const rgba = picture(256, 64, (x, y) => (y < 32 ? [91, 42, 134] : y < 44 ? [229, 72, 77] : [x, x, x]));
    expect(isColorPicture(rgba)).toBe(false);
    const frame = indexFrame(rgba, 256);
    for (let x = 0; x < 256; x++) expect(Math.abs(shown(frame, 50 * 256 + x)[0] - x)).toBeLessThanOrEqual(1);
    expect(shown(frame, 0)).toEqual([91, 42, 134]);
    expect(shown(frame, 40 * 256)).toEqual([229, 72, 77]);
  });

  it("knows a color picture, even with wide black margins around it", () => {
    const rgba = picture(400, 100, (x, y) => (x < 150 || x >= 250 ? [0, 0, 0] : [(x - 150) * 2, y * 2, 255 - y * 2]));
    expect(isColorPicture(rgba)).toBe(true);
    const frame = indexFrame(rgba, 400);
    expect(frame.palette.length).toBeLessThanOrEqual(256);
    expect(frame.index.length).toBe(400 * 100);
    // The margin stays pure black: dithering adds no specks to it.
    for (const p of [0, 149, 250, 399, 50 * 400 + 10]) expect(shown(frame, p)).toEqual([0, 0, 0]);
  });

  it("keeps the tone of a smooth color gradient by dithering", () => {
    // 65,536 colors, far more than a frame can hold.
    const size = 256;
    const rgba = picture(size, size, (x, y) => [x, y, 255 - Math.round((x + y) / 2)]);
    const frame = indexFrame(rgba, size);
    // Averaged over blocks of 16 by 16 pixels, the frame matches the picture closely. The
    // blocks at the far corners can be off by more: their colors lie outside the palette.
    let worst = 0;
    let total = 0;
    for (let by = 0; by < size; by += 16) {
      for (let bx = 0; bx < size; bx += 16) {
        const want = [0, 0, 0];
        const got = [0, 0, 0];
        for (let y = by; y < by + 16; y++) {
          for (let x = bx; x < bx + 16; x++) {
            const p = y * size + x;
            const color = shown(frame, p);
            for (let c = 0; c < 3; c++) {
              want[c] += rgba[p * 4 + c];
              got[c] += color[c];
            }
          }
        }
        for (let c = 0; c < 3; c++) {
          const off = Math.abs(want[c] - got[c]) / 256;
          worst = Math.max(worst, off);
          total += off;
        }
      }
    }
    // Measured: 0.5 of a step on average, and 4.8 at the worst corner.
    expect(total / (16 * 16 * 3)).toBeLessThan(1);
    expect(worst).toBeLessThan(8);
  });
});
