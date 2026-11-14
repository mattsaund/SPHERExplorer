// Keeps the view in the page address, so a link reopens the same target and settings
// and the tool can be embedded in other pages with coordinates in the URL.
//
//   ?target=Barnard's Star            a name, resolved on load
//   ?ra=133.76&dec=-7.24              or J2000 coordinates in degrees
//   ?ra=08h55m10.8s&dec=-07d14m42s    or in any written form the search box reads
//   &fov=300                          field width in arcseconds
//   &mode=visits                      exposures, visits, channels, or deep
//   &color=wide                       full color with a recipe id
//   &det=56                           detectors switched on
//   &sub=first                        show only changes: first, previous, or others
//   &play=1                           start playing when the images arrive
//   &layer=wise&ch=47&proj=SIN        sky map layer, SPHEREx channel, and map shape
//   &embed=1                          compact layout for a frame inside another page
//
// docs/embedding.md is the public reference for these.
//
// Written with Claude Code (Anthropic) assistance.
import { parseCoordinates } from "./astro";
import { COLOR_PRESETS } from "./colorBands";
import { PROJECTIONS, SKY_LAYERS } from "./skyLayers";
import type { AppState } from "./store";
import type { SequenceMode, Subtract } from "./types";

const MODES: SequenceMode[] = ["exposures", "visits", "channels", "deep"];
const SUBTRACTS: Subtract[] = ["first", "previous", "others"];

/** What a link asks for. Every field is optional. */
export interface LinkState {
  target?: string;
  ra?: number;
  dec?: number;
  fieldSize?: number;
  mode?: SequenceMode;
  /** Color recipe id, or null for single-color display. */
  color?: string | null;
  detectors?: boolean[];
  /** What to subtract from each image, to show only what changed. */
  subtract?: Subtract;
  /** Start playing once the images have arrived. */
  play?: boolean;
  layer?: string;
  channel?: number;
  projection?: string;
  embed?: boolean;
}

/** True for text such as "133.76" or "-7.24", with nothing but a number in it. */
function plainNumber(text: string): boolean {
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(text);
}

/** A number from the address, or undefined when it is missing, not a number, or out of range. */
function number(params: URLSearchParams, name: string, min: number, max: number): number | undefined {
  const text = params.get(name);
  if (text === null || text.trim() === "") return undefined;
  const value = Number(text);
  return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

/** Parse a query string. Unknown or out-of-range values are ignored. */
export function parseLink(search: string): LinkState {
  const params = new URLSearchParams(search);
  const link: LinkState = {};
  const target = params.get("target")?.trim();
  if (target) link.target = target.slice(0, 120);
  const raText = params.get("ra")?.trim();
  const decText = params.get("dec")?.trim();
  if (raText && decText) {
    if (plainNumber(raText) && plainNumber(decText)) {
      // Plain numbers always mean degrees.
      const ra = number(params, "ra", 0, 360);
      const dec = number(params, "dec", -90, 90);
      if (ra !== undefined && dec !== undefined) {
        link.ra = ra === 360 ? 0 : ra;
        link.dec = dec;
      }
    } else {
      // Anything else is read the way the search box reads it, such as 08h55m10.8s and -07d14m42s.
      const position = parseCoordinates(`${raText} ${decText}`);
      if (position) {
        link.ra = position.ra;
        link.dec = position.dec;
      }
    }
  }
  link.fieldSize = number(params, "fov", 60, 3600);
  const mode = params.get("mode") as SequenceMode | null;
  if (mode && MODES.includes(mode)) link.mode = mode;
  const color = params.get("color");
  if (color !== null) link.color = COLOR_PRESETS.some((preset) => preset.id === color) ? color : null;
  const det = params.get("det");
  if (det && /^[1-6]+$/.test(det)) link.detectors = [1, 2, 3, 4, 5, 6].map((d) => det.includes(String(d)));
  const subtract = params.get("sub") as Subtract | null;
  if (subtract && SUBTRACTS.includes(subtract)) link.subtract = subtract;
  if (params.get("play") === "1") link.play = true;
  const layer = params.get("layer");
  if (layer && SKY_LAYERS.some((entry) => entry.id === layer)) link.layer = layer;
  link.channel = number(params, "ch", 0, 101);
  const projection = params.get("proj");
  if (projection && PROJECTIONS.some((entry) => entry.id === projection)) link.projection = projection;
  if (params.get("embed") === "1") link.embed = true;
  for (const key of Object.keys(link) as (keyof LinkState)[]) if (link[key] === undefined) delete link[key];
  return link;
}

/** Choices for a link that differ from the page as it is now. */
export interface LinkOptions {
  /** Ask for the compact layout. Defaults to how the page itself was opened. */
  embed?: boolean;
  /** Start playing when the images arrive. */
  play?: boolean;
}

/** The query string that reopens the current view. Defaults are left out to keep links short. */
export function buildLink(state: AppState, options: LinkOptions = {}): string {
  const params = new URLSearchParams();
  const target = state.target;
  if (target) {
    // A resolved name carries motion, so prefer it. Plain positions are stored as numbers.
    if (target.name && target.source) params.set("target", target.name);
    else {
      params.set("ra", target.ra.toFixed(5));
      params.set("dec", target.dec.toFixed(5));
    }
    if (state.fieldSize !== 300) params.set("fov", String(state.fieldSize));
    if (state.mode !== "exposures") params.set("mode", state.mode);
    if (state.display.color) params.set("color", state.display.bands.id);
    if (state.filters.detectors.some((on) => !on)) {
      params.set("det", state.filters.detectors.map((on, i) => (on ? String(i + 1) : "")).join(""));
    }
    if (state.subtract !== "none") params.set("sub", state.subtract);
    if (options.play) params.set("play", "1");
  }
  if (state.map.layer !== "spherex") params.set("layer", state.map.layer);
  if (state.map.layer === "spherex" && state.map.channel !== 20) params.set("ch", String(state.map.channel));
  if (state.map.projection !== "AIT") params.set("proj", state.map.projection);
  if (options.embed ?? state.embed) params.set("embed", "1");
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Default size of an embedded viewer, in CSS pixels. Small enough for a blog column. */
export const EMBED_SIZE = { width: 640, height: 560 };

/** Escape text for use inside a double-quoted HTML attribute. */
function attribute(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * HTML that puts the current view inside another web page.
 * `address` is the page address without its query string.
 */
export function embedSnippet(state: AppState, address: string, width = EMBED_SIZE.width, height = EMBED_SIZE.height): string {
  const link = address + buildLink(state, { embed: true, play: state.player.playing });
  const target = state.target;
  const subject = target?.name ?? (target ? `RA ${target.ra.toFixed(4)}, Dec ${target.dec.toFixed(4)}` : "the sky");
  return `<iframe src="${attribute(link)}" width="${Math.round(width)}" height="${Math.round(height)}" style="border:0;max-width:100%" loading="lazy" allowfullscreen title="${attribute(`SPHEREx images of ${subject}`)}"></iframe>`;
}
