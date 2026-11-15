// Builds the playable sequence from the loaded frames: every exposure, one sum per visit,
// or one sum per spectral channel.
// Written with Claude Code (Anthropic) assistance.
import { formatDate, formatMonth } from "../sky/astro";
import type { Filters, Frame, SequenceItem, SequenceMode, Visit } from "../types";

/** True when a frame takes part under the current filters. */
export function passes(frame: Frame, filters: Filters): boolean {
  if (!filters.detectors[frame.detector - 1]) return false;
  if (Number.isFinite(frame.wavelength) && (frame.wavelength < filters.wlMin || frame.wavelength > filters.wlMax)) return false;
  return true;
}

/** "4.61 µm" style label. */
export function formatWavelength(microns: number): string {
  return Number.isFinite(microns) ? `${microns.toFixed(2)} µm` : "";
}

/** The average of a list. NaN for an empty list. */
function mean(values: number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return values.length ? total / values.length : NaN;
}

/** Gather frames that share a key into one step each, in time order, with a label per step. */
function group(frames: Frame[], prefix: string, keyOf: (f: Frame) => number, labelOf: (members: Frame[]) => string): SequenceItem[] {
  const buckets = new Map<number, Frame[]>();
  for (const frame of frames) {
    const key = keyOf(frame);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(frame);
    else buckets.set(key, [frame]);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, members]) => ({
      // The member count is part of the key so a sum is rebuilt as more frames arrive.
      key: `${prefix}${key}:${members.length}:${members[0].id}-${members[members.length - 1].id}`,
      label: labelOf(members),
      frameIds: members.map((f) => f.id),
      mjd: mean(members.map((f) => f.mjd)),
      wavelength: mean(members.map((f) => f.wavelength).filter(Number.isFinite)),
    }));
}

/** The steps to play, in order. Only frames whose pixels have arrived take part. */
export function buildSequence(frames: Frame[], mode: SequenceMode, filters: Filters, visits: Visit[] = []): SequenceItem[] {
  const usable = frames.filter((f) => f.status === "ready" && passes(f, filters));
  if (mode === "visits") {
    return group(usable, "v", (f) => f.season, (members) => {
      const label = visits[members[0].season]?.label ?? formatMonth(mean(members.map((f) => f.mjd)));
      return `${label} (${members.length} images)`;
    });
  }
  if (mode === "deep") {
    return group(usable, "d", () => 0, (members) => `All visits (${members.length} images)`);
  }
  if (mode === "channels") {
    return group(usable, "c", (f) => f.channel, (members) => `${formatWavelength(mean(members.map((f) => f.wavelength)))} (${members.length} images)`);
  }
  return usable.map((f) => ({
    key: `e${f.id}`,
    label: `${formatDate(f.mjd)}, ${formatWavelength(f.wavelength)}`,
    frameIds: [f.id],
    mjd: f.mjd,
    wavelength: f.wavelength,
  }));
}
