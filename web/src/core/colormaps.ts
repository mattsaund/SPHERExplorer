// Color tables for images, as 256-entry RGBA lookup tables.
// Key colors follow the matplotlib colormaps (CC0), which are built to be readable
// for people with color-vision deficiency. Stops are joined by straight lines.
// Written with Claude Code (Anthropic) assistance.
import type { ColorMap } from "./types";

const STOPS: Record<ColorMap, string[]> = {
  gray: ["#000000", "#ffffff"],
  viridis: ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"],
  magma: ["#000004", "#180f3d", "#440f76", "#721f81", "#9e2f7f", "#cd4071", "#f1605d", "#fd9668", "#feca8d", "#fcfdbf"],
  inferno: ["#000004", "#1b0c41", "#4a0c6b", "#781c6d", "#a52c60", "#cf4446", "#ed6925", "#fb9b06", "#f7d13d", "#fcffa4"],
  plasma: ["#0d0887", "#46039f", "#7201a8", "#9c179e", "#bd3786", "#d8576b", "#ed7953", "#fb9f3a", "#fdca26", "#f0f921"],
  cividis: ["#00224e", "#123570", "#3b496c", "#575d6d", "#707173", "#8a8678", "#a59c74", "#c3b369", "#e1cc55", "#fee838"],
};

export const COLOR_MAPS = Object.keys(STOPS) as ColorMap[];

/** A color written as "#rrggbb" as three numbers from 0 to 255. */
function hex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const cache = new Map<ColorMap, Uint8Array>();

/** 256 RGBA entries for a color table. */
export function colorTable(name: ColorMap): Uint8Array {
  const hit = cache.get(name);
  if (hit) return hit;
  const stops = STOPS[name].map(hex);
  const table = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const position = (i / 255) * (stops.length - 1);
    const low = Math.min(stops.length - 2, Math.floor(position));
    const t = position - low;
    for (let c = 0; c < 3; c++) table[i * 4 + c] = Math.round(stops[low][c] * (1 - t) + stops[low + 1][c] * t);
    table[i * 4 + 3] = 255;
  }
  cache.set(name, table);
  return table;
}
