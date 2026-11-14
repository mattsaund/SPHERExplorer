// Builds a spectrum from the per-frame brightness measurements. Every SPHEREx exposure sees
// the target at a different wavelength, so the frames of one visit trace out a full spectrum.
// Written with Claude Code (Anthropic) assistance.
import type { Frame } from "./types";

/** One brightness measurement of the target. */
export interface SpectrumPoint {
  frameId: number;
  /** Microns. */
  wavelength: number;
  bandwidth: number;
  /** Microjansky. */
  flux: number;
  err: number;
  mjd: number;
  detector: number;
  season: number;
  channel: number;
  /** False when the measurement is suspect: saturated, flagged, or mostly masked. */
  good: boolean;
}

/** Measurements averaged within one spectral channel. */
export interface SpectrumBin {
  channel: number;
  wavelength: number;
  flux: number;
  err: number;
  /** Measurements that went into the average. */
  count: number;
  /** Visit number, or -1 when all visits are combined. */
  season: number;
}

/** A measurement is trusted when at least this share of the PSF fell on usable pixels. */
const MIN_PSF_SHARE = 0.75;

/** Every measured frame as a spectrum point, sorted by wavelength. */
export function spectrumOf(frames: Frame[], badMask: number): SpectrumPoint[] {
  const points: SpectrumPoint[] = [];
  for (const frame of frames) {
    const phot = frame.phot;
    if (frame.status !== "ready" || !phot || phot.flux == null || phot.err == null || !(phot.err > 0)) continue;
    points.push({
      frameId: frame.id,
      wavelength: frame.wavelength,
      bandwidth: frame.bandwidth,
      flux: phot.flux,
      err: phot.err,
      mjd: frame.mjd,
      detector: frame.detector,
      season: frame.season,
      channel: frame.channel,
      good: phot.frac >= MIN_PSF_SHARE && phot.nan === 0 && (phot.bits & badMask) === 0,
    });
  }
  return points.sort((a, b) => a.wavelength - b.wavelength);
}

/**
 * Average the good measurements in each spectral channel, weighting by their errors.
 * With perSeason, each visit gets its own spectrum, which shows brightness changes over time.
 */
export function binSpectrum(points: SpectrumPoint[], perSeason: boolean): SpectrumBin[] {
  const groups = new Map<string, SpectrumPoint[]>();
  for (const point of points) {
    if (!point.good) continue;
    const key = `${perSeason ? point.season : -1}:${point.channel}`;
    const group = groups.get(key);
    if (group) group.push(point);
    else groups.set(key, [point]);
  }
  const bins: SpectrumBin[] = [];
  for (const group of groups.values()) {
    let weight = 0;
    let flux = 0;
    let wavelength = 0;
    for (const p of group) {
      const w = 1 / (p.err * p.err);
      weight += w;
      flux += w * p.flux;
      wavelength += w * p.wavelength;
    }
    const mean = flux / weight;
    let err = Math.sqrt(1 / weight);
    if (group.length > 2) {
      // When measurements disagree by more than their errors say, report the larger spread.
      let chi = 0;
      for (const p of group) chi += ((p.flux - mean) / p.err) ** 2;
      err *= Math.max(1, Math.sqrt(chi / (group.length - 1)));
    }
    bins.push({
      channel: group[0].channel,
      wavelength: wavelength / weight,
      flux: mean,
      err,
      count: group.length,
      season: perSeason ? group[0].season : -1,
    });
  }
  return bins.sort((a, b) => a.season - b.season || a.wavelength - b.wavelength);
}

/** Microjansky to AB magnitude. Returns NaN for zero or negative flux. */
export function abMagnitude(microjansky: number): number {
  return microjansky > 0 ? 23.9 - 2.5 * Math.log10(microjansky) : NaN;
}

/** A readable flux with a unit that fits its size, for example "1.24 mJy". */
export function formatFlux(microjansky: number): string {
  const size = Math.abs(microjansky);
  if (size >= 1e6) return `${(microjansky / 1e6).toPrecision(3)} Jy`;
  if (size >= 1e3) return `${(microjansky / 1e3).toPrecision(3)} mJy`;
  return `${microjansky.toPrecision(3)} µJy`;
}
