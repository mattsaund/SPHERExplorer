// Shared types for the SPHERExplorer engine. Part of the frontend contract.
// Written with Claude Code (Anthropic) assistance.

/** A position on the sky. Angles are ICRS degrees. */
export interface SkyPosition {
  ra: number;
  dec: number;
}

/** A place on the sky, with optional motion so it can be followed through time. */
export interface Target extends SkyPosition {
  /** Display name, if the target was found by name. */
  name?: string;
  /** Julian year the position refers to, for example 2016.0. */
  epoch: number;
  /** Proper motion in mas per year. pmRa includes the cos(dec) factor. */
  pmRa?: number;
  pmDec?: number;
  /** Parallax in mas. */
  parallax?: number;
  /** Object type in plain words, for example "Brown dwarf". */
  kind?: string;
  /** Where the position came from, for example "SIMBAD". */
  source?: string;
}

/** Progress of anything that loads. */
export type LoadState = "idle" | "loading" | "ready" | "failed";
