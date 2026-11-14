// Brightness over time. Every SPHEREx exposure of a target is at a different wavelength, so raw
// brightness can't be compared from one exposure to the next. This module divides each
// measurement by the target's average brightness at the same wavelength channel. What is left
// is how much brighter or fainter the target was at that moment, whatever the wavelength.
// Written with Claude Code (Anthropic) assistance.
import type { SpectrumPoint } from "./spectrum";

/** One measurement relative to the target's usual brightness at that wavelength. */
export interface LightPoint {
  frameId: number;
  mjd: number;
  season: number;
  detector: number;
  wavelength: number;
  /** 1 means the usual brightness. 1.2 means 20 percent brighter. */
  ratio: number;
  err: number;
}

/** The average relative brightness during one visit. */
export interface VisitChange {
  season: number;
  ratio: number;
  err: number;
  /** Measurements that went into the average. */
  count: number;
}

export interface LightCurve {
  points: LightPoint[];
  visits: VisitChange[];
}

/** A channel's average must be detected at least this strongly to serve as a reference. */
const MIN_REFERENCE_SNR = 5;

export function lightCurve(points: SpectrumPoint[]): LightCurve {
  // Average brightness per channel over all visits, from trusted measurements.
  const channels = new Map<number, { weight: number; flux: number; seasons: Set<number> }>();
  for (const p of points) {
    if (!p.good) continue;
    const w = 1 / (p.err * p.err);
    const entry = channels.get(p.channel) ?? { weight: 0, flux: 0, seasons: new Set<number>() };
    entry.weight += w;
    entry.flux += w * p.flux;
    entry.seasons.add(p.season);
    channels.set(p.channel, entry);
  }

  const out: LightPoint[] = [];
  for (const p of points) {
    if (!p.good) continue;
    const entry = channels.get(p.channel)!;
    const mean = entry.flux / entry.weight;
    const meanErr = Math.sqrt(1 / entry.weight);
    // A channel seen in one visit only says nothing about change. A weak average gives wild ratios.
    if (entry.seasons.size < 2 || !(mean > MIN_REFERENCE_SNR * meanErr)) continue;
    out.push({ frameId: p.frameId, mjd: p.mjd, season: p.season, detector: p.detector, wavelength: p.wavelength, ratio: p.flux / mean, err: p.err / mean });
  }
  out.sort((a, b) => a.mjd - b.mjd);

  const groups = new Map<number, LightPoint[]>();
  for (const p of out) {
    const group = groups.get(p.season);
    if (group) group.push(p);
    else groups.set(p.season, [p]);
  }
  const visits: VisitChange[] = [];
  for (const [season, group] of groups) {
    let weight = 0;
    let total = 0;
    for (const p of group) {
      const w = 1 / (p.err * p.err);
      weight += w;
      total += w * p.ratio;
    }
    const ratio = total / weight;
    let err = Math.sqrt(1 / weight);
    if (group.length > 2) {
      // Report the larger of the formal error and the real scatter.
      let chi = 0;
      for (const p of group) chi += ((p.ratio - ratio) / p.err) ** 2;
      err *= Math.max(1, Math.sqrt(chi / (group.length - 1)));
    }
    visits.push({ season, ratio, err, count: group.length });
  }
  visits.sort((a, b) => a.season - b.season);
  return { points: out, visits };
}

/** "+12%" or "-8%" for a brightness ratio. */
export function formatChange(ratio: number): string {
  const percent = (ratio - 1) * 100;
  const digits = Math.abs(percent) < 10 ? 1 : 0;
  return `${percent >= 0 ? "+" : "-"}${Math.abs(percent).toFixed(digits)}%`;
}
