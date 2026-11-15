// Turns a step of the sequence into something the renderer can draw:
// a single frame as it is, or a sum of frames built on demand and cached.
// A sum that takes a while is made in the background, in small pieces, when the picture on
// screen can wait for it. The page then keeps answering, and the picture changes when the
// sum is there.
// Written with Claude Code (Anthropic) assistance.
import { skyOffset } from "../sky/astro";
import { getPixels, imageOf } from "./pixels";
import type { Layer } from "./renderer";
import { stackFrames, startStack, type Stack, type StackJob, type StackMember, type StackOptions } from "./stack";
import type { AppState } from "../state/store";
import type { Frame, SequenceItem } from "../types";

/** What to draw for one step, plus where the target should be. */
export interface Scene {
  layer: Layer;
  /** Expected target position as a sky offset [east, north] from the field center, arcseconds. */
  marker: [number, number];
  /** The summed image, when the step is a sum. */
  stack?: Stack;
  /** Green and blue layers when the scene is in full color. `layer` is then the red one. */
  color?: [Layer, Layer];
  /** A reference image to subtract from `layer`, when the user asked to see only changes. */
  minus?: Layer;
}

/** Exposures within this many channels of each other count as the same wavelength. */
const MATCH_CHANNELS = 1;

/**
 * Extra weight for red, green, and blue in full color. Each range is first scaled by its own
 * noise, which leaves ordinary stars very blue because SPHEREx is most sensitive at short
 * wavelengths. These factors pull stars toward white without letting red noise take over.
 */
const COLOR_BALANCE = [1.7, 1.25, 1.0];

const stacks = new Map<string, Stack>();
const MAX_STACKS = 160;

/**
 * The newest finished sum of each step, whatever frames it was made from. It stands in on
 * screen while a newer sum of the same step is made, so the picture grows as images arrive.
 */
const standIns = new Map<string, Stack>();
const MAX_STAND_INS = 400;
/** The cache key each sum was made under. The renderer knows a picture by it. */
const madeAs = new WeakMap<Stack, string>();

/** Keep a finished sum for reuse, and drop the oldest ones past the limit. */
function remember(key: string, slot: string, stack: Stack): void {
  madeAs.set(stack, key);
  stacks.set(key, stack);
  while (stacks.size > MAX_STACKS) stacks.delete(stacks.keys().next().value!);
  standIns.delete(slot);
  standIns.set(slot, stack);
  while (standIns.size > MAX_STAND_INS) standIns.delete(standIns.keys().next().value!);
}

// ---- Sums made in the background ----------------------------------------------------------------

/**
 * A sum of more samples than this (frames times output pixels) is made in the background
 * when the picture can wait for it. That is about a tenth of a second of work.
 */
const BACKGROUND_SAMPLES = 5e6;
/** How long background work runs before the page gets a turn, in milliseconds. */
const SLICE_MS = 10;

/** Everything needed to make one sum, and where to keep it. */
interface Recipe {
  cacheKey: string;
  /** The step this sum belongs to, whatever frames have arrived for it. */
  slot: string;
  session: number;
  members: StackMember[];
  options: StackOptions;
  /** Where the target is expected in the sum, as a sky offset [east, north] in arcseconds. */
  marker: [number, number];
}

/** The sums the picture on screen is waiting for, by cache key. */
const wanted = new Map<string, Recipe>();
let working = false;
/** The study the picture on screen belongs to. Background work for an older one is dropped. */
let sessionOnScreen = -1;
let reported: number | null = null;
let report: (frames: number | null) => void = () => {};
const readyListeners = new Set<() => void>();

/** Tell `listener` how many images are being added up in the background, or null when none are. */
export function watchSums(listener: (frames: number | null) => void): void {
  report = listener;
}

/**
 * Call `listener` each time a background sum is finished, so the picture can be drawn again.
 * Returns a function that stops the calls.
 */
export function onSumReady(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

/** True while the picture on screen is waiting for a sum. */
export function sumsWaiting(): boolean {
  return wanted.size > 0;
}

/** Report how many images are being added up, when that number has changed. */
function tell(): void {
  let frames = 0;
  for (const recipe of wanted.values()) frames += recipe.members.length;
  const now = wanted.size ? frames : null;
  if (now === reported) return;
  reported = now;
  report(now);
}

/**
 * Give the page a turn, then come back: it can draw, answer the pointer, run its timers, and
 * take in images that have arrived.
 * A message to ourselves waits in line behind all of those. A timer would also work but waits
 * at least four milliseconds each time. The browser's own scheduler.yield() is not used: it
 * puts this work ahead of timers and arriving data, which then wait for the whole sum
 * (measured: a 20 ms timer fired 1.2 s late).
 */
function breathe(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

/**
 * Work a sum to the end, a slice at a time. `keepGoing` is asked after each pause, and the
 * work stops with null when it says no.
 */
async function inSlices(job: StackJob, keepGoing: () => boolean = () => true): Promise<Stack | null> {
  let since = performance.now();
  for (let index = 0; index < job.tiles; index++) {
    job.work(index);
    if (performance.now() - since < SLICE_MS) continue;
    await breathe();
    if (!keepGoing()) return null;
    since = performance.now();
  }
  return job.finish();
}

/**
 * Make the wanted sums one after another. A sum that was started is finished even if the
 * picture has moved on, because it then stands in for the newer sum of the same step. Only a
 * new study stops it, since its frames are gone.
 */
async function makeWanted(): Promise<void> {
  if (working) return;
  working = true;
  try {
    for (;;) {
      const next = wanted.values().next();
      if (next.done) break;
      const recipe = next.value;
      const stack = await inSlices(startStack(recipe.members, recipe.options), () => recipe.session === sessionOnScreen);
      wanted.delete(recipe.cacheKey);
      if (!stack) continue;
      remember(recipe.cacheKey, recipe.slot, stack);
      tell();
      for (const listener of readyListeners) listener();
    }
  } finally {
    working = false;
    tell();
  }
}

/**
 * The summed image of a step that is a sum, in one color and with nothing subtracted,
 * whatever the display settings are. Null for a step that is a single exposure.
 */
export function plainSum(item: SequenceItem, state: AppState): Stack | null {
  return item.frameIds.length > 1 ? sumOf(item, state, null)?.stack ?? null : null;
}

/** Offset of the target's position in a frame from the field center. */
export function trackOffset(frame: Frame, state: AppState): [number, number] {
  // Each frame of a solar system body is cut out around the body itself, so the offset is zero.
  if (!state.target || state.target.moving) return [0, 0];
  return skyOffset(frame.track, state.target);
}

/**
 * The scene for the current step, with a reference to subtract when that is switched on.
 * With `soon`, a sum that would hold the page up is made in the background instead. Until it
 * is there this returns an older sum of the same step, or null when there is none, and
 * sumsWaiting() says that more is coming. Only the picture on screen asks this way.
 */
export function sceneFor(item: SequenceItem, state: AppState, soon = false): Scene | null {
  if (soon) {
    // The picture on screen decides what is wanted. Sums asked for by an earlier picture are let go.
    wanted.clear();
    sessionOnScreen = state.session;
  }
  const scene = sceneNow(item, state, soon);
  if (soon) {
    tell();
    if (wanted.size) void makeWanted();
  }
  return scene;
}

/** The scene for a step: the plain one, less its reference when only changes are shown. */
function sceneNow(item: SequenceItem, state: AppState, soon: boolean): Scene | null {
  const scene = plainScene(item, state, soon);
  if (!scene || state.subtract === "none" || state.display.color) return scene;
  const reference = referenceFor(item, state, soon);
  if (!reference) return scene;
  // Put both images on one brightness scale: the noise of their difference.
  const noiseA = scene.stack?.rms ?? state.frames[item.frameIds[0]].rms ?? 1;
  const noiseB = reference.stack?.rms ?? 1;
  const gain = state.display.normalize ? 1 / Math.hypot(noiseA, noiseB) : 1;
  return { ...scene, layer: { ...scene.layer, gain }, minus: { ...reference.layer, gain } };
}

/** The image to subtract for a step, or null when there is none (for example the first step minus itself). */
function referenceFor(item: SequenceItem, state: AppState, soon: boolean): Scene | null {
  const { sequence, subtract, frames } = state;
  const index = sequence.indexOf(item);
  let members: number[] = [];
  let label = "";
  if (subtract === "first" && index > 0) {
    members = sequence[0].frameIds;
    label = sequence[0].key;
  } else if (subtract === "previous" && index > 0) {
    members = sequence[index - 1].frameIds;
    label = sequence[index - 1].key;
  } else if (subtract === "others") {
    const own = new Set(item.frameIds);
    if (item.frameIds.length === 1) {
      // A single exposure: compare with other exposures at a matching wavelength only.
      const frame = frames[item.frameIds[0]];
      members = frames
        .filter((f) => f.status === "ready" && !own.has(f.id) && Math.abs(f.channel - frame.channel) <= MATCH_CHANNELS)
        .map((f) => f.id);
    } else {
      members = sequence.flatMap((other) => (other === item ? [] : other.frameIds));
    }
    label = `others-of-${item.key}`;
  }
  if (!members.length) return null;
  // The reference never follows the target. It is the fixed sky that the changes stand out against.
  // Its key ends like a step's key, with how many frames and which, so it is rebuilt as frames arrive.
  const key = `ref:${label}:${members.length}:${members[0]}-${members[members.length - 1]}`;
  return sumOf({ key, label: "", frameIds: members, mjd: item.mjd, wavelength: item.wavelength }, { ...state, follow: false }, null, soon);
}

/** What to draw for a step before any subtraction: one exposure as it is, or a sum in one color or three. */
function plainScene(item: SequenceItem, state: AppState, soon: boolean): Scene | null {
  const { frames, display, session } = state;

  if (item.frameIds.length === 1) {
    const frame = frames[item.frameIds[0]];
    const pixels = getPixels(frame.id);
    if (!pixels || !frame.m || frame.cx === undefined || frame.cy === undefined) return null;
    const rms = frame.rms || 1;
    return {
      layer: {
        id: `f${session}:${frame.id}`,
        nx: pixels.nx,
        ny: pixels.ny,
        cx: frame.cx,
        cy: frame.cy,
        m: frame.m,
        data: pixels.half,
        flags: pixels.flags,
        bg: frame.bg ?? 0,
        gain: display.normalize ? 1 / rms : 1,
      },
      marker: trackOffset(frame, state),
    };
  }

  // A sum of frames, in one color or three.
  if (display.color) {
    const parts = [display.bands.red, display.bands.green, display.bands.blue].map((range) => sumOf(item, state, range, soon));
    const first = parts.find((part) => part !== null);
    if (!first) return null;
    // A range with no frames falls back to an empty copy of another, so the picture still draws.
    const [red, green, blue] = parts.map((part, i) => {
      const scene = part ?? { ...first, layer: { ...first.layer, gain: 0 } };
      return { ...scene.layer, gain: scene.layer.gain * COLOR_BALANCE[i] };
    });
    return { layer: red, color: [green, blue], marker: first.marker, stack: first.stack };
  }
  return sumOf(item, state, null, soon);
}

/** The part of a step's key that stays the same as more of its frames arrive: "v3" of "v3:120:0-340". */
function slotOf(key: string): string {
  return key.replace(/:\d+:\d+-\d+/g, "");
}

/** What it takes to sum the frames of a step, optionally only those inside a wavelength range. */
function recipeFor(item: SequenceItem, state: AppState, range: [number, number] | null): Recipe | null {
  const { frames, session } = state;
  // Output pixels are half the detector pixel so dithered frames add detail.
  const scale = (state.meta?.pixelScale ?? 6.15) / 2;
  const rest = `${state.follow ? 1 : 0}|${state.fieldSize}|${range ? range.join("-") : "all"}`;
  let markerEast = 0;
  let markerNorth = 0;
  const members: StackMember[] = [];
  for (const id of item.frameIds) {
    const frame = frames[id];
    if (range && !(frame.wavelength >= range[0] && frame.wavelength < range[1])) continue;
    const image = imageOf(id);
    const pixels = getPixels(id);
    if (!image || !pixels || !frame.m || frame.cx === undefined || frame.cy === undefined || !frame.rms) continue;
    const offset = trackOffset(frame, state);
    markerEast += offset[0];
    markerNorth += offset[1];
    members.push({
      nx: pixels.nx,
      ny: pixels.ny,
      cx: frame.cx,
      cy: frame.cy,
      m: frame.m,
      bg: frame.bg ?? 0,
      rms: frame.rms,
      image,
      flags: pixels.flags,
      // Following the target means sampling each frame where the target was at that time.
      shift: state.follow ? offset : [0, 0],
    });
  }
  if (!members.length) return null;
  return {
    cacheKey: `${session}|${item.key}|${rest}`,
    slot: `${session}|${slotOf(item.key)}|${rest}`,
    session,
    members,
    options: { size: state.fieldSize, scale, method: "clipped", badMask: state.meta?.stackMask ?? 0 },
    marker: state.follow ? [0, 0] : [markerEast / members.length, markerNorth / members.length],
  };
}

/** A finished sum as something the renderer can draw. */
function sumScene(recipe: Recipe, stack: Stack, state: AppState): Scene {
  const { display } = state;
  return {
    layer: {
      id: `s${recipe.cacheKey}`,
      nx: stack.nx,
      ny: stack.ny,
      cx: stack.cx,
      cy: stack.cy,
      m: stack.m,
      data: stack.image,
      flags: null,
      bg: 0,
      // In color, each range is scaled by its own noise so the background stays neutral gray.
      gain: display.normalize || display.color ? 1 / (stack.rms || 1) : 1,
    },
    marker: recipe.marker,
    stack,
  };
}

/**
 * Sum the frames of a step, optionally only those inside a wavelength range.
 * With `soon`, a large sum that is not made yet is left to the background. The newest older
 * sum of the same step is returned in its place, or null when there is none.
 */
function sumOf(item: SequenceItem, state: AppState, range: [number, number] | null, soon = false): Scene | null {
  const recipe = recipeFor(item, state, range);
  if (!recipe) return null;
  let stack = stacks.get(recipe.cacheKey);
  if (!stack) {
    const side = Math.round(recipe.options.size / recipe.options.scale);
    if (soon && recipe.members.length * side * side > BACKGROUND_SAMPLES) {
      wanted.set(recipe.cacheKey, recipe);
      const standIn = standIns.get(recipe.slot);
      // The stand-in is drawn under the name it was made with, so the renderer never mixes it up with the new sum.
      return standIn ? sumScene({ ...recipe, cacheKey: madeAs.get(standIn) ?? `${recipe.cacheKey}|standing-in` }, standIn, state) : null;
    }
    stack = stackFrames(recipe.members, recipe.options);
    remember(recipe.cacheKey, recipe.slot, stack);
  }
  return sumScene(recipe, stack, state);
}

/**
 * A sum of frames with the sky held still, for measuring where a source sits.
 * Returns the summed image and where the target was expected, as a sky offset in arcseconds.
 */
export function fixedSum(frameIds: number[], label: string, state: AppState): { stack: Stack; expected: [number, number] } | null {
  const frames = frameIds.map((id) => state.frames[id]);
  if (!frames.length) return null;
  const item: SequenceItem = { key: `fixed:${label}:${frameIds.length}:${frameIds[0]}-${frameIds[frameIds.length - 1]}`, label: "", frameIds, mjd: 0, wavelength: 0 };
  const scene = sumOf(item, { ...state, follow: false, display: { ...state.display, color: false } }, null);
  return scene?.stack ? { stack: scene.stack, expected: scene.marker } : null;
}

/**
 * The same sum as fixedSum, made a slice at a time, so that a long piece of work that needs
 * several sums can let the page answer in between.
 */
export async function fixedSumInSlices(frameIds: number[], label: string, state: AppState): Promise<{ stack: Stack; expected: [number, number] } | null> {
  if (!frameIds.length) return null;
  const item: SequenceItem = { key: `fixed:${label}:${frameIds.length}:${frameIds[0]}-${frameIds[frameIds.length - 1]}`, label: "", frameIds, mjd: 0, wavelength: 0 };
  const recipe = recipeFor(item, { ...state, follow: false }, null);
  if (!recipe) return null;
  let stack = stacks.get(recipe.cacheKey) ?? null;
  if (!stack) {
    stack = await inSlices(startStack(recipe.members, recipe.options));
    if (!stack) return null;
    remember(recipe.cacheKey, recipe.slot, stack);
  }
  return { stack, expected: recipe.marker };
}
