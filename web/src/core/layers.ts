// Turns a step of the sequence into something the renderer can draw:
// a single frame as it is, or a sum of frames built on demand and cached.
// Written with Claude Code (Anthropic) assistance.
import { skyOffset } from "./astro";
import { getPixels, imageOf } from "./pixels";
import type { Layer } from "./render/renderer";
import { stackFrames, type Stack, type StackMember } from "./stack";
import type { AppState } from "./store";
import type { Frame, SequenceItem } from "./types";

/** What to draw for one step, plus where the target should be. */
export interface Scene {
  layer: Layer;
  /** Expected target position as a sky offset [east, north] from the field center, arcseconds. */
  marker: [number, number];
  /** The summed image, when the step is a sum. */
  stack?: Stack;
  /** Green and blue layers when the scene is in full color. `layer` is then the red one. */
  color?: [Layer, Layer];
}

/**
 * Extra weight for red, green, and blue in full color. Each range is first scaled by its own
 * noise, which leaves ordinary stars very blue because SPHEREx is most sensitive at short
 * wavelengths. These factors pull stars toward white without letting red noise take over.
 */
const COLOR_BALANCE = [1.7, 1.25, 1.0];

const stacks = new Map<string, Stack>();
const MAX_STACKS = 160;

function remember(key: string, stack: Stack): void {
  stacks.set(key, stack);
  while (stacks.size > MAX_STACKS) stacks.delete(stacks.keys().next().value!);
}

/** Offset of the target's position in a frame from the field center. */
function trackOffset(frame: Frame, state: AppState): [number, number] {
  return state.target ? skyOffset(frame.track, state.target) : [0, 0];
}

export function sceneFor(item: SequenceItem, state: AppState): Scene | null {
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
    const parts = [display.bands.red, display.bands.green, display.bands.blue].map((range) => sumOf(item, state, range));
    const first = parts.find((part) => part !== null);
    if (!first) return null;
    // A range with no frames falls back to an empty copy of another, so the picture still draws.
    const [red, green, blue] = parts.map((part, i) => {
      const scene = part ?? { ...first, layer: { ...first.layer, gain: 0 } };
      return { ...scene.layer, gain: scene.layer.gain * COLOR_BALANCE[i] };
    });
    return { layer: red, color: [green, blue], marker: first.marker, stack: first.stack };
  }
  return sumOf(item, state, null);
}

/** Sum the frames of a step, optionally only those inside a wavelength range. */
function sumOf(item: SequenceItem, state: AppState, range: [number, number] | null): Scene | null {
  const { frames, display, session } = state;
  // Output pixels are half the detector pixel so dithered frames add detail.
  const scale = (state.meta?.pixelScale ?? 6.15) / 2;
  const cacheKey = `${session}|${item.key}|${state.follow ? 1 : 0}|${state.fieldSize}|${range ? range.join("-") : "all"}`;
  let stack = stacks.get(cacheKey);
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
  if (!stack) {
    stack = stackFrames(members, { size: state.fieldSize, scale, method: "clipped", badMask: state.meta?.stackMask ?? 0 });
    remember(cacheKey, stack);
  }
  return {
    layer: {
      id: `s${cacheKey}`,
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
    marker: state.follow ? [0, 0] : [markerEast / members.length, markerNorth / members.length],
    stack,
  };
}
