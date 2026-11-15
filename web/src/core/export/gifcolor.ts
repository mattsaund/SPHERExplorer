// Chooses the colors of one frame of a saved animation. A GIF frame holds at most 256 colors,
// so this choice decides how good the saved picture looks.
// A gray picture keeps its shades of gray to within one step, and its colored marks share a
// few colors. A color picture gets 256 colors fitted to it, and is dithered: each pixel's
// error is passed to its neighbors, so smooth gradients stay smooth and do not break into bands.
// Written with Claude Code (Anthropic) assistance.
import { quantize } from "gifenc";

/** One frame ready for the GIF encoder: its colors, and each pixel's place among them. */
export interface IndexedFrame {
  palette: number[][];
  index: Uint8Array;
}

type Pixels = Uint8Array | Uint8ClampedArray;

/** Palette places a gray picture gives to its colored marks: the marker, labels, and flags. */
const MARK_COLORS = 64;
/** A picture is a color picture when more than this share of its lit pixels are colored. */
const COLOR_SHARE = 0.25;
/** One pixel in this many is looked at to tell a gray picture from a color one. */
const SAMPLE = 7;

/**
 * True for a picture drawn in color: a color map, or three bands at once.
 * A gray picture also has colored pixels, but few: thin marks, and at most two solid fills
 * (flagged pixels, and places with no data). Black is left out, so the empty margins of a wide
 * view do not make a color picture look gray.
 */
export function isColorPicture(rgba: Pixels): boolean {
  const fills = new Map<number, number>();
  let lit = 0;
  let colored = 0;
  for (let i = 0; i < rgba.length; i += 4 * SAMPLE) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    if (r === g && g === b) {
      if (r > 0) lit++;
      continue;
    }
    lit++;
    colored++;
    const key = (r << 16) | (g << 8) | b;
    fills.set(key, (fills.get(key) ?? 0) + 1);
  }
  // The two most common colors may be solid fills, which say nothing about the picture itself.
  const counts = [...fills.values()].sort((a, b) => b - a);
  const solid = (counts[0] ?? 0) + (counts[1] ?? 0);
  return colored - solid > (lit - solid) * COLOR_SHARE;
}

/** The place in a palette, given as r, g, b in a row, of the color nearest to one color. */
function nearest(flat: Uint8Array, r: number, g: number, b: number): number {
  let best = 0;
  let least = Infinity;
  for (let k = 0, at = 0; at < flat.length; k++, at += 3) {
    const dr = flat[at] - r;
    const dg = flat[at + 1] - g;
    const db = flat[at + 2] - b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < least) {
      least = distance;
      best = k;
    }
  }
  return best;
}

/**
 * A gray picture with colored marks on it.
 * The colored pixels are fitted with up to MARK_COLORS colors. The grays take the rest: every
 * shade the picture uses when they all fit, or else evenly spaced shades across its range,
 * which are never more than one step from the true one.
 */
function grayFrame(rgba: Pixels): IndexedFrame {
  const used = new Uint8Array(256);
  let colored = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] === rgba[i + 1] && rgba[i] === rgba[i + 2]) used[rgba[i]] = 1;
    else colored++;
  }
  const marks = new Uint8Array(colored * 4);
  for (let i = 0, at = 0; i < rgba.length; i += 4) {
    if (rgba[i] === rgba[i + 1] && rgba[i] === rgba[i + 2]) continue;
    marks[at++] = rgba[i];
    marks[at++] = rgba[i + 1];
    marks[at++] = rgba[i + 2];
    marks[at++] = 255;
  }
  const markColors = colored ? quantize(marks, MARK_COLORS) : [];

  const room = 256 - markColors.length;
  let grays: number[] = [];
  for (let value = 0; value < 256; value++) if (used[value]) grays.push(value);
  if (grays.length > room) {
    const low = grays[0];
    const high = grays[grays.length - 1];
    grays = Array.from({ length: room }, (_, k) => Math.round(low + (k * (high - low)) / (room - 1)));
  }
  if (!grays.length && !markColors.length) grays = [0];
  // Each gray value's place in the palette: the nearest shade kept.
  const place = new Uint8Array(256);
  for (let value = 0, k = 0; value < 256; value++) {
    while (k + 1 < grays.length && Math.abs(grays[k + 1] - value) <= Math.abs(grays[k] - value)) k++;
    place[value] = k;
  }

  const palette = [...grays.map((value) => [value, value, value]), ...markColors];
  const flat = Uint8Array.from(palette.flat());
  const index = new Uint8Array(rgba.length >> 2);
  // A colored pixel takes the nearest color of the whole palette, gray or not. Each color is
  // looked up once.
  const found = new Map<number, number>();
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    if (r === g && g === b) {
      index[p] = place[r];
      continue;
    }
    const key = (r << 16) | (g << 8) | b;
    let k = found.get(key);
    if (k === undefined) {
      k = nearest(flat, r, g, b);
      found.set(key, k);
    }
    index[p] = k;
  }
  return { palette, index };
}

/**
 * A color picture: 256 colors fitted to its own pixels, then dithered by the method of Floyd
 * and Steinberg. Each pixel takes the nearest color, and the difference goes to the pixels
 * not yet done: 7/16 ahead, and 3/16, 5/16, and 1/16 on the row below. Rows run left to
 * right and right to left by turns, which keeps the pattern from leaning one way.
 */
function colorFrame(rgba: Pixels, width: number): IndexedFrame {
  const palette = quantize(rgba, 256);
  const flat = Uint8Array.from(palette.flat());
  const count = rgba.length >> 2;
  const height = Math.ceil(count / width);
  const index = new Uint8Array(count);
  // The nearest palette color for each color, to 5 bits a channel, found once.
  const found = new Int16Array(32768).fill(-1);
  // The error owed to each pixel of this row and of the next, with a spare pixel at each end.
  let row = new Float32Array((width + 2) * 3);
  let below = new Float32Array((width + 2) * 3);
  for (let y = 0; y < height; y++) {
    const step = y % 2 === 0 ? 1 : -1;
    for (let i = 0; i < width; i++) {
      const x = step === 1 ? i : width - 1 - i;
      const p = y * width + x;
      if (p >= count) continue;
      const owed = (x + 1) * 3;
      // The wanted color is kept inside the range a pixel can hold, so no error builds up
      // where the picture is darker or brighter than any color of the palette.
      const r = Math.min(255, Math.max(0, Math.round(rgba[p * 4] + row[owed])));
      const g = Math.min(255, Math.max(0, Math.round(rgba[p * 4 + 1] + row[owed + 1])));
      const b = Math.min(255, Math.max(0, Math.round(rgba[p * 4 + 2] + row[owed + 2])));
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      let k = found[key];
      if (k < 0) {
        k = nearest(flat, r, g, b);
        found[key] = k;
      }
      index[p] = k;
      const ahead = owed + step * 3;
      const behind = owed - step * 3;
      for (let c = 0; c < 3; c++) {
        const error = (c === 0 ? r : c === 1 ? g : b) - flat[k * 3 + c];
        if (!error) continue;
        row[ahead + c] += (error * 7) / 16;
        below[behind + c] += (error * 3) / 16;
        below[owed + c] += (error * 5) / 16;
        below[ahead + c] += error / 16;
      }
    }
    const spent = row;
    row = below;
    below = spent.fill(0);
  }
  return { palette, index };
}

/**
 * The colors of one frame, and each pixel's place among them.
 * `rgba` is four bytes a pixel, row by row, and `width` is the number of pixels in a row.
 */
export function indexFrame(rgba: Pixels, width: number): IndexedFrame {
  return isColorPicture(rgba) ? colorFrame(rgba, width) : grayFrame(rgba);
}
