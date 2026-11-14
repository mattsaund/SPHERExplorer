// Turns the spacecraft's orbital elements into a live position and a ground track.
// The orbit math is the standard SGP4 model, from the satellite.js library.
// Written with Claude Code (Anthropic) assistance.
import { degreesLat, degreesLong, eciToGeodetic, gstime, json2satrec, propagate, sunPos, type SatRec } from "satellite.js";
import type { SpacecraftNow } from "./types";

const EARTH_RADIUS_KM = 6371;

/** Build the orbit model from OMM elements. Returns null when they are unusable. */
export function orbitModel(elements: Record<string, string | number>): SatRec | null {
  try {
    return json2satrec(elements as unknown as Parameters<typeof json2satrec>[0]);
  } catch {
    return null;
  }
}

/** Julian date of a JavaScript Date. */
function julian(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** The point on Earth where the Sun is overhead: latitude and longitude in degrees. */
export function subsolarPoint(date: Date): { latitude: number; longitude: number } {
  const sun = sunPos(julian(date));
  const longitude = (((sun.rtasc - gstime(date)) * 180) / Math.PI) % 360;
  return { latitude: (sun.decl * 180) / Math.PI, longitude: ((longitude + 540) % 360) - 180 };
}

/** Where the spacecraft is at a moment. Returns null when the model can't be propagated that far. */
export function positionOf(model: SatRec, date: Date): SpacecraftNow | null {
  const state = propagate(model, date);
  if (!state || !state.position || !state.velocity || typeof state.position === "boolean" || typeof state.velocity === "boolean") return null;
  const ground = eciToGeodetic(state.position, gstime(date));
  const { x, y, z } = state.velocity;
  // In sunlight unless the spacecraft is behind the Earth as seen from the Sun.
  const sun = sunPos(julian(date));
  const toward = [Math.cos(sun.decl) * Math.cos(sun.rtasc), Math.cos(sun.decl) * Math.sin(sun.rtasc), Math.sin(sun.decl)];
  const p = state.position;
  const along = p.x * toward[0] + p.y * toward[1] + p.z * toward[2];
  const across = Math.sqrt(Math.max(0, p.x * p.x + p.y * p.y + p.z * p.z - along * along));
  return {
    latitude: degreesLat(ground.latitude),
    longitude: degreesLong(ground.longitude),
    altitude: ground.height,
    speed: Math.hypot(x, y, z),
    period: (2 * Math.PI) / model.no,
    sunlit: along > 0 || across > EARTH_RADIUS_KM,
  };
}

/** Ground positions [longitude, latitude] from `before` minutes ago to `after` minutes ahead. */
export function groundTrack(model: SatRec, date: Date, before: number, after: number, stepSeconds = 30): [number, number][] {
  const points: [number, number][] = [];
  for (let t = -before * 60; t <= after * 60; t += stepSeconds) {
    const at = positionOf(model, new Date(date.getTime() + t * 1000));
    if (at) points.push([at.longitude, at.latitude]);
  }
  return points;
}
