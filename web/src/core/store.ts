// Central app state. UI components read slices with useStore and change state through actions.
// Written with Claude Code (Anthropic) assistance.
import { create } from "zustand";
import { ApiError, getMeta, getMissions, getNeossat, getObjects, getSpacecraft, resolveName, searchFrames, searchMoving, streamCutouts, type WireFrame } from "./api";
import { assignSeasons, parseCoordinates, positionAt, skyOffset, summarizeVisits } from "./astro";
import { COLOR_PRESETS } from "./colorBands";
import { exportAnimation, exportImage, exportSpectrum } from "./export";
import { clearPixels, imageOf, setPixels } from "./pixels";
import { buildSequence } from "./sequence";
import { buildLink, parseLink } from "./url";
import type { DisplaySettings, Filters, Frame, Hover, LoadState, MapState, Meta, MissionData, PartnerData, Player, SequenceItem, SequenceMode, SkyObject, SkyPosition, SpacecraftInfo, SpacecraftNow, SpectrumSettings, Subtract, Target, Visit } from "./types";

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
  /** True when the page was opened with embed=1. The UI should use a compact layout. */
  embed: boolean;
  /** Progress of an animation being saved, from 0 to 1, or null when none is running. */
  exporting: number | null;
  /** Orbital elements and archive facts for the spacecraft view. Null until loaded. */
  spacecraft: SpacecraftInfo | null;
  /** Where the spacecraft is this second. Updated while the orbit view is on the page. */
  spacecraftNow: SpacecraftNow | null;
  map: MapState;
  /** A request to move the map. The map acts when `token` changes. */
  mapGoal: { ra: number; dec: number; fov: number | null; token: number };
}

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
  spectrum: { log: false, perVisit: true, showPoints: true, showSurveys: true, families: [], redshift: 0 },
  embed: false,
  exporting: null,
  spacecraft: null,
  spacecraftNow: null,
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
    picked: null,
  },
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

async function load(target: Target, fieldSize: number): Promise<void> {
  abort?.abort();
  abort = new AbortController();
  const signal = abort.signal;
  const mine = ++generation;
  pause();
  clearPixels();
  set({
    session: mine,
    target,
    targetState: "loading",
    framesState: "idle",
    frames: [],
    visits: [],
    fieldObjects: [],
    movers: [],
    missions: null,
    partner: null,
    sequence: [],
    loaded: 0,
    failed: 0,
    error: null,
    notice: null,
    hover: null,
    player: { ...get().player, index: 0, playing: false },
    view: { east: 0, north: 0, zoom: 1 },
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
      // Only a typed position needs the hint. A named target already carries its own motion.
      const typed = target.pmRa === undefined && target.pmDec === undefined;
      const movers = typed
        ? objects.filter((object) => Math.hypot(object.pmRa ?? 0, object.pmDec ?? 0) >= FAST_MOTION).sort((a, b) => Math.hypot(b.pmRa ?? 0, b.pmDec ?? 0) - Math.hypot(a.pmRa ?? 0, a.pmDec ?? 0))
        : [];
      set({ fieldObjects: inField, movers });
    },
    () => {},
  );

  // Other missions. The cone is widened by how far the target has moved since 2MASS looked in 1999.
  const drift = (Math.hypot(target.pmRa ?? 0, target.pmDec ?? 0) / 1000) * 28;
  if (!moving) getMissions(target.ra, target.dec, Math.min(1800, fieldSize * 0.75 + drift), signal).then(
    (missions) => {
      if (mine === generation) set({ missions });
    },
    () => {},
  );

  // Partner agency images of the same field.
  if (!moving) getNeossat(target.ra, target.dec, signal).then(
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

    const byKey = new Map(frames.map((frame) => [frame.key, frame.id]));
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
        frames: frames.map((frame) =>
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

function tick(): void {
  const { player, sequence } = get();
  if (!player.playing) return;
  if (sequence.length > 1) set({ player: { ...player, index: (player.index + 1) % sequence.length } });
  ticker = setTimeout(tick, 1000 / player.fps);
}

function pause(): void {
  if (ticker) clearTimeout(ticker);
  ticker = null;
  if (get().player.playing) set({ player: { ...get().player, playing: false } });
}

// ---- Actions -------------------------------------------------------------------------------

/** True once init has read the page address. */
let started = false;

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
    if (link.target) void actions.search(link.target);
    else if (link.ra !== undefined && link.dec !== undefined) actions.goTo({ ra: link.ra, dec: link.dec, epoch: 2026.0 });
    // Keep the address in step with the view, without adding browser history entries.
    let pending: ReturnType<typeof setTimeout> | null = null;
    useStore.subscribe((next, before) => {
      if (next.target === before.target && next.fieldSize === before.fieldSize && next.mode === before.mode && next.display === before.display && next.filters === before.filters && next.map.layer === before.map.layer && next.map.channel === before.map.channel && next.map.projection === before.map.projection) return;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        const address = window.location.pathname + buildLink(get()) + window.location.hash;
        window.history.replaceState(null, "", address);
      }, 300);
    });
  },

  /** A full link that reopens the current view. */
  shareLink(): string {
    return window.location.origin + window.location.pathname + buildLink(get());
  },

  /** Study a target: search for its images, then download them. The map moves there too. */
  goTo(target: Target): void {
    // Keep a wide map view wide enough to show context, but come in close from an all-sky view.
    // A solar system body's position is known only after its images are found.
    if (!target.moving) actions.flyTo(target, Math.min(get().map.fov, 2));
    void load(target, get().fieldSize);
  },

  /**
   * Study whatever a person typed: coordinates in any common form, or an object name.
   * Resolves to true when a target was found. On failure, state.error holds the reason.
   */
  async search(text: string): Promise<boolean> {
    const query = text.trim();
    if (!query) return false;
    const position = parseCoordinates(query);
    if (position) {
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
      return true;
    } catch (error) {
      set({ targetState: "failed", error: error instanceof ApiError ? error.message : "The name lookup failed. Try coordinates instead." });
      return false;
    }
  },

  /** Change the field width in arcseconds and reload. */
  setFieldSize(arcsec: number): void {
    const fieldSize = Math.min(3600, Math.max(60, Math.round(arcsec)));
    set({ fieldSize });
    const target = get().target;
    if (target) void load(target, fieldSize);
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
    set({ spectrum });
  },

  /** Switch a family of spectral features on or off in the spectrum plot. */
  toggleFamily(id: string): void {
    const families = get().spectrum.families;
    actions.setSpectrum({ families: families.includes(id) ? families.filter((f) => f !== id) : [...families, id] });
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

  /** Change map settings: projection, layer, channel, grid, or labels. */
  setMap(change: Partial<Pick<MapState, "projection" | "layer" | "channel" | "grid" | "labels">>): void {
    const before = get().map;
    const map = { ...before, ...change };
    map.channel = Math.min(101, Math.max(0, Math.round(map.channel)));
    if (BLANK_CHANNELS.includes(map.channel)) map.channel = map.channel >= before.channel ? 52 : 49;
    set({ map });
  },

  /** Move the map to a position. fov is the width of the view in degrees. */
  flyTo(position: SkyPosition, fov?: number): void {
    set({ mapGoal: { ra: position.ra, dec: position.dec, fov: fov ?? null, token: get().mapGoal.token + 1 } });
  },

  /** Choose a known object on the map, or pass null to clear the choice. */
  selectObject(object: SkyObject | null): void {
    set({ map: { ...get().map, selected: object, picked: null } });
  },

  /** Choose a spot of empty sky on the map, or pass null to clear it. */
  pick(position: SkyPosition | null): void {
    set({ map: { ...get().map, picked: position, selected: null } });
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

  /** Used by the frame view to publish what is under the pointer. */
  setHover(hover: Hover | null): void {
    set({ hover });
  },
};
