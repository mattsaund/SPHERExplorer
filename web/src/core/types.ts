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

/** One flag bit of the SPHEREx FLAGS plane. */
export interface FlagBit {
  bit: number;
  name: string;
  /** Plain-language meaning. */
  text: string;
  /** True when the bit makes a pixel unusable for measurement. */
  mask: boolean;
}

/** Instrument facts and live data collections, loaded once from the API. */
export interface Meta {
  version: string;
  /** Names of the IRSA collections being searched, for example "spherex_dr1". */
  collections: string[];
  /** Arcseconds per detector pixel. */
  pixelScale: number;
  /** Wavelength range in microns and resolving power per detector, keyed "1" to "6". */
  detectors: Record<string, { min: number; max: number; r: number }>;
  /** Central wavelength in microns of the 102 spectral channels. */
  channels: number[];
  flags: FlagBit[];
  /** All flag bits with mask = true, combined. */
  badMask: number;
}

/** PSF-fit brightness of the target in one frame. */
export interface Photometry {
  /** Flux density in microjansky, or null when it could not be measured. */
  flux: number | null;
  /** One-sigma uncertainty in microjansky. */
  err: number | null;
  /** Local sky level and scatter in MJy/sr. */
  sky: number | null;
  skyRms: number | null;
  /** Share of the PSF weight that fell on usable pixels, 0 to 1. */
  frac: number;
  /** Flag bits found within 1.5 pixels of the target. */
  bits: number;
  /** Saturated (empty) pixels within 1.5 pixels of the target. */
  nan: number;
  /** Measured position in frame pixels. */
  x: number;
  y: number;
}

/** Where a frame stands. */
export type FrameStatus = "pending" | "ready" | "failed";

/**
 * One SPHEREx exposure of the target on one detector.
 * Fields in the first group are known right after the search. The rest arrive with the pixels.
 */
export interface Frame {
  /** Position in the search result. Stable for the life of a target. */
  id: number;
  /** File key in the SPHEREx S3 bucket. */
  key: string;
  /** IRSA collection the frame came from. */
  collection: string;
  obsId: string;
  /** Detector array, 1 to 6. */
  detector: number;
  /** Exposure midpoint, Modified Julian Date (UTC). */
  mjd: number;
  /** Wavelength and bandwidth at the target in microns. Estimated until status is "ready". */
  wavelength: number;
  bandwidth: number;
  /** Index of the nearest of the 102 spectral channels. */
  channel: number;
  /** Which visit of the survey to this field, counting from 0. */
  season: number;
  /** Where the target is at this frame's time, after proper motion and parallax. */
  track: SkyPosition;
  status: FrameStatus;
  /** Why the frame failed, in plain words. */
  error?: string;

  /** Frame size in pixels. */
  nx?: number;
  ny?: number;
  /** Field center in frame pixels. */
  cx?: number;
  cy?: number;
  /** Pixel-to-sky matrix [de/dx, de/dy, dn/dx, dn/dy] in arcseconds per pixel. */
  m?: [number, number, number, number];
  /** Wavelength change per pixel in x and y, in microns. */
  dwl?: [number, number];
  /** Median background and robust scatter in MJy/sr. */
  bg?: number | null;
  rms?: number | null;
  /** PSF width in arcseconds. */
  fwhm?: number | null;
  /** All flag bits present in the frame, combined. */
  bits?: number;
  /** Count of saturated (empty) pixels in the frame. */
  nan?: number;
  /** Quality notes from the pipeline. */
  qa?: { l2?: string; astrom?: number; survey?: string; airglow?: boolean; aurora?: boolean; glow?: boolean };
  phot?: Photometry;
}

/** How the playable sequence is built from the frames. */
export type SequenceMode =
  /** Every exposure, in time order. */
  | "exposures"
  /** One summed image per visit. Best for motion. */
  | "visits"
  /** One summed image per spectral channel. A sweep through wavelength. */
  | "channels";

/** One step of the playable sequence: a single frame or a sum of frames. */
export interface SequenceItem {
  /** Stable identity, used to cache sums. */
  key: string;
  /** Short label, for example "Nov 2025" or "4.61 µm". */
  label: string;
  /** Frames that make up this step. */
  frameIds: number[];
  /** Mean time and wavelength of the members. */
  mjd: number;
  wavelength: number;
}

/** Brightness mapping curves. */
export type Stretch = "linear" | "sqrt" | "log" | "asinh";

/** Color tables for images. */
export type ColorMap = "gray" | "viridis" | "magma" | "inferno" | "plasma" | "cividis";

/** How images are drawn. */
export interface DisplaySettings {
  stretch: Stretch;
  /** Black and white points. In noise units when normalize is on, else MJy/sr above background. */
  lo: number;
  hi: number;
  colorMap: ColorMap;
  invert: boolean;
  /** Smooth between pixels instead of showing them as squares. */
  smooth: boolean;
  /** Scale each frame by its own noise so the look stays steady across wavelengths. */
  normalize: boolean;
  /** Tint pixels the pipeline flagged as unusable. */
  showFlags: boolean;
  /** Mark the target's expected position. */
  showMarker: boolean;
}

/** Which frames take part. */
export interface Filters {
  /** One switch per detector, index 0 is detector 1. */
  detectors: boolean[];
  /** Wavelength window in microns. */
  wlMin: number;
  wlMax: number;
}

/** Playback state. */
export interface Player {
  /** Current step of the sequence. */
  index: number;
  playing: boolean;
  /** Steps per second. */
  fps: number;
}

/** What is under the pointer in the frame view. */
export interface Hover extends SkyPosition {
  /** Pixel value in MJy/sr, or null over empty pixels. */
  value: number | null;
  /** Wavelength at that pixel in microns. */
  wavelength: number | null;
  /** Flag bits at that pixel. */
  bits: number;
}
