// Central app state. UI components read slices with useStore and change state through actions.
// Written with Claude Code (Anthropic) assistance.
import { create } from "zustand";
import { ApiError, getKnown, getMeta, getMissions, getNeossat, getObjects, getSpacecraft, getSuggestions, resolveName, searchFrames, searchMoving, streamCutouts, type WireFrame } from "./api";
import { assignSeasons, parseCoordinates, positionAt, skyOffset, summarizeVisits } from "./astro";
import { BLINK_MS } from "./blink";
import { findChanges, type ChangeReport, type FoundChange } from "./changes";
import { COLOR_PRESETS } from "./colorBands";
import { exportAllFits, exportAnimation, exportChanges, exportFits, exportImage, exportLightCurve, exportSpectrum } from "./export";
import { spectrumFeatures } from "./features";
import { clearPixels, imageOf, setPixels } from "./pixels";
import { measureMotion, type MotionFit } from "./motion";
import { buildSequence } from "./sequence";
import { loadRecent, localSuggestions, mergeSuggestions, rememberSearch, type Recent, type Suggestion } from "./suggest";
import { buildLink, embedSnippet, parseLink } from "./url";
import type { BlinkChoice, BlinkState, DisplaySettings, Filters, Frame, Hover, KnownCheck, LoadState, MapState, Meta, MissionData, PartnerData, Player, SequenceItem, SequenceMode, SkyObject, SkyPosition, SpacecraftInfo, SpacecraftNow, SpectrumSettings, Subtract, Target, Visit } from "./types";

/** Where the frame view is looking. */
export interface View {
  /** Sky offset of the view center from the field center, arcseconds. */
  east: number;
  north: number;
  /** 1 fits the whole field in the view. Larger is closer. */
  zoom: number;
}

export interface AppState {
  /** Instrument facts and live collections. Null until the first load. */
  meta: Meta | null;
  /** Counts target loads. Caches use it to tell one target's frames from the next. */
  session: number;
  /** The place being studied, or null before the first search. */
  target: Target | null;
  /** Progress of the search for images of the target. */
  targetState: LoadState;
  /** Plain-language reason when something failed. */
  error: string | null;
  /** Plain-language note that is not a failure, for example a partial search. */
  notice: string | null;
  /** Width of the studied field in arcseconds. */
  fieldSize: number;
  /** Every image of the target, in time order. */
  frames: Frame[];
  /** The visits the images fall into. */
  visits: Visit[];
  /** Known objects inside the studied field, best known first. */
  fieldObjects: SkyObject[];
  /**
   * Fast-moving known objects near a position that was typed as plain coordinates.
   * Old coordinates of a nearby star are often where it used to be, so the UI can offer to follow it.
   */
  movers: SkyObject[];
  /** What Gaia, 2MASS, and WISE recorded in the field. Null until it arrives. */
  missions: MissionData | null;
  /** Visible-light images of the field from NEOSSat (Canadian Space Agency). Null until it arrives. */
  partner: PartnerData | null;
  /** Progress of the pixel download. */
  framesState: LoadState;
  /** Frames whose pixels have arrived, and frames that failed. */
  loaded: number;
  /** Images found but not loaded, to keep the page fast, when a field has more than the page can hold. Zero when all are loaded. */
  leftOut: number;
  failed: number;
  filters: Filters;
  mode: SequenceMode;
  /** The steps the player moves through. Rebuilt as frames arrive and filters change. */
  sequence: SequenceItem[];
  player: Player;
  display: DisplaySettings;
  view: View;
  /** Keep a moving target centered when frames are summed. */
  follow: boolean;
  /** What to subtract from the image on screen, to show only what changed. */
  subtract: Subtract;
  /** What is under the pointer in the frame view. */
  hover: Hover | null;
  spectrum: SpectrumSettings;
  /** True when the page was opened with embed=1, to sit inside another site. The UI should use a compact layout. */
  embed: boolean;
  /** Progress of an animation being saved, from 0 to 1, or null when none is running. */
  exporting: number | null;
  /** True while the zip of FITS files is being made by the server and downloaded. */
  packing: boolean;
  /** The measured motion of the source at the target, from actions.measureMotion. Null until measured. */
  motion: MotionFit | null;
  /** What moved or changed brightness anywhere in the field, from actions.findChanges. Null until searched. */
  changes: ChangeReport | null;
  /** Progress of a search for changes, from 0 to 1, or null when none is running. */
  finding: number | null;
  /** Rows for the search box dropdown, for the text last passed to actions.suggest. */
  suggestions: Suggestion[];
  /** Whether a known solar system body was at the picked spot, from actions.identify. Null until asked. */
  known: KnownCheck | null;
  /** Orbital elements and archive facts for the spacecraft view. Null until loaded. */
  spacecraft: SpacecraftInfo | null;
  /** Where the spacecraft is this second. Updated while the orbit view is on the page. */
  spacecraftNow: SpacecraftNow | null;
  /** Where every telescope in Earth orbit is this second, by telescope id. Updated while the orbit view is on the page. */
  craftNow: Record<string, SpacecraftNow>;
  /** Blinking the image against an older survey's picture, from actions.setBlink. */
  blink: BlinkState;
  map: MapState;
  /** The sky position under the pointer on the map, or null when the pointer is elsewhere. */
  mapHover: SkyPosition | null;
  /** A request to move the map. The map acts when `token` changes. */
  mapGoal: { ra: number; dec: number; fov: number | null; token: number };
}

/** True when the page address asks for the compact layout. Read before the first render, so the full layout never flashes. */
function openedEmbedded(): boolean {
  return typeof window !== "undefined" && parseLink(window.location.search).embed === true;
}

/** Most image pixels held for one target. About 120 MB as received, more once sums are built. */
const PIXEL_BUDGET = 6e7;
/** Always load at least this many images, however wide the field. */
const MIN_FRAMES = 60;

/** Proper motion, in mas per year, above which a nearby object is offered as "did you mean". */
const FAST_MOTION = 150;

/** The all-sky cube has no image in these two channels, which sit on the dichroic edge. */
const BLANK_CHANNELS = [50, 51];

const DEFAULT_FILTERS: Filters = { detectors: [true, true, true, true, true, true], wlMin: 0.7, wlMax: 5.1 };
const DEFAULT_DISPLAY: DisplaySettings = {
  color: false,
  bands: COLOR_PRESETS[0],
  stretch: "asinh",
  lo: -3,
  hi: 60,
  colorMap: "gray",
  invert: false,
  smooth: false,
  normalize: true,
  showFlags: false,
  showMarker: true,
  showObjects: true,
  showGaia: false,
  showChanges: true,
};

export const useStore = create<AppState>(() => ({
  meta: null,
  session: 0,
  target: null,
  targetState: "idle",
  error: null,
  notice: null,
  fieldSize: 300,
  frames: [],
  visits: [],
  fieldObjects: [],
  movers: [],
  missions: null,
  partner: null,
  framesState: "idle",
  loaded: 0,
  leftOut: 0,
  failed: 0,
  filters: DEFAULT_FILTERS,
  mode: "exposures",
  sequence: [],
  player: { index: 0, playing: false, fps: 6 },
  display: DEFAULT_DISPLAY,
  view: { east: 0, north: 0, zoom: 1 },
  follow: true,
  subtract: "none",
  hover: null,
  spectrum: { log: false, perVisit: true, showPoints: true, showSurveys: true, aperture: null, halo: false, probe: null, families: [], redshift: 0 },
  embed: openedEmbedded(),
  exporting: null,
  packing: false,
  motion: null,
  changes: null,
  finding: null,
  suggestions: [],
  known: null,
  spacecraft: null,
  spacecraftNow: null,
  craftNow: {},
  blink: { on: false, choice: "auto", older: false },
  map: {
    ready: false,
    failure: null,
    projection: "AIT",
    layer: "spherex",
    channel: 20,
    grid: false,
    labels: true,
    center: { ra: 266.4, dec: -29.0 },
    fov: 200,
    objects: [],
    objectsState: "idle",
    selected: null,
    selectedIn: "map",
    picked: null,
    pickedIn: "map",
    fieldShown: false,
    coverage: false,
    deepFields: false,
    tiles: false,
    solar: true,
    measuring: false,
    measured: null,
  },
  mapHover: null,
  mapGoal: { ra: 266.4, dec: -29.0, fov: 200, token: 0 },
}));

const set = useStore.setState;
const get = useStore.getState;

// ---- Loading -------------------------------------------------------------------------------

let metaRequest: Promise<Meta> | null = null;

/** Load the instrument facts once. */
function ensureMeta(): Promise<Meta> {
  metaRequest ??= getMeta().then(
    (meta) => {
      set({ meta });
      return meta;
    },
    (error) => {
      metaRequest = null; // let a later call try again
      throw error;
    },
  );
  return metaRequest;
}

/** Counts loads so a slow, older one can't overwrite a newer one. */
let generation = 0;
let abort: AbortController | null = null;

/** Rebuild the sequence, keeping the player on the same step when it still exists. */
function resequence(frames = get().frames, mode = get().mode, filters = get().filters): Pick<AppState, "sequence" | "player"> {
  const { sequence: before, player } = get();
  const sequence = buildSequence(frames, mode, filters, get().visits);
  const current = before[player.index];
  let index = Math.min(player.index, Math.max(0, sequence.length - 1));
  if (current) {
    // Keys of sums change as members arrive, so match on the part before the member count.
    const stem = current.key.split(":")[0];
    const found = sequence.findIndex((item) => item.key.split(":")[0] === stem);
    if (found >= 0) index = found;
  }
  return { sequence, player: { ...player, index } };
}

/** Take a batch of frames that just arrived: keep their pixels, mark them ready or failed, and rebuild the sequence. */
function applyFrames(batch: WireFrame[], byKey: Map<string, number>): void {
  const frames = get().frames.slice();
  let loaded = get().loaded;
  let failed = get().failed;
  for (const { header, image, flags } of batch) {
    const id = byKey.get(header.key);
    if (id === undefined) continue;
    if (!header.ok || !image) {
      // A target just past a detector edge is expected now and then. Only real failures count.
      const outside = header.code === "outside";
      frames[id] = { ...frames[id], status: outside ? "outside" : "failed", error: header.error ?? "No image data" };
      if (!outside) failed++;
      continue;
    }
    setPixels(id, { nx: header.nx, ny: header.ny, half: image, flags: flags ?? null });
    frames[id] = {
      ...frames[id],
      status: "ready",
      nx: header.nx,
      ny: header.ny,
      cx: header.cx,
      cy: header.cy,
      // The server reports the exact position it centered on (for a body, after the spacecraft shift).
      center: { ra: header.ra, dec: header.dec },
      m: header.m,
      wavelength: header.wl,
      bandwidth: header.bw,
      dwl: header.dwl,
      channel: header.chan,
      mjd: header.mjd ?? frames[id].mjd,
      bg: header.bg,
      rms: header.rms,
      fwhm: header.fwhm,
      bits: header.bits,
      nan: header.nan,
      qa: header.qa,
      phot: header.phot,
    };
    loaded++;
  }
  set({ frames, loaded, failed, ...resequence(frames) });
}

/**
 * The parts of the state that belong to one study, emptied.
 * A new study starts from this, and closing the study ends on it.
 */
function emptyStudy(): Partial<AppState> {
  stopBlink();
  return {
    blink: { ...get().blink, on: false, older: false },
    framesState: "idle",
    frames: [],
    visits: [],
    fieldObjects: [],
    movers: [],
    missions: null,
    partner: null,
    motion: null,
    changes: null,
    finding: null,
    known: null,
    sequence: [],
    loaded: 0,
    leftOut: 0,
    failed: 0,
    error: null,
    notice: null,
    hover: null,
    spectrum: { ...get().spectrum, probe: null, halo: false },
    player: { ...get().player, index: 0, playing: false },
    view: { east: 0, north: 0, zoom: 1 },
  };
}

/** Start a study: find every image of the target, then stream them in. A newer call cancels an older one. */
async function load(target: Target, fieldSize: number): Promise<void> {
  abort?.abort();
  abort = new AbortController();
  const signal = abort.signal;
  const mine = ++generation;
  pause();
  clearPixels();
  set({
    ...emptyStudy(),
    session: mine,
    target,
    targetState: "loading",
    // The picked area has become the field being studied, or been left behind. The map now
    // shows the field's own square. A solar system body has no fixed field to draw.
    map: { ...get().map, picked: null, fieldShown: !target.moving },
  });

  // A solar system body has no fixed field, so there are no field objects or survey matches to fetch.
  const moving = target.moving;

  // Known objects in and around the field. Not essential, so a failure here is silent.
  const reach = Math.max(fieldSize / 3600, 0.1);
  if (!moving) getObjects(target.ra, target.dec, reach, 150, signal).then(
    (objects) => {
      if (mine !== generation) return;
      const half = fieldSize / 2;
      const inField = objects.filter((object) => {
        const [east, north] = skyOffset(object, target);
        return Math.abs(east) <= half && Math.abs(north) <= half;
      });
      // Only a typed position needs the hint. A named target is already the object the person wants.
      const typed = !target.name;
      const movers = typed
        ? objects.filter((object) => Math.hypot(object.pmRa ?? 0, object.pmDec ?? 0) >= FAST_MOTION).sort((a, b) => Math.hypot(b.pmRa ?? 0, b.pmDec ?? 0) - Math.hypot(a.pmRa ?? 0, a.pmDec ?? 0))
        : [];
      set({ fieldObjects: inField, movers });
    },
    () => {},
  );

  // Other missions. The cone is widened by how far the target has moved since 2MASS looked in 1999.
  // The compact layout shows neither these nor partner images, so an embedded viewer skips both requests.
  const compact = get().embed;
  const drift = (Math.hypot(target.pmRa ?? 0, target.pmDec ?? 0) / 1000) * 28;
  if (!moving && !compact) getMissions(target.ra, target.dec, Math.min(1800, fieldSize * 0.75 + drift), signal).then(
    (missions) => {
      if (mine === generation) set({ missions });
    },
    () => {},
  );

  // Partner agency images of the same field.
  if (!moving && !compact) getNeossat(target.ra, target.dec, signal).then(
    (partner) => {
      if (mine === generation) set({ partner });
    },
    () => {},
  );

  try {
    await ensureMeta();
    const result = moving ? await searchMoving(moving.command, signal) : await searchFrames(target.ra, target.dec, signal);
    if (mine !== generation) return;
    const collections = result.collections;
    const f = result.frames;
    const seasons = assignSeasons(f.mjd);
    const frames: Frame[] = f.key.map((key, i) => {
      // A solar system body: the frame is centered on where the body was at that moment.
      const own = f.ra && f.dec ? { ra: f.ra[i], dec: f.dec[i] } : null;
      return {
        id: i,
        key,
        collection: collections[f.coll[i]] ?? "",
        obsId: f.obsid[i],
        detector: f.det[i],
        mjd: f.mjd[i],
        wavelength: f.wl[i] ?? NaN,
        bandwidth: f.bw[i] ?? NaN,
        channel: f.chan[i],
        season: seasons[i],
        track: own ?? positionAt(target, f.mjd[i], [f.pfra[i], f.pfdec[i]]),
        parallaxFactor: [f.pfra[i], f.pfdec[i]] as [number, number],
        center: own ?? { ra: target.ra, dec: target.dec },
        earthDistance: f.delta?.[i],
        sunDistance: f.r?.[i],
        magnitude: f.mag?.[i],
        status: "pending" as const,
      };
    });
    if (moving && frames.length) {
      // Point the target, and the map, at the body's most recent observed position.
      const last = frames[frames.length - 1].track;
      target = { ...target, ra: last.ra, dec: last.dec };
      set({ target });
      actions.flyTo(target, Math.min(get().map.fov, 2));
    }
    set({
      frames,
      visits: summarizeVisits(f.mjd, seasons),
      targetState: "ready",
      framesState: frames.length ? "loading" : "ready",
      notice: result.errors.length ? "The NASA archive is busy, so some images may be missing. Try again in a minute." : null,
    });
    if (!frames.length) return;

    // A wide field times thousands of images is more than a phone can hold. Past the budget,
    // load an even sample across time, which keeps every visit and every wavelength represented.
    const perFrame = (fieldSize / (get().meta?.pixelScale ?? 6.15)) ** 2 * 2;   // the cutout is padded for rotation
    const budget = Math.max(MIN_FRAMES, Math.floor(PIXEL_BUDGET / perFrame));
    let wanted = frames;
    if (frames.length > budget) {
      const stride = frames.length / budget;
      wanted = Array.from({ length: budget }, (_, i) => frames[Math.floor(i * stride)]);
      const keep = new Set(wanted.map((frame) => frame.id));
      set({
        frames: frames.map((frame) => (keep.has(frame.id) ? frame : { ...frame, status: "outside" as const, error: "Not loaded, to keep the page fast" })),
        // The UI says so in its status line. No message box, at Matt's request.
        leftOut: frames.length - budget,
      });
    }

    const byKey = new Map(wanted.map((frame) => [frame.key, frame.id]));
    // Frames arrive in bursts. Apply them in small batches so the page stays smooth.
    let queue: WireFrame[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      if (mine !== generation || !queue.length) return;
      const batch = queue;
      queue = [];
      applyFrames(batch, byKey);
    };
    await streamCutouts(
      {
        ra: target.ra,
        dec: target.dec,
        size: fieldSize,
        frames: wanted.map((frame) =>
          moving
            ? { key: frame.key, ra: frame.track.ra, dec: frame.track.dec, delta: frame.earthDistance }
            : { key: frame.key, pra: frame.track.ra, pdec: frame.track.dec },
        ),
      },
      (frame) => {
        queue.push(frame);
        timer ??= setTimeout(flush, 80);
      },
      signal,
    );
    if (timer) clearTimeout(timer);
    flush();
    if (mine === generation) set({ framesState: "ready" });
  } catch (error) {
    if (mine !== generation || (error as Error).name === "AbortError") return;
    const message = error instanceof ApiError ? error.message : "Something went wrong while loading images.";
    set((state) => ({
      error: message,
      targetState: state.targetState === "loading" ? "failed" : state.targetState,
      framesState: state.framesState === "loading" ? "failed" : state.framesState,
    }));
  }
}

// ---- Playback ------------------------------------------------------------------------------

let ticker: ReturnType<typeof setTimeout> | null = null;

/** One beat of the film: show the next step, and schedule the beat after it. */
function tick(): void {
  const { player, sequence } = get();
  if (!player.playing) return;
  if (sequence.length > 1) set({ player: { ...player, index: (player.index + 1) % sequence.length } });
  ticker = setTimeout(tick, 1000 / player.fps);
}

/** The timer that swaps the two pictures while blinking. */
let blinker: ReturnType<typeof setInterval> | null = null;

/** Stop swapping the two pictures. */
function stopBlink(): void {
  if (blinker) clearInterval(blinker);
  blinker = null;
}

/** Stop the film. */
function pause(): void {
  if (ticker) clearTimeout(ticker);
  ticker = null;
  if (get().player.playing) set({ player: { ...get().player, playing: false } });
}

// ---- Actions -------------------------------------------------------------------------------

/** True once init has read the page address. */
let started = false;

/** Searches run before, newest first. Read from the browser the first time they are needed. */
let recent: Recent[] | null = null;
/** The pending lookup of suggestions on the server, and the way to cancel it. */
let suggestTimer: ReturnType<typeof setTimeout> | null = null;
let suggestAbort: AbortController | null = null;
/** How long typing must pause before the server is asked, in milliseconds. */
const SUGGEST_PAUSE = 250;
/** Suggestions from the server for texts already asked, so retyping costs nothing. */
const suggestCache = new Map<string, Suggestion[]>();

/** The pending lookup of known solar system bodies, and how far around a spot it looks, arcseconds. */
let knownAbort: AbortController | null = null;
const KNOWN_RADIUS = 120;
/** The widest search for known bodies, arcseconds. Covers the corners of the largest field. */
const KNOWN_REACH = 2700;

/** True once the spacecraft facts have been asked for. */
let spacecraftRequested = false;

/** Display settings to restore when subtraction is switched off. */
let beforeSubtract: { follow: boolean; lo: number; hi: number; color: boolean; stretch: DisplaySettings["stretch"] } | null = null;

/** Every state change goes through here so the UI never touches the engine internals. */
export const actions = {
  /** Start the engine: load the instrument facts and open whatever the page address asks for. Safe to call more than once. */
  init(): void {
    ensureMeta().catch(() => set({ error: "Can't reach the SPHERExplorer server. Check your connection and try again." }));
    if (started || typeof window === "undefined") return;
    started = true;
    const link = parseLink(window.location.search);
    const state = get();
    set({
      embed: link.embed ?? false,
      fieldSize: link.fieldSize ?? state.fieldSize,
      mode: link.mode ?? state.mode,
      filters: link.detectors ? { ...state.filters, detectors: link.detectors } : state.filters,
      display: link.color ? { ...state.display, color: true, bands: COLOR_PRESETS.find((p) => p.id === link.color) ?? state.display.bands } : state.display,
      map: { ...state.map, layer: link.layer ?? state.map.layer, channel: link.channel ?? state.map.channel, projection: link.projection ?? state.map.projection },
    });
    if (link.subtract) actions.setSubtract(link.subtract);
    if (link.play) {
      // Start the little video once, as soon as every image of the first target is in.
      const stop = useStore.subscribe((next) => {
        if (next.framesState !== "ready") return;
        stop();
        if (next.sequence.length > 1) actions.play();
      });
    }
    if (link.target) void actions.search(link.target);
    else if (link.ra !== undefined && link.dec !== undefined) actions.goTo({ ra: link.ra, dec: link.dec, epoch: 2026.0 });
    // Keep the address in step with the view, without adding browser history entries.
    let pending: ReturnType<typeof setTimeout> | null = null;
    useStore.subscribe((next, before) => {
      if (next.target === before.target && next.fieldSize === before.fieldSize && next.mode === before.mode && next.display === before.display && next.filters === before.filters && next.subtract === before.subtract && next.map.layer === before.map.layer && next.map.channel === before.map.channel && next.map.projection === before.map.projection) return;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        const address = window.location.pathname + buildLink(get()) + window.location.hash;
        window.history.replaceState(null, "", address);
      }, 300);
    });
  },

  /** A full link that reopens the current view in the whole tool, never in the compact layout. */
  shareLink(): string {
    return window.location.origin + window.location.pathname + buildLink(get(), { embed: false });
  },

  /**
   * HTML that shows the current view inside another web page, in the compact layout.
   * Width and height are in CSS pixels. The frame starts playing if the view is playing now.
   */
  embedCode(width?: number, height?: number): string {
    return embedSnippet(get(), window.location.origin + window.location.pathname, width, height);
  },

  /**
   * Study a target: search for its images, then download them. The map moves there too,
   * unless `fly` is false, which is for a place chosen on the map itself.
   */
  goTo(target: Target, options: { fly?: boolean } = {}): void {
    // Keep a wide map view wide enough to show context, but come in close from an all-sky view.
    // A solar system body's position is known only after its images are found.
    if (!target.moving && options.fly !== false) actions.flyTo(target, Math.min(get().map.fov, 2));
    void load(target, get().fieldSize);
  },

  /**
   * Study whatever a person typed: coordinates in any common form, or an object name.
   * Resolves to true when a target was found. On failure, state.error holds the reason.
   */
  async search(text: string): Promise<boolean> {
    const query = text.trim();
    if (!query) return false;
    recent ??= loadRecent();
    const position = parseCoordinates(query);
    if (position) {
      recent = rememberSearch(recent, { label: query, query });
      actions.goTo({ ...position, epoch: 2026.0 });
      return true;
    }
    set({ targetState: "loading", error: null, notice: null });
    try {
      const found = await resolveName(query);
      if ("moving" in found && found.moving === true) {
        // A planet, asteroid, or comet. Its position is filled in from the images that caught it.
        actions.goTo({ name: found.name, kind: found.kind, ra: 0, dec: 0, epoch: 2026.0, source: "JPL Horizons", url: found.url, moving: { command: found.command } });
      } else {
        actions.goTo(found as Target);
      }
      recent = rememberSearch(recent, { label: found.name ?? query, query });
      return true;
    } catch (error) {
      set({ targetState: "failed", error: error instanceof ApiError ? error.message : "The name lookup failed. Try coordinates instead." });
      return false;
    }
  },

  /**
   * Fill state.suggestions for what a person has typed in the search box. Matches from the
   * built-in list, recent searches, and typed coordinates appear at once. Asteroids, comets,
   * and a check of the typed name follow from the server after a short pause in typing.
   * Call it with an empty string to get recent searches and NASA's test targets.
   */
  suggest(text: string): void {
    recent ??= loadRecent();
    const local = localSuggestions(text, recent);
    const typed = text.trim();
    const key = typed.toLowerCase();
    if (suggestTimer) clearTimeout(suggestTimer);
    suggestAbort?.abort();
    suggestTimer = null;
    const known = suggestCache.get(key);
    set({ suggestions: known ? mergeSuggestions(local, known) : local });
    // Coordinates need no lookup, and the server wants at least three characters.
    if (known || typed.length < 3 || parseCoordinates(typed)) return;
    suggestTimer = setTimeout(() => {
      suggestAbort = new AbortController();
      getSuggestions(typed, suggestAbort.signal).then(
        (remote) => {
          suggestCache.set(key, remote);
          if (suggestCache.size > 200) suggestCache.delete(suggestCache.keys().next().value!);
          set({ suggestions: mergeSuggestions(local, remote) });
        },
        () => {}, // a failed or canceled lookup leaves the local rows in place
      );
    }, SUGGEST_PAUSE);
  },

  /**
   * Change the field width in arcseconds. By default the current target reloads at the new size.
   * Pass reload = false while the user is still dragging, or when sizing an area not yet studied.
   */
  setFieldSize(arcsec: number, reload = true): void {
    const fieldSize = Math.min(3600, Math.max(60, Math.round(arcsec)));
    if (fieldSize === get().fieldSize && !reload) return;
    set({ fieldSize });
    const target = get().target;
    if (target && reload) void load(target, fieldSize);
  },

  /** Load the current target again. */
  reload(): void {
    const target = get().target;
    if (target) void load(target, get().fieldSize);
  },

  setMode(mode: SequenceMode): void {
    set({ mode, ...resequence(undefined, mode), player: { ...get().player, index: 0 } });
  },

  setFilters(change: Partial<Filters>): void {
    const filters = { ...get().filters, ...change };
    set({ filters, ...resequence(undefined, undefined, filters) });
  },

  /** Switch one detector (1 to 6) on or off. */
  toggleDetector(detector: number): void {
    const detectors = get().filters.detectors.slice();
    detectors[detector - 1] = !detectors[detector - 1];
    actions.setFilters({ detectors });
  },

  play(): void {
    if (get().player.playing) return;
    set({ player: { ...get().player, playing: true } });
    ticker = setTimeout(tick, 1000 / get().player.fps);
  },

  pause,

  togglePlay(): void {
    if (get().player.playing) pause();
    else actions.play();
  },

  /** Jump to a step of the sequence. */
  seek(index: number): void {
    const count = get().sequence.length;
    if (!count) return;
    set({ player: { ...get().player, index: ((Math.round(index) % count) + count) % count } });
  },

  /** Move forward or back by a number of steps. Pauses playback. */
  step(by: number): void {
    pause();
    actions.seek(get().player.index + by);
  },

  /** Playback speed in steps per second. */
  setSpeed(fps: number): void {
    set({ player: { ...get().player, fps: Math.min(30, Math.max(0.5, fps)) } });
  },

  setDisplay(change: Partial<DisplaySettings>): void {
    set({ display: { ...get().display, ...change } });
    // Color needs summed images. A single exposure holds only one wavelength.
    if (change.color && get().mode === "exposures") actions.setMode("visits");
  },

  /** Pick black and white points from the pixels of the current step. */
  autoStretch(): void {
    const { sequence, player, frames, display } = get();
    const item = sequence[player.index];
    if (!item) return;
    const frame = frames[item.frameIds[0]];
    const image = imageOf(frame.id);
    if (!image || !frame.rms) return;
    const values = Array.from(image.filter(Number.isFinite)).sort((a, b) => a - b);
    if (!values.length) return;
    const at = (q: number) => values[Math.min(values.length - 1, Math.floor(q * values.length))];
    const scale = display.normalize ? 1 / frame.rms : 1;
    const bg = frame.bg ?? 0;
    set({ display: { ...display, lo: (at(0.02) - bg) * scale, hi: (at(0.998) - bg) * scale } });
  },

  setView(change: Partial<View>): void {
    const view = { ...get().view, ...change };
    view.zoom = Math.min(40, Math.max(0.5, view.zoom));
    set({ view });
  },

  resetView(): void {
    set({ view: { east: 0, north: 0, zoom: 1 } });
  },

  setFollow(follow: boolean): void {
    set({ follow });
  },

  /**
   * Choose what to subtract from each image. Subtraction shows what moved or changed brightness.
   * Turning it on holds the sky still (follow off) and centers the brightness scale on zero,
   * so unchanged sky is mid-gray, brighter is white, and fainter is black. Turning it off puts both back.
   */
  setSubtract(subtract: Subtract): void {
    const state = get();
    if (subtract !== "none" && state.subtract === "none") {
      beforeSubtract = { follow: state.follow, lo: state.display.lo, hi: state.display.hi, color: state.display.color, stretch: state.display.stretch };
      // A straight-line scale keeps zero exactly in the middle of the gray range.
      set({ subtract, follow: false, display: { ...state.display, lo: -12, hi: 12, color: false, stretch: "linear" } });
    } else if (subtract === "none" && state.subtract !== "none" && beforeSubtract) {
      set({ subtract, follow: beforeSubtract.follow, display: { ...state.display, lo: beforeSubtract.lo, hi: beforeSubtract.hi, color: beforeSubtract.color, stretch: beforeSubtract.stretch } });
      beforeSubtract = null;
    } else {
      set({ subtract });
    }
  },

  setSpectrum(change: Partial<SpectrumSettings>): void {
    const spectrum = { ...get().spectrum, ...change };
    spectrum.redshift = Math.min(12, Math.max(0, spectrum.redshift));
    if (spectrum.aperture !== null) spectrum.aperture = Math.min(120, Math.max(4, spectrum.aperture));
    set({ spectrum });
  },

  /**
   * Take the spectrum of another spot in the field instead of the target. Pass a sky position,
   * or null to return to the target. The spot is measured with a circle on the loaded frames,
   * so the spectrum changes at once.
   */
  probe(position: SkyPosition | null): void {
    const target = get().target;
    const probe = position && target && !target.moving ? skyOffset(position, target) : null;
    set({ spectrum: { ...get().spectrum, probe } });
  },

  /**
   * Search the whole loaded field for sources that moved or changed brightness between visits.
   * The result lands in state.changes. state.finding holds the progress while the search runs.
   */
  async findChanges(): Promise<void> {
    if (get().finding !== null) return;
    const session = get().session;
    set({ finding: 0, changes: null });
    try {
      const report = await findChanges(get(), (fraction) => {
        if (get().session === session) set({ finding: fraction });
      });
      if (get().session === session) set({ changes: report, finding: null });
    } catch {
      if (get().session === session) set({ finding: null, error: "The search for changes did not finish. Try again." });
    }
  },

  /** Center the image on a found change and pick that spot, so the UI can offer its spectrum or a closer study. */
  showChange(change: FoundChange): void {
    set({ view: { east: change.east, north: change.north, zoom: Math.max(get().view.zoom, 2.5) } });
    actions.pick({ ra: change.ra, dec: change.dec });
  },

  /** Switch a family of spectral features on or off in the spectrum plot. */
  toggleFamily(id: string): void {
    const families = get().spectrum.families;
    actions.setSpectrum({ families: families.includes(id) ? families.filter((f) => f !== id) : [...families, id] });
  },

  /** Switch on the plot marks for every family the feature finder found in the spectrum on screen, and only those. */
  markFound(): void {
    const found = spectrumFeatures(get()).findings.map((finding) => finding.familyId);
    actions.setSpectrum({ families: [...new Set(found)] });
  },

  /** Show one exposure in the frame view, whatever the current playback mode. */
  showFrame(frameId: number): void {
    pause();
    const mode = "exposures";
    const next = get().mode === mode ? { sequence: get().sequence } : resequence(undefined, mode);
    const index = next.sequence.findIndex((item) => item.frameIds[0] === frameId);
    if (index < 0) return;
    set({ mode, sequence: next.sequence, player: { ...get().player, index, playing: false } });
  },

  /** Change map settings: projection, layer, channel, grid, labels, the coverage overlays, the tile grid, the solar system, or the measure tool. */
  setMap(change: Partial<Pick<MapState, "projection" | "layer" | "channel" | "grid" | "labels" | "coverage" | "deepFields" | "tiles" | "solar" | "measuring">>): void {
    const before = get().map;
    const map = { ...before, ...change };
    map.channel = Math.min(101, Math.max(0, Math.round(map.channel)));
    if (BLANK_CHANNELS.includes(map.channel)) map.channel = map.channel >= before.channel ? 52 : 49;
    // Putting the measure tool away takes its line off the map.
    if (!map.measuring) map.measured = null;
    set({ map });
  },

  /**
   * Blink the image on screen against an older survey's picture of the same field: switch it
   * on or off, or choose the survey. While it is on, state.blink.older flips at a steady beat.
   * The film is paused, because two things changing at once can't be read.
   */
  setBlink(change: { on?: boolean; choice?: BlinkChoice }): void {
    const target = get().target;
    const blink = { ...get().blink, ...change };
    // Blinking compares one fixed patch of sky, so it needs a target that stays put.
    if (!target || target.moving) blink.on = false;
    stopBlink();
    if (blink.on) {
      pause();
      // Start on the older picture, so pressing the button shows a change at once.
      blink.older = change.on === true ? true : blink.older;
      blinker = setInterval(() => set({ blink: { ...get().blink, older: !get().blink.older } }), BLINK_MS);
    } else {
      blink.older = false;
    }
    set({ blink });
  },

  /** Used by the map to report the sky position under the pointer. */
  setMapHover(position: SkyPosition | null): void {
    if (position !== get().mapHover) set({ mapHover: position });
  },

  /** Move the map to a position. fov is the width of the view in degrees. */
  flyTo(position: SkyPosition, fov?: number): void {
    set({ mapGoal: { ra: position.ra, dec: position.dec, fov: fov ?? null, token: get().mapGoal.token + 1 } });
  },

  /**
   * Choose a known object, or pass null to clear the choice.
   * `from` says where it was chosen, so each side of the UI shows a card only for its own clicks.
   */
  selectObject(object: SkyObject | null, from: "map" | "images" = "map"): void {
    const map = get().map;
    set({ map: { ...map, selected: object, selectedIn: object ? from : map.selectedIn, picked: null } });
  },

  /**
   * Choose a place by a click on the map or in an image, or pass null to clear the choice.
   * `from` says where the click was, so the UI can offer the tools that fit.
   */
  pick(position: SkyPosition | null, from: "map" | "images" = "map"): void {
    const { map, known } = get();
    // An answer about one spot belongs to that spot. An answer about the whole field stays.
    const spot = known !== null && !known.field;
    if (spot) knownAbort?.abort();
    set({ map: { ...map, picked: position, pickedIn: position ? from : map.pickedIn, selected: null }, known: spot ? null : known });
  },

  /**
   * Close the study: stop any loading, let go of the target and its images, and take the
   * selected area off the map. A search or a click on the map starts a new one.
   */
  closeStudy(): void {
    abort?.abort();
    abort = null;
    knownAbort?.abort();
    generation++; // answers still on their way for the old study are dropped
    pause();
    clearPixels();
    set({
      ...emptyStudy(),
      session: generation,
      target: null,
      targetState: "idle",
      map: { ...get().map, picked: null, fieldShown: false },
    });
  },

  /**
   * Ask which known asteroids, comets, and planets were in view when the image on screen was
   * taken: across the whole field of that image ("field"), or around the picked spot ("spot").
   * The answer lands in state.known. It takes several seconds, because the service works out
   * where every known body was at that moment.
   */
  async identify(where: "field" | "spot" = "field"): Promise<void> {
    const state = get();
    const item = state.sequence[state.player.index];
    if (!item) return;
    const whole = where === "field";
    // A field is searched from the middle of the image on screen out to its corners.
    const position = whole ? state.frames[item.frameIds[0]]?.center ?? state.target : state.map.picked;
    if (!position) return;
    const half = state.fieldSize / 2;
    const radius = whole ? Math.min(KNOWN_REACH, Math.max(KNOWN_RADIUS, half * Math.SQRT2)) : KNOWN_RADIUS;
    knownAbort?.abort();
    knownAbort = new AbortController();
    const check: KnownCheck = { position: { ra: position.ra, dec: position.dec }, mjd: item.mjd, summed: item.frameIds.length > 1, radius, field: whole, status: "loading", bodies: [] };
    set({ known: check });
    try {
      let bodies = await getKnown(position.ra, position.dec, item.mjd, radius, knownAbort.signal);
      // The search is a circle around the corners. Keep what lies inside the square image.
      if (whole) {
        bodies = bodies.filter((body) => {
          const [east, north] = skyOffset(body, position);
          return Math.abs(east) <= half && Math.abs(north) <= half;
        });
      }
      if (get().known === check) set({ known: { ...check, status: "ready", bodies } });
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      if (get().known === check) set({ known: { ...check, status: "failed", error: error instanceof ApiError ? error.message : "The lookup did not finish." } });
    }
  },

  /** Study a known object in SPHEREx images, following its motion. */
  studyObject(object: SkyObject): void {
    actions.goTo({
      name: object.name,
      ra: object.ra,
      dec: object.dec,
      epoch: object.epoch,
      pmRa: object.pmRa ?? undefined,
      pmDec: object.pmDec ?? undefined,
      parallax: object.parallax ?? undefined,
      kind: object.kind ?? undefined,
      source: "SIMBAD",
      distance: object.distance,
      url: object.url,
    });
  },

  /** Used by the map to report its state. */
  mapReport(change: Partial<MapState>): void {
    set({ map: { ...get().map, ...change } });
  },

  /** Save the picture on screen as a PNG file. */
  async saveImage(): Promise<void> {
    await exportImage(get());
  },

  /** Save the whole sequence as an animated GIF. Progress shows in state.exporting. */
  async saveAnimation(): Promise<void> {
    if (get().exporting !== null) return;
    pause();
    set({ exporting: 0 });
    try {
      await exportAnimation(get(), (done) => set({ exporting: done }));
    } finally {
      set({ exporting: null });
    }
  },

  /** Save the spectrum as a CSV table, one row per image. */
  saveSpectrum(): void {
    exportSpectrum(get());
  },

  /**
   * Save the image on screen as a FITS file. A single exposure is the archive's own pixels,
   * with flags and variance. A sum is saved on its north-up grid.
   */
  saveFits(): void {
    exportFits(get());
  },

  /** Save every loaded exposure as FITS cutouts in one zip file. state.packing is true while it is made. */
  async saveAllFits(): Promise<void> {
    if (get().packing) return;
    set({ packing: true });
    try {
      await exportAllFits(get());
    } catch (error) {
      set({ notice: error instanceof ApiError ? error.message : "The files could not be made. Try again in a minute." });
    } finally {
      set({ packing: false });
    }
  },

  /** Save the brightness over time as a CSV table. */
  saveLightCurve(): void {
    exportLightCurve(get());
  },

  /** Save what the change finder found as a CSV table. */
  saveChanges(): void {
    exportChanges(get());
  },

  /**
   * Measure how the source at the target moves from visit to visit, using the detectors that are
   * switched on. The result lands in state.motion. Returns false when there are not two visits
   * in which the source can be found.
   */
  measureMotion(): boolean {
    const motion = measureMotion(get());
    set({ motion });
    return motion !== null;
  },

  /** Fetch the spacecraft's orbital elements and the archive status. Safe to call more than once. */
  loadSpacecraft(): void {
    if (spacecraftRequested) return;
    spacecraftRequested = true;
    getSpacecraft().then(
      (spacecraft) => set({ spacecraft }),
      () => {
        spacecraftRequested = false; // allow a retry
      },
    );
  },

  /** Used by the orbit view to publish the live position. */
  spacecraftNow(now: SpacecraftNow): void {
    set({ spacecraftNow: now });
  },

  /** Used by the orbit view to publish the live position of every telescope in Earth orbit. */
  craftNow(now: Record<string, SpacecraftNow>): void {
    set({ craftNow: now, spacecraftNow: now.spherex ?? get().spacecraftNow });
  },

  /** Used by the frame view to publish what is under the pointer. */
  setHover(hover: Hover | null): void {
    set({ hover });
  },
};
