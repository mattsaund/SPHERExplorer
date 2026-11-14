// Central app state. UI components read slices with useStore and change state through actions.
// Written with Claude Code (Anthropic) assistance.
import { create } from "zustand";
import { ApiError, getMeta, resolveName, searchFrames, streamCutouts, type WireFrame } from "./api";
import { assignSeasons, parseCoordinates, positionAt } from "./astro";
import { clearPixels, imageOf, setPixels } from "./pixels";
import { buildSequence } from "./sequence";
import type { DisplaySettings, Filters, Frame, Hover, LoadState, Meta, Player, SequenceItem, SequenceMode, Target } from "./types";

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
  /** What is under the pointer in the frame view. */
  hover: Hover | null;
}

const DEFAULT_FILTERS: Filters = { detectors: [true, true, true, true, true, true], wlMin: 0.7, wlMax: 5.1 };
const DEFAULT_DISPLAY: DisplaySettings = {
  stretch: "asinh",
  lo: -3,
  hi: 60,
  colorMap: "gray",
  invert: false,
  smooth: false,
  normalize: true,
  showFlags: false,
  showMarker: true,
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
  hover: null,
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
  const sequence = buildSequence(frames, mode, filters);
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
      frames[id] = { ...frames[id], status: "failed", error: header.error ?? "No image data" };
      failed++;
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
    sequence: [],
    loaded: 0,
    failed: 0,
    error: null,
    notice: null,
    hover: null,
    player: { ...get().player, index: 0, playing: false },
    view: { east: 0, north: 0, zoom: 1 },
  });

  try {
    await ensureMeta();
    const result = await searchFrames(target.ra, target.dec, signal);
    if (mine !== generation) return;
    const collections = result.collections;
    const f = result.frames;
    const seasons = assignSeasons(f.mjd);
    const frames: Frame[] = f.key.map((key, i) => ({
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
      track: positionAt(target, f.mjd[i], [f.pfra[i], f.pfdec[i]]),
      status: "pending",
    }));
    set({
      frames,
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
        frames: frames.map((frame) => ({ key: frame.key, pra: frame.track.ra, pdec: frame.track.dec })),
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

/** Every state change goes through here so the UI never touches the engine internals. */
export const actions = {
  /** Load the instrument facts. Safe to call more than once. */
  init(): void {
    ensureMeta().catch(() => set({ error: "Can't reach the SPHERExplorer server. Check your connection and try again." }));
  },

  /** Study a target: search for its images, then download them. */
  goTo(target: Target): void {
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
      actions.goTo(await resolveName(query));
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

  /** Used by the frame view to publish what is under the pointer. */
  setHover(hover: Hover | null): void {
    set({ hover });
  },
};
