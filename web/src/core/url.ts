// Keeps the view in the page address, so a link reopens the same target and settings
// and the tool can be embedded in other pages with coordinates in the URL.
// Written with Claude Code (Anthropic) assistance.
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
// A link made by the tool carries the whole view, so it reopens exactly what was on screen:
//
//   &view=images&tool=graphs          which screen is up (map, images, both), and the open tool tab
//   &t=60961.4330&w=3.421             the image on screen, by its time (Modified Julian Date) and wavelength (microns)
//   &zoom=2.5&x=30&y=-20              zoom of the image, and its pan in arcseconds east and north
//   &curve=log&lo=-2&hi=80            brightness curve, black point, white point
//   &cmap=viridis&inv=1&smooth=1      color table, inverted, smoothed
//   &marks=mog                        marks on the image: m target, o objects, g Gaia, c changes, f flags
//   &follow=0                         hold the sky still instead of following a moving target (1 follows it)
//   &fps=8                            film speed in steps per second
//   &blink=wise-w2                    blinking against an older survey
//   &plot=vps&ap=12&rs=0.5&feat=water,co2   spectrum options (v by visit, p points, l log, s surveys),
//                                     measuring circle (arcseconds, or "halo"), redshift, marked features
//   &spot=40,-12                      take the spectrum of this spot, arcseconds east and north of the center
//   &mra=83.6&mdec=22.0&mfov=1.5      where the sky map looks, and how wide in degrees
//   &ov=lsgc                          on the map: l labels, s solar system, g grid, c coverage, d deep fields, t tiles
//
// Anything left at its default is left out, so a plain view still makes a short link.
// docs/embedding.md is the public reference for these.
import { parseCoordinates, separation } from "./astro";
import { BLINK_PARTNERS } from "./blink";
import { COLOR_PRESETS } from "./colorBands";
import { COLOR_MAPS } from "./colormaps";
import { mapHome } from "./field";
import { LINE_FAMILIES } from "./lines";
import { PROJECTIONS, SKY_LAYERS } from "./skyLayers";
import type { AppState } from "./store";
import type { BlinkChoice, ColorMap, Screen, SequenceItem, SequenceMode, Stretch, Subtract } from "./types";

const MODES: SequenceMode[] = ["exposures", "visits", "channels", "deep"];
const SUBTRACTS: Subtract[] = ["first", "previous", "others"];
const STRETCHES: Stretch[] = ["linear", "sqrt", "log", "asinh"];
const SCREENS: Screen[] = ["map", "images", "both"];

/**
 * Switches that travel as one short word, a letter per switch that is on.
 * `fallback` is the word when every switch is at its default, which is then left out of the link.
 */
const MARKS = { letters: { m: "showMarker", o: "showObjects", g: "showGaia", c: "showChanges", f: "showFlags" }, fallback: "moc" } as const;
const PLOT = { letters: { v: "perVisit", p: "showPoints", l: "log", s: "showSurveys" }, fallback: "vps" } as const;
const OVERLAYS = { letters: { l: "labels", s: "solar", g: "grid", c: "coverage", d: "deepFields", t: "tiles" }, fallback: "ls" } as const;

/** The word for a set of switches: one letter for each that is on, or "0" when none is. */
function toWord<K extends string>(set: { letters: Record<string, K> }, values: Record<K, boolean>): string {
  const word = Object.entries(set.letters).filter(([, name]) => values[name as K]).map(([letter]) => letter).join("");
  return word || "0";
}

/** The switches a word stands for, or undefined when the word holds a letter that means nothing. */
function fromWord<K extends string>(set: { letters: Record<string, K> }, word: string | null): Record<K, boolean> | undefined {
  if (word === null || word === "") return undefined;
  const letters = word === "0" ? [] : word.split("");
  if (letters.some((letter) => !(letter in set.letters))) return undefined;
  return Object.fromEntries(Object.entries(set.letters).map(([letter, name]) => [name, letters.includes(letter)])) as Record<K, boolean>;
}

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

  // ---- The rest of the view, so a link reopens exactly what was on screen ----
  /** Which screen is up, and which tool tab is open. The page itself keeps these. */
  view?: Screen;
  tool?: string;
  /** The image on screen, by its time as a Modified Julian Date and its wavelength in microns. */
  time?: number;
  wavelength?: number;
  /** Zoom of the image, and its pan in arcseconds east and north. */
  zoom?: number;
  east?: number;
  north?: number;
  stretch?: Stretch;
  lo?: number;
  hi?: number;
  colorMap?: ColorMap;
  invert?: boolean;
  smooth?: boolean;
  /** Which marks are drawn on the image. */
  marks?: { showMarker: boolean; showObjects: boolean; showGaia: boolean; showChanges: boolean; showFlags: boolean };
  /** Whether a moving target is kept centered when frames are summed. False holds the sky still. */
  follow?: boolean;
  fps?: number;
  /** Blink against this older survey. */
  blink?: BlinkChoice;
  /** Spectrum plot options, the measuring circle, the redshift, and the marked feature families. */
  plot?: { perVisit: boolean; showPoints: boolean; log: boolean; showSurveys: boolean };
  aperture?: number | "halo";
  redshift?: number;
  families?: string[];
  /** A spot to take the spectrum of, as arcseconds [east, north] of the field center. */
  spot?: [number, number];
  /** Where the sky map looks, and how wide in degrees. */
  mapRa?: number;
  mapDec?: number;
  mapFov?: number;
  /** What is drawn over the sky map. */
  overlays?: { labels: boolean; solar: boolean; grid: boolean; coverage: boolean; deepFields: boolean; tiles: boolean };
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

  // The rest of the view. Each value is checked like the ones above.
  const view = params.get("view") as Screen | null;
  if (view && SCREENS.includes(view)) link.view = view;
  const tool = params.get("tool");
  if (tool && /^[a-z]{2,20}$/.test(tool)) link.tool = tool;
  link.time = number(params, "t", 58000, 80000);
  link.wavelength = number(params, "w", 0.5, 6);
  link.zoom = number(params, "zoom", 0.5, 40);
  link.east = number(params, "x", -3600, 3600);
  link.north = number(params, "y", -3600, 3600);
  const stretch = params.get("curve") as Stretch | null;
  if (stretch && STRETCHES.includes(stretch)) link.stretch = stretch;
  link.lo = number(params, "lo", -1000, 1000);
  link.hi = number(params, "hi", -1000, 100000);
  const colorMap = params.get("cmap") as ColorMap | null;
  if (colorMap && COLOR_MAPS.includes(colorMap)) link.colorMap = colorMap;
  if (params.get("inv") === "1") link.invert = true;
  if (params.get("smooth") === "1") link.smooth = true;
  link.marks = fromWord(MARKS, params.get("marks"));
  const follow = params.get("follow");
  if (follow === "0" || follow === "1") link.follow = follow === "1";
  link.fps = number(params, "fps", 0.5, 30);
  const blink = params.get("blink") as BlinkChoice | null;
  if (blink && (blink === "auto" || BLINK_PARTNERS.some((partner) => partner.id === blink))) link.blink = blink;
  link.plot = fromWord(PLOT, params.get("plot"));
  if (params.get("ap") === "halo") link.aperture = "halo";
  else link.aperture = number(params, "ap", 4, 120);
  const spot = (params.get("spot") ?? "").split(",").map(Number);
  if (spot.length === 2 && spot.every((value) => Number.isFinite(value) && Math.abs(value) <= 3600)) link.spot = [spot[0], spot[1]];
  link.redshift = number(params, "rs", 0, 12);
  const families = params.get("feat");
  if (families !== null) {
    const known = families.split(",").filter((id) => LINE_FAMILIES.some((family) => family.id === id));
    if (known.length) link.families = known;
  }
  const mapRa = number(params, "mra", 0, 360);
  const mapDec = number(params, "mdec", -90, 90);
  if (mapRa !== undefined && mapDec !== undefined) {
    link.mapRa = mapRa === 360 ? 0 : mapRa;
    link.mapDec = mapDec;
  }
  link.mapFov = number(params, "mfov", 0.001, 360);
  link.overlays = fromWord(OVERLAYS, params.get("ov"));

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

/** The whole-sky view the map opens with: its center and its width in degrees. */
export const MAP_HOME = { ra: 266.4, dec: -29.0, fov: 200 };
/** How wide the map is after it has gone to a target, in degrees. */
export const MAP_NEAR = 2;
/** The brightness scale a view starts with, and the one that showing only changes switches to. */
export const LEVELS = { stretch: "asinh", lo: -3, hi: 60 } as const;
export const CHANGE_LEVELS = { stretch: "linear", lo: -12, hi: 12 } as const;

/** A short decimal: enough digits to be exact for the eye, with no trailing zeros. */
function short(value: number, places: number): string {
  return String(Number(value.toFixed(places)));
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
  const embed = options.embed ?? state.embed;
  if (embed) params.set("embed", "1");
  imageView(state, params);
  // The compact layout has no map, no tools, and no settings, so its link stops at the image.
  if (!embed) pageView(state, params);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The image itself: which step is up, how it is zoomed, and how it is drawn. Defaults are left out. */
function imageView(state: AppState, params: URLSearchParams): void {
  const { display, view, player } = state;
  if (state.target) {
    // The step on screen, by time and wavelength, not by its number in the film. A link then
    // still lands on the same image after a new data release has added images before it.
    const step = state.sequence[player.index];
    if (step && player.index > 0) {
      if (state.mode !== "channels" && Number.isFinite(step.mjd)) params.set("t", step.mjd.toFixed(4));
      if ((state.mode === "exposures" || state.mode === "channels") && Number.isFinite(step.wavelength)) params.set("w", step.wavelength.toFixed(3));
    }
    if (Math.abs(view.zoom - 1) > 0.005) params.set("zoom", short(view.zoom, 2));
    if (Math.abs(view.east) > 0.05 || Math.abs(view.north) > 0.05) {
      params.set("x", short(view.east, 1));
      params.set("y", short(view.north, 1));
    }
    // A moving target is followed, except while showing only changes, which holds the sky still.
    if (state.follow !== (state.subtract === "none")) params.set("follow", state.follow ? "1" : "0");
    if (player.fps !== 6) params.set("fps", short(player.fps, 1));
  }
  // Showing only changes has its own brightness scale, centered on zero.
  const usual = state.subtract === "none" ? LEVELS : CHANGE_LEVELS;
  if (display.stretch !== usual.stretch) params.set("curve", display.stretch);
  if (display.lo !== usual.lo) params.set("lo", short(display.lo, 2));
  if (display.hi !== usual.hi) params.set("hi", short(display.hi, 2));
  if (display.colorMap !== "gray") params.set("cmap", display.colorMap);
  if (display.invert) params.set("inv", "1");
  if (display.smooth) params.set("smooth", "1");
  const marks = toWord(MARKS, display);
  if (marks !== MARKS.fallback) params.set("marks", marks);
}

/** The page around the image: the screen, the open tool, the spectrum, and the sky map. Defaults are left out. */
function pageView(state: AppState, params: URLSearchParams): void {
  const { spectrum, map, layout, blink } = state;
  const target = state.target;

  // A study opens with the map and the images side by side. Without one, the map is alone.
  if (layout.screen !== (target ? "both" : "map")) params.set("view", layout.screen);
  if (layout.tool) params.set("tool", layout.tool);

  if (target) {
    if (blink.on) params.set("blink", blink.choice);
    const plot = toWord(PLOT, spectrum);
    if (plot !== PLOT.fallback) params.set("plot", plot);
    if (spectrum.halo) params.set("ap", "halo");
    else if (spectrum.aperture !== null) params.set("ap", short(spectrum.aperture, 1));
    if (spectrum.redshift > 0) params.set("rs", short(spectrum.redshift, 3));
    if (spectrum.families.length) params.set("feat", spectrum.families.join(","));
    if (spectrum.probe) params.set("spot", spectrum.probe.map((value) => short(value, 1)).join(","));
  }

  // The sky map goes to a study by itself: centered on it, MAP_NEAR degrees wide. Where the
  // map looks is written only when it differs from that, and never while a study is still
  // being found, when the map has not moved yet.
  const studied = mapHome(state);
  if (map.ready && state.targetState !== "loading" && (studied || !target)) {
    const home = studied ? { ra: studied.ra, dec: studied.dec, fov: MAP_NEAR } : MAP_HOME;
    const offCenter = separation(map.center, home).arcsec / 3600 > 0.02 * map.fov;
    const offZoom = Math.abs(map.fov - home.fov) > 0.05 * home.fov;
    if (offCenter || offZoom) {
      // Finer steps for a closer view: about a thousandth of the view's width.
      const places = Math.min(5, Math.max(1, Math.ceil(3 - Math.log10(map.fov))));
      params.set("mra", short(map.center.ra, places));
      params.set("mdec", short(map.center.dec, places));
      params.set("mfov", String(Number(map.fov.toPrecision(3))));
    }
  }
  const overlays = toWord(OVERLAYS, map);
  if (overlays !== OVERLAYS.fallback) params.set("ov", overlays);
}

/**
 * The step of a film that a link points at. Wavelength sums are told apart by wavelength.
 * Every other kind of step is found by its time, and wavelength then separates the two
 * detectors that expose at the same moment. Returns 0 when the link names no step.
 */
export function stepNear(sequence: SequenceItem[], mode: SequenceMode, time?: number, wavelength?: number): number {
  const byWavelength = mode === "channels";
  const [want, tieBreak] = byWavelength ? [wavelength, time] : [time, wavelength];
  if (want === undefined || !sequence.length) return 0;
  const value = (item: SequenceItem) => (byWavelength ? item.wavelength : item.mjd);
  const other = (item: SequenceItem) => (byWavelength ? item.mjd : item.wavelength);
  // Steps this close to the nearest one count as equally near: the last digit a link carries.
  const same = byWavelength ? 1e-3 : 1e-4;
  const gaps = sequence.map((item) => Math.abs(value(item) - want));
  const nearest = Math.min(...gaps.filter(Number.isFinite));
  let best = 0;
  let bestOther = Infinity;
  gaps.forEach((gap, index) => {
    if (!(gap <= nearest + same)) return;
    const miss = tieBreak === undefined ? 0 : Math.abs(other(sequence[index]) - tieBreak);
    const score = Number.isFinite(miss) ? miss : Number.MAX_VALUE;
    if (score < bestOther) {
      best = index;
      bestOther = score;
    }
  });
  return best;
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
