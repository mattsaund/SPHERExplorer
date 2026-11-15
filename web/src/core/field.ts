// Where the field being studied is on the sky. A star or a patch of sky stays put. A planet,
// asteroid, or comet has a new place in every image, so its field moves with the film.
// Written with Claude Code (Anthropic) assistance.
import type { AppState } from "./store";
import type { SkyPosition } from "./types";

type Study = Pick<AppState, "target" | "frames" | "sequence" | "player">;

/**
 * The center of the field being studied: the target's own place, or for a moving body the
 * place of the image on screen. Null when there is no study, and while a moving body's
 * images are still being found.
 */
export function fieldCenter(state: Study): SkyPosition | null {
  const target = state.target;
  if (!target) return null;
  if (!target.moving) return target;
  const step = state.sequence[state.player.index];
  return state.frames[step ? step.frameIds[0] : 0]?.center ?? null;
}

/**
 * Where the sky map goes by itself when a study opens: to the target, or for a moving body
 * to where it was in its first image, which is the image that comes on screen first.
 */
export function mapHome(state: Study): SkyPosition | null {
  const target = state.target;
  if (!target) return null;
  return target.moving ? state.frames[0]?.center ?? null : target;
}

/** The date of the image on screen, as a Modified Julian Date. Null before any image is found. */
export function fieldDate(state: Study): number | null {
  const step = state.sequence[state.player.index];
  return step?.mjd ?? state.frames[0]?.mjd ?? null;
}
