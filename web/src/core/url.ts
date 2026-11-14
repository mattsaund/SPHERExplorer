// Keeps the view in the page address, so a link reopens the same target and settings
// and the tool can be embedded in other pages with coordinates in the URL.
//
//   ?target=Barnard's Star            a name, resolved on load
//   ?ra=133.76&dec=-7.24              or coordinates in degrees
//   &fov=300                          field width in arcseconds
//   &mode=visits                      exposures, visits, channels, or deep
//   &color=wide                       full color with a recipe id
//   &det=56                           detectors switched on
//   &layer=wise&ch=47&proj=SIN        sky map layer, SPHEREx channel, and map shape
//   &embed=1                          ask the UI for a compact layout
//
// Written with Claude Code (Anthropic) assistance.
import { COLOR_PRESETS } from "./colorBands";
import { PROJECTIONS, SKY_LAYERS } from "./skyLayers";
import type { AppState } from "./store";
import type { SequenceMode } from "./types";

const MODES: SequenceMode[] = ["exposures", "visits", "channels", "deep"];

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
  layer?: string;
  channel?: number;
  projection?: string;
  embed?: boolean;
}

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
  const ra = number(params, "ra", 0, 360);
  const dec = number(params, "dec", -90, 90);
  if (ra !== undefined && dec !== undefined) {
    link.ra = ra === 360 ? 0 : ra;
    link.dec = dec;
  }
  link.fieldSize = number(params, "fov", 60, 3600);
  const mode = params.get("mode") as SequenceMode | null;
  if (mode && MODES.includes(mode)) link.mode = mode;
  const color = params.get("color");
  if (color !== null) link.color = COLOR_PRESETS.some((preset) => preset.id === color) ? color : null;
  const det = params.get("det");
  if (det && /^[1-6]+$/.test(det)) link.detectors = [1, 2, 3, 4, 5, 6].map((d) => det.includes(String(d)));
  const layer = params.get("layer");
  if (layer && SKY_LAYERS.some((entry) => entry.id === layer)) link.layer = layer;
  link.channel = number(params, "ch", 0, 101);
  const projection = params.get("proj");
  if (projection && PROJECTIONS.some((entry) => entry.id === projection)) link.projection = projection;
  if (params.get("embed") === "1") link.embed = true;
  for (const key of Object.keys(link) as (keyof LinkState)[]) if (link[key] === undefined) delete link[key];
  return link;
}

/** The query string that reopens the current view. Defaults are left out to keep links short. */
export function buildLink(state: AppState): string {
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
  }
  if (state.map.layer !== "spherex") params.set("layer", state.map.layer);
  if (state.map.layer === "spherex" && state.map.channel !== 20) params.set("ch", String(state.map.channel));
  if (state.map.projection !== "AIT") params.set("proj", state.map.projection);
  if (state.embed) params.set("embed", "1");
  const text = params.toString();
  return text ? `?${text}` : "";
}
