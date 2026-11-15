// Where the field being studied is on the sky, which is where the yellow square goes.
// A star or a patch of sky stays put. A planet, asteroid, or comet has a new place in every
// image, so its square moves with the film. A body the sky map marks starts with its square
// on its marker.
// Written with Claude Code (Anthropic) assistance.
import { solarPlace } from "./solar";
import type { AppState } from "./store";
import type { SkyObject, SkyPosition, Target } from "./types";

type Study = Pick<AppState, "target" | "frames" | "sequence" | "player" | "filmMoved">;

/**
 * Where a moving target is on the sky right now, when it is one of the bodies the sky map
 * marks: the planets, and the dwarf planets, asteroids, and comets on its list. Null for a
 * fixed target and for any other body, whose place today the page does not know.
 */
export function bodyNow(target: Target | null, now = Date.now()): SkyPosition | null {
  if (!target?.moving || !target.url) return null;
  return solarPlace(target.url, new Date(now));
}

/**
 * True when the square sits on a marked body's own marker, where the body is today, and not
 * at the place of an image. That is so until the film is played, stepped, or moved to an
 * image, which is how every study opens, and while the body's images are still being found.
 */
export function fieldIsNow(state: Study): boolean {
  return bodyNow(state.target) !== null && (!state.frames.length || !state.filmMoved);
}

/**
 * The center of the field being studied, which is where the yellow square goes.
 * A star or a patch of sky: the target's own place.
 * A body the sky map marks: its marker, where the body is today, until the film is played or
 * stepped. The marker is then inside the square and the map has no reason to move
 * (Matt's decisions, Nov 15). Once the film moves, the square is where the image on screen
 * was taken, so the body's path shows as the square crosses the map.
 * Any other moving body: the place of the image on screen, or null until its images are found.
 */
export function fieldCenter(state: Study): SkyPosition | null {
  const target = state.target;
  if (!target) return null;
  if (!target.moving) return target;
  if (fieldIsNow(state)) return bodyNow(target);
  const step = state.sequence[state.player.index];
  return state.frames[step ? step.frameIds[0] : 0]?.center ?? null;
}

/**
 * Where the sky map goes by itself when a study opens: to the target, to a marked body's
 * place today, or for any other moving body to where it was in its first image.
 */
export function mapHome(state: Study): SkyPosition | null {
  const target = state.target;
  if (!target) return null;
  if (!target.moving) return target;
  return bodyNow(target) ?? state.frames[0]?.center ?? null;
}

/**
 * True when an object from the sky map is the target of the study. A click on its label made
 * it the study, and its card stays up while it is.
 * A star or galaxy is known by its name and place. A planet, asteroid, or comet has no fixed
 * place, and the archive may name it differently ("Vesta" on the map, "4 Vesta (A807 FA)" in
 * the study), so it is known by the page about it, which both sides carry.
 */
export function isStudied(state: Pick<AppState, "target">, object: SkyObject): boolean {
  const target = state.target;
  if (target === null) return false;
  if (target.moving || object.solar) return target.moving !== undefined && object.solar !== undefined && Boolean(target.url) && target.url === object.url;
  return target.name === object.name && target.ra === object.ra && target.dec === object.dec;
}

/** The date of the image on screen, as a Modified Julian Date. Null before any image is found. */
export function fieldDate(state: Study): number | null {
  const step = state.sequence[state.player.index];
  return step?.mjd ?? state.frames[0]?.mjd ?? null;
}
