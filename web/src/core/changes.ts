// Finds what changed in a field between SPHEREx visits: sources that moved, and sources that
// got brighter or fainter. It checks every source in the loaded field, not only the target.
//
// The field's own steady sources are the yardstick. Their shared shift and shared brightness
// change from visit to visit are taken out first (relative astrometry and photometry), and
// their scatter sets how large a change must be to count. Brightness is always compared at
// like wavelengths, because every SPHEREx exposure of a spot is at a different wavelength.
// docs/methods.md describes the method and how it was checked.
// Written with Claude Code (Anthropic) assistance.
import { HALO_STARTS, HALO_WIDTH, chooseRing, measureAperture, measureRing } from "./aperture";
import { mjdToYear, offsetToSky, positionAt, skyOffset } from "./astro";
import { halfIsNaN } from "./half";
import { fixedSum } from "./layers";
import { formatChange } from "./lightcurve";
import { compass, locate } from "./motion";
import { getPixels } from "./pixels";
import { passes } from "./sequence";
import { robustNoise, type Stack } from "./stack";
import type { AppState } from "./store";
import type { Frame, SkyObject, Visit } from "./types";

/** A source found in a summed image. Offsets are from the field center in arcseconds. */
export interface Detected {
  east: number;
  north: number;
  /** Peak of the smoothed image over its noise. */
  snr: number;
}

/** Where a source was during one visit, after the shift the whole field shares is removed. */
export interface ChangePlace {
  /** Name of the visit, for example "May 2025", or "May to Aug 2025" when short visits were joined. */
  label: string;
  /** Mean time of the visit's images, Modified Julian Date. */
  mjd: number;
  /** Sky offset from the field center in arcseconds. Null when the source was not seen. */
  east: number | null;
  north: number | null;
  /** One-sigma uncertainty of the position, arcseconds. */
  err: number;
}

/** How bright a source was during one visit, after the change the whole field shares is removed. */
export interface ChangeLevel {
  label: string;
  mjd: number;
  /** Brightness relative to the other visits at the same wavelengths. 1 means no change. Null when not measured. */
  ratio: number | null;
  ratioErr: number;
  /** True when the source was clearly there during this visit, false when clearly not, null when unsure. */
  present: boolean | null;
}

/**
 * What kind of change a source showed. "appeared" means it was seen in some visits and not at
 * all in the others. "vanished" means it was missing from one visit and seen in the rest.
 */
export type ChangeKind = "moved" | "brightened" | "faded" | "appeared" | "vanished";

/** How one detector's wavelength range changed during the visit that stands out. */
export interface BandChange {
  /** Detector array, 1 to 6. */
  detector: number;
  /** Wavelength range of the images that were compared, microns. */
  range: [number, number];
  /** Brightness relative to the other visits, its uncertainty, and how many times the uncertainty the change is. */
  ratio: number;
  ratioErr: number;
  significance: number;
}

/** One source the search looked at, with what was measured for it. */
export interface CheckedSource {
  ra: number;
  dec: number;
  /** Sky offset from the field center, arcseconds. */
  east: number;
  north: number;
  /**
   * Where the source was, visit by visit. In a deep field, which is observed all year, months
   * are joined for this so that each sum holds the same mix of wavelengths.
   */
  places: ChangePlace[];
  /** How bright the source was, visit by visit. Every visit with enough images takes part. */
  levels: ChangeLevel[];
  /** A known object at this spot, when there is one. */
  object: SkyObject | null;
  /** True when this is the source at the target position. */
  target: boolean;
  /** True when the core is saturated or flagged in many images. Positions are then less certain. */
  saturated: boolean;
  /** True when a very bright star's halo reaches this source. Changes here must be twice as certain to count. */
  caution: boolean;
  /** True when that halo is stronger than the source itself, so the source was not judged. */
  blinded: boolean;
  /** How strongly the source stands out in the sum of all visits. */
  snr: number;
}

/** One source that changed. */
export interface FoundChange extends CheckedSource {
  kind: ChangeKind;
  /** How many times larger than its uncertainty the change is. */
  significance: number;
  /** For "moved": speed in arcseconds per year, its uncertainty, direction in degrees from north through east, and the shift between the first and last visit in arcseconds. */
  rate?: number;
  rateErr?: number;
  angle?: number;
  shift?: number;
  /** For "moved": the motion a catalog lists for this object, when known, for comparison. */
  catalog?: { rate: number; angle: number } | null;
  /** For a brightness change: which entry of `levels` stands out, and its brightness relative to the other visits. */
  visit?: number;
  ratio?: number;
  /** The wavelength range in microns the ratio was measured over, or null when it covers every wavelength. */
  band?: [number, number] | null;
  /** The same visit detector by detector, where it could be measured. Changes often differ with wavelength. */
  bands?: BandChange[];
  /** True when the brightness came from the star's outer halo because its core is too bright for the detector. */
  halo?: boolean;
}

/** The result of searching a field for change. */
export interface ChangeReport {
  /** Sources that were checked. */
  sources: number;
  /** Names of the visits whose positions were compared, in time order. */
  visits: string[];
  /** Names of visits left out because they hold too few images or wavelengths so far. */
  skipped: string[];
  /** Spectral channels seen in every compared visit. Only these went into the summed images. */
  channels: number;
  /**
   * Steady sources that set the yardsticks for position and for brightness.
   * Under five, the field can't set that yardstick and a cautious standard value is used.
   */
  positionReferences: number;
  brightnessReferences: number;
  /** The yardsticks: scatter of the steady sources in position (arcseconds) and brightness (a fraction). */
  positionScatter: number;
  brightnessScatter: number;
  /** The changes found, most certain first. */
  changes: FoundChange[];
  /** Every source that was looked at, brightest first, with its measurements. */
  checked: CheckedSource[];
  /** Plain words when the field could not be searched. */
  note: string | null;
}

/** A visit needs this many images, and this many spectral channels, to take part. */
const MIN_IMAGES = 6;
const MIN_VISIT_CHANNELS = 8;
/**
 * Deep fields are observed all year, and the app cuts that into months. Months less than this
 * many days apart are joined until they cover this share of the wavelengths, so that every
 * compared visit sees nearly the same colors.
 */
const JOIN_GAP_DAYS = 45;
const FULL_COVERAGE = 0.7;
/** A visit is left out when the others share at least this many times more channels without it. */
const DROP_GAIN = 2;
/** Sources are found above this signal-to-noise, and at most this many are checked. */
const DETECT_SNR = 8;
const MAX_SOURCES = 60;
/** Two peaks closer than this are one source, arcseconds. About one and a half pixels. */
const MIN_SEPARATION = 9.5;
/** Sources this close to the field edge are skipped, arcseconds. */
const BORDER = 15;
/** How far a source may sit from where it was found, per visit, arcseconds. */
const CAPTURE = 12;
/** A source must stand out this much in a visit for its position there to count. */
const MIN_VISIT_SNR = 5;
/** Steady sources brighter than this set the yardstick. At least MIN_REFERENCES are needed. */
const REFERENCE_SNR = 20;
const MIN_REFERENCES = 5;
/** Yardsticks used when the field has too few steady sources: arcseconds, and a fraction. */
const DEFAULT_POSITION_SCATTER = 0.4;
const DEFAULT_BRIGHTNESS_SCATTER = 0.04;
/** The measured yardsticks are kept inside these limits. */
const POSITION_LIMITS: [number, number] = [0.12, 0.8];
const BRIGHTNESS_LIMITS: [number, number] = [0.01, 0.2];
/** Centroid error is this many arcseconds divided by the signal-to-noise, unless the field says otherwise. */
const CENTROID_LIMITS: [number, number] = [1.5, 7];
/** A change must be this many times its uncertainty, and at least this large. */
const MOTION_SIGMA = 5;
const MIN_SHIFT = 1.0;      // arcseconds between the first and last visit
const BRIGHTNESS_SIGMA = 5;
const MIN_BRIGHTNESS = 0.05; // fraction
/** Beside a very bright star, a change must be this many times more certain to count. */
const CAUTION_FACTOR = 2;
/**
 * Glare is the light a bright star's halo adds inside a source's measuring circle, as a share
 * of the source's own light. From the first value up the source is treated with caution.
 * From the second it is not judged at all, because the halo changes with the bright star.
 */
const GLARE_CAUTION = 0.15;
const GLARE_BLIND = 1;
/** The halo is taken to fade as the cube of the distance, which is how star images behave far out. */
const HALO_POWER = 3;
/** A source whose core is bad in more than this share of the images is treated as too bright. */
const SPOILED_SHARE = 0.25;
/** Position floor for such a source, arcseconds. Its summed core is built from too few images. */
const BRIGHT_FLOOR = 1.0;
/** Halo measurements are trusted to this fraction at best. */
const HALO_SCATTER = 0.05;
/** A detector's range needs this many shared channels to be compared on its own. */
const MIN_BAND_CHANNELS = 6;
/** One detector's range must be this many times more certain than the whole spectrum to be the headline. */
const BAND_PREFERENCE = 1.5;
/** Errors of faint sources are widened by what the field shows, within these limits. */
const WIDEN_LIMITS: [number, number] = [1, 3];
/** A source seen in one visit only must be detected this strongly, and be this weak elsewhere. */
const APPEAR_SIGMA = 7;
const ABSENT_SIGMA = 2.5;
/** Radius of the measuring circle in arcseconds. About one PSF across. */
const APERTURE = 12;
/** A visit is compared with the others over at least this many shared channels. */
const MIN_SHARED_CHANNELS = 8;
/** A known object within this distance is taken to be the source, arcseconds. */
const MATCH_RADIUS = 9;
/** A saturated star within this distance earns a caution, arcseconds. */
const CAUTION_RADIUS = 45;
const CHANNELS_PER_DETECTOR = 17;

/** The middle value of a list. NaN for an empty list. */
function median(values: number[]): number {
  if (!values.length) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Keep a value inside a range. */
function clamp(value: number, [low, high]: [number, number]): number {
  return Math.min(high, Math.max(low, value));
}

/** Smooth along rows or columns with a 1-4-6-4-1 kernel, skipping empty pixels. */
function smooth(source: Float32Array, nx: number, ny: number, alongRows: boolean): Float32Array {
  const kernel = [1, 4, 6, 4, 1];
  const out = new Float32Array(source.length);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let total = 0;
      let weight = 0;
      for (let k = -2; k <= 2; k++) {
        const x = alongRows ? i + k : i;
        const y = alongRows ? j : j + k;
        if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
        const value = source[y * nx + x];
        if (value !== value) continue;
        total += kernel[k + 2] * value;
        weight += kernel[k + 2];
      }
      // A pixel with no data of its own stays empty, so sources are not invented at the edges.
      out[j * nx + i] = weight > 0 && source[j * nx + i] === source[j * nx + i] ? total / weight : NaN;
    }
  }
  return out;
}

/**
 * Find the sources in a summed image: peaks of the lightly smoothed image that stand out
 * from the noise. Brightest first. Saturated cores count as the brightest pixels of all.
 */
export function detectSources(stack: Stack, minSnr = DETECT_SNR, limit = MAX_SOURCES, border = BORDER): Detected[] {
  const { nx, ny, image } = stack;
  const scale = Math.abs(stack.m[0]);
  let top = 0;
  for (let k = 0; k < image.length; k++) if (image[k] > top && image[k] !== Infinity) top = image[k];
  const filled = new Float32Array(image.length);
  for (let k = 0; k < image.length; k++) filled[k] = image[k] === Infinity ? top * 2 : image[k];
  const smoothed = smooth(smooth(filled, nx, ny, true), nx, ny, false);
  const { median: level, rms } = robustNoise(smoothed);
  if (!(rms > 0)) return [];

  const edge = Math.max(2, Math.ceil(border / scale));
  const peaks: { i: number; j: number; value: number }[] = [];
  for (let j = edge; j < ny - edge; j++) {
    for (let i = edge; i < nx - edge; i++) {
      const value = smoothed[j * nx + i];
      if (!(value - level > minSnr * rms)) continue;
      let highest = true;
      for (let dj = -1; dj <= 1 && highest; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const other = smoothed[(j + dj) * nx + i + di];
          // Ties go to the pixel that comes first, so a flat top gives one peak.
          if (other > value || (other === value && (dj < 0 || (dj === 0 && di < 0)))) {
            highest = false;
            break;
          }
        }
      }
      if (highest) peaks.push({ i, j, value });
    }
  }
  peaks.sort((a, b) => b.value - a.value);
  const found: Detected[] = [];
  for (const peak of peaks) {
    const east = -(peak.i - stack.cx) * scale;
    const north = (peak.j - stack.cy) * scale;
    if (found.some((other) => Math.hypot(other.east - east, other.north - north) < MIN_SEPARATION)) continue;
    found.push({ east, north, snr: (peak.value - level) / rms });
    if (found.length >= limit) break;
  }
  return found;
}

/** A patch of saturated pixels in a summed image: the core of one very bright star. */
export interface SaturatedPatch {
  /** Middle of the patch as a sky offset from the field center, arcseconds. */
  east: number;
  north: number;
  /** Distance from the middle to the farthest saturated pixel, arcseconds. */
  radius: number;
  pixels: number;
}

/**
 * Find the patches of saturated pixels in a summed image. A star far past the detector's range
 * leaves a wide patch whose edge shows several peaks. Treating the patch as one star, at its
 * middle, keeps those peaks from being counted as separate sources.
 */
export function saturatedPatches(stack: Stack): SaturatedPatch[] {
  const { nx, ny, image } = stack;
  const scale = Math.abs(stack.m[0]);
  const seen = new Uint8Array(image.length);
  const patches: SaturatedPatch[] = [];
  for (let first = 0; first < image.length; first++) {
    if (image[first] !== Infinity || seen[first]) continue;
    // Gather every saturated pixel connected to this one.
    const members: number[] = [first];
    seen[first] = 1;
    for (let k = 0; k < members.length; k++) {
      const i = members[k] % nx;
      const j = (members[k] - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = i + di;
        const y = j + dj;
        if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
        const at = y * nx + x;
        if (image[at] !== Infinity || seen[at]) continue;
        seen[at] = 1;
        members.push(at);
      }
    }
    if (members.length < 2) continue;
    let sumI = 0;
    let sumJ = 0;
    for (const at of members) {
      sumI += at % nx;
      sumJ += Math.floor(at / nx);
    }
    const ci = sumI / members.length;
    const cj = sumJ / members.length;
    let reach = 0;
    for (const at of members) reach = Math.max(reach, Math.hypot((at % nx) - ci, Math.floor(at / nx) - cj));
    patches.push({ east: -(ci - stack.cx) * scale, north: (cj - stack.cy) * scale, radius: (reach + 0.5) * scale, pixels: members.length });
  }
  return patches.sort((a, b) => b.pixels - a.pixels);
}

/** A straight line through positions over time. Rates are per year. */
export interface MotionLine {
  /** Mean time of the points, in years, and the position at that time. */
  year: number;
  east: number;
  north: number;
  rateEast: number;
  rateNorth: number;
  errEast: number;
  errNorth: number;
  /** The motion over its uncertainty, both directions together. */
  significance: number;
}

/** Fit a straight line through positions over time, weighting each by its uncertainty. */
export function fitMotion(points: { year: number; east: number; north: number; err: number }[]): MotionLine | null {
  if (points.length < 2) return null;
  let s = 0, st = 0;
  for (const p of points) {
    const w = 1 / (p.err * p.err);
    s += w;
    st += w * p.year;
  }
  const year = st / s;
  let stt = 0, ste = 0, stn = 0, se = 0, sn = 0;
  for (const p of points) {
    const w = 1 / (p.err * p.err);
    const t = p.year - year;
    stt += w * t * t;
    ste += w * t * p.east;
    stn += w * t * p.north;
    se += w * p.east;
    sn += w * p.north;
  }
  if (!(stt > 0)) return null;
  const rateEast = ste / stt;
  const rateNorth = stn / stt;
  const err = Math.sqrt(1 / stt);
  return {
    year,
    east: se / s,
    north: sn / s,
    rateEast,
    rateNorth,
    errEast: err,
    errNorth: err,
    significance: Math.hypot(rateEast, rateNorth) / err,
  };
}

/** Weighted brightness sums of one source in one visit and one spectral channel. */
export interface ChannelSum {
  weight: number;
  flux: number;
}

/** How one visit's brightness compares with the other visits at the same wavelengths. */
export interface VisitBrightness {
  /** Weighted mean brightness in this visit and in the others, over the shared channels, with errors. */
  visit: number;
  visitErr: number;
  others: number;
  othersErr: number;
  /** visit divided by others, and its uncertainty. */
  ratio: number;
  ratioErr: number;
  /** Shared channels that went into the comparison. */
  channels: number;
}

/**
 * Compare one visit with all the others, channel by channel. Only channels measured in this
 * visit and in at least one other take part, and both sides get the same channel weights.
 * sums maps visit number to channel number to the weighted sums of that channel.
 * Pass `only` to compare a subset of channels, such as one detector, and `minChannels` to match.
 */
export function compareVisit(
  sums: Map<number, Map<number, ChannelSum>>,
  season: number,
  only: ((channel: number) => boolean) | null = null,
  minChannels = MIN_SHARED_CHANNELS,
): VisitBrightness | null {
  const own = sums.get(season);
  if (!own) return null;
  const rows: { fv: number; vv: number; fo: number; vo: number; w: number }[] = [];
  for (const [channel, mine] of own) {
    if (only && !only(channel)) continue;
    let weight = 0;
    let flux = 0;
    for (const [other, channels] of sums) {
      if (other === season) continue;
      const theirs = channels.get(channel);
      if (!theirs) continue;
      weight += theirs.weight;
      flux += theirs.flux;
    }
    if (!(weight > 0) || !(mine.weight > 0)) continue;
    const vv = 1 / mine.weight;
    const vo = 1 / weight;
    rows.push({ fv: mine.flux / mine.weight, vv, fo: flux / weight, vo, w: 1 / (vv + vo) });
  }
  if (rows.length < minChannels) return null;
  let a = 0, b = 0, va = 0, vb = 0, norm = 0;
  for (const row of rows) {
    a += row.w * row.fv;
    b += row.w * row.fo;
    va += row.w * row.w * row.vv;
    vb += row.w * row.w * row.vo;
    norm += row.w;
  }
  a /= norm;
  b /= norm;
  va /= norm * norm;
  vb /= norm * norm;
  const visitErr = Math.sqrt(va);
  const othersErr = Math.sqrt(vb);
  const ratio = b !== 0 ? a / b : Infinity;
  // When both sides are clearly detected and the channels disagree by more than their errors
  // say, widen the error of the ratio to match the real scatter. With one side near zero there
  // is no steady ratio to scatter around, so the errors are left as measured.
  let widen = 1;
  if (a > 5 * visitErr && b > 5 * othersErr) {
    let chi = 0;
    for (const row of rows) chi += row.w * (row.fv - ratio * row.fo) ** 2;
    widen = Math.max(1, Math.sqrt(chi / (rows.length - 1)));
  }
  const ratioErr = b !== 0 && a !== 0 ? Math.abs(ratio) * Math.hypot(visitErr / a, othersErr / b) * widen : Infinity;
  return { visit: a, visitErr, others: b, othersErr, ratio, ratioErr, channels: rows.length };
}

/** The spectral channel a frame shows at a sky offset from its center. The wavelength drifts across the frame. */
export function channelAt(frame: Frame, east: number, north: number): number {
  if (!frame.dwl || !frame.m || !(frame.bandwidth > 0)) return frame.channel;
  const [a, b, c, d] = frame.m;
  const det = a * d - b * c;
  if (!det) return frame.channel;
  const dx = (d * east - b * north) / det;
  const dy = (-c * east + a * north) / det;
  const steps = Math.round((frame.dwl[0] * dx + frame.dwl[1] * dy) / frame.bandwidth);
  const first = Math.floor(frame.channel / CHANNELS_PER_DETECTOR) * CHANNELS_PER_DETECTOR;
  return Math.min(first + CHANNELS_PER_DETECTOR - 1, Math.max(first, frame.channel + steps));
}

/** Let the page breathe between slices of work. */
function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A report with nothing in it, and a note that says why. */
function empty(note: string): ChangeReport {
  return { sources: 0, visits: [], skipped: [], channels: 0, positionReferences: 0, brightnessReferences: 0, positionScatter: NaN, brightnessScatter: NaN, changes: [], checked: [], note };
}

/** One or more visits compared as a unit. */
interface Epoch {
  seasons: number[];
  frames: Frame[];
  channels: Set<number>;
  start: number;
  end: number;
  label: string;
}

/**
 * Group the usable frames into the visits to compare. Returns the visits and the names of
 * those left out. Exported for tests.
 */
export function chooseEpochs(frames: Frame[], visits: Visit[]): { epochs: Epoch[]; skipped: string[] } {
  const name = (season: number) => visits.find((visit) => visit.season === season)?.label ?? `visit ${season + 1}`;
  const label = (seasons: number[]) => {
    if (seasons.length === 1) return name(seasons[0]);
    const first = name(seasons[0]);
    const last = name(seasons[seasons.length - 1]);
    // "May 2025 to Aug 2025" reads better as "May to Aug 2025" when the year is the same.
    const [firstMonth, firstYear] = first.split(" ");
    return firstYear && last.endsWith(` ${firstYear}`) ? `${firstMonth} to ${last}` : `${first} to ${last}`;
  };
  const bySeason = new Map<number, Frame[]>();
  for (const frame of frames) {
    const group = bySeason.get(frame.season);
    if (group) group.push(frame);
    else bySeason.set(frame.season, [frame]);
  }
  const all = new Set(frames.map((frame) => frame.channel));
  const singles = [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([season, group]) => ({
      seasons: [season],
      frames: group,
      channels: new Set(group.map((frame) => frame.channel)),
      start: Math.min(...group.map((frame) => frame.mjd)),
      end: Math.max(...group.map((frame) => frame.mjd)),
      label: "",
    }));

  // Join runs of closely spaced visits (a deep field's months) until each covers most wavelengths.
  const joined: Epoch[] = [];
  const merge = (into: Epoch, from: Epoch) => {
    into.seasons.push(...from.seasons);
    into.frames.push(...from.frames);
    for (const channel of from.channels) into.channels.add(channel);
    into.end = Math.max(into.end, from.end);
  };
  for (const single of singles) {
    const current = joined[joined.length - 1];
    if (current && single.start - current.end < JOIN_GAP_DAYS && current.channels.size < FULL_COVERAGE * all.size) merge(current, single);
    else joined.push(single);
  }
  // A group that still falls short joins a close neighbor rather than standing alone.
  for (let i = 0; i < joined.length; i++) {
    if (joined[i].channels.size >= FULL_COVERAGE * all.size) continue;
    if (i > 0 && joined[i].start - joined[i - 1].end < JOIN_GAP_DAYS) {
      merge(joined[i - 1], joined[i]);
      joined.splice(i, 1);
      i--;
    } else if (i + 1 < joined.length && joined[i + 1].start - joined[i].end < JOIN_GAP_DAYS) {
      merge(joined[i], joined[i + 1]);
      joined.splice(i + 1, 1);
      i--;
    }
  }
  for (const epoch of joined) epoch.label = label(epoch.seasons);

  const skipped: string[] = [];
  let epochs = joined.filter((epoch) => {
    const enough = epoch.frames.length >= MIN_IMAGES && epoch.channels.size >= MIN_VISIT_CHANNELS;
    if (!enough) skipped.push(epoch.label);
    return enough;
  });
  // Leave out a visit whose thin coverage would cost the others most of their shared wavelengths.
  const sharedBy = (list: Epoch[]) => (list.length ? [...list[0].channels].filter((channel) => list.every((epoch) => epoch.channels.has(channel))).length : 0);
  while (epochs.length > 2) {
    const now = sharedBy(epochs);
    let best: { epoch: Epoch; count: number } | null = null;
    for (const epoch of epochs) {
      const count = sharedBy(epochs.filter((other) => other !== epoch));
      if (!best || count > best.count) best = { epoch, count };
    }
    if (!best || (best.count < DROP_GAIN * now && now >= MIN_VISIT_CHANNELS)) break;
    skipped.push(best.epoch.label);
    epochs = epochs.filter((epoch) => epoch !== best!.epoch);
  }
  return { epochs, skipped };
}

/** One source while it is being worked on. */
interface Candidate {
  east: number;
  north: number;
  snr: number;
  /** True when the summed core holds saturated pixels. */
  saturated: boolean;
  /** True when the core is saturated or bad in too many images to trust. */
  bright: boolean;
  /** Position per visit, in the same order as the visits. Null when not seen. */
  places: ({ east: number; north: number; err: number; snr: number; saturated: boolean } | null)[];
  line: MotionLine | null;
  moved: boolean;
  /** Each visit against the others, one entry per brightness visit: over every wavelength, then detector by detector. */
  brightness: (VisitBrightness | null)[];
  bands: (VisitBrightness | null)[][];
  /** For a too-bright star: the inner radius of the ring its halo was measured in, arcseconds. */
  ringStart: number;
  /** Light from bright stars' halos inside this source's circle, as a share of its own light. */
  glare: number;
}

/** True when the 3 by 3 pixels around a spot hold an empty or flagged pixel. */
function coreSpoiled(frame: Frame, east: number, north: number, badMask: number): boolean | null {
  const pixels = getPixels(frame.id);
  if (!pixels || !frame.m || frame.cx === undefined || frame.cy === undefined) return null;
  const [a, b, c, d] = frame.m;
  const det = a * d - b * c;
  if (!det) return null;
  const x0 = Math.round(frame.cx + (d * east - b * north) / det);
  const y0 = Math.round(frame.cy + (-c * east + a * north) / det);
  if (x0 < 1 || y0 < 1 || x0 > pixels.nx - 2 || y0 > pixels.ny - 2) return null;
  for (let y = y0 - 1; y <= y0 + 1; y++) {
    for (let x = x0 - 1; x <= x0 + 1; x++) {
      const at = y * pixels.nx + x;
      if (halfIsNaN(pixels.half[at]) || (pixels.flags && pixels.flags[at] & badMask)) return true;
    }
  }
  return false;
}

/**
 * Search the loaded field for sources that moved or changed brightness between visits.
 * Uses the frames that pass the current filters. Calls onProgress with a fraction from 0 to 1.
 */
export async function findChanges(state: AppState, onProgress: (fraction: number) => void = () => {}): Promise<ChangeReport> {
  const target = state.target;
  if (!target) return empty("Pick a target first.");
  if (target.moving) return empty("A solar system body is followed image by image, so the sky behind it is different every time. Search a fixed spot instead.");

  const usable = state.frames.filter((frame) => frame.status === "ready" && passes(frame, state.filters));
  const { epochs, skipped } = chooseEpochs(usable, state.visits);
  if (epochs.length < 2) return { ...empty("SPHEREx has looked at this spot during one visit only, so there is nothing to compare yet."), skipped };
  // Sum only the channels that every visit has, so each sum is the same mix of wavelengths.
  const shared = new Set([...epochs[0].channels].filter((channel) => epochs.every((epoch) => epoch.channels.has(channel))));
  if (shared.size < MIN_VISIT_CHANNELS) return { ...empty("The visits to this spot do not share enough wavelengths to compare yet."), skipped };
  const count = epochs.length;

  const sums: Stack[] = [];
  const times: number[] = [];
  const ids: number[] = [];
  for (const epoch of epochs) {
    const members = epoch.frames.filter((frame) => shared.has(frame.channel));
    const sum = fixedSum(members.map((frame) => frame.id), `changes:${epoch.seasons.join("-")}`, state);
    if (!sum) return empty("The images of this spot could not be summed.");
    sums.push(sum.stack);
    times.push(members.reduce((total, frame) => total + frame.mjd, 0) / members.length);
    ids.push(...members.map((frame) => frame.id));
    await pause();
  }
  const all = fixedSum(ids.sort((a, b) => a - b), "changes:all", state);
  if (!all) return empty("The images of this spot could not be summed.");
  onProgress(0.15);
  const labels = epochs.map((epoch) => epoch.label);

  // Sources: everything in the sum of all visits, plus anything that stands out in one visit alone.
  const found: Detected[] = [];
  const add = (list: Detected[]) => {
    for (const source of list) {
      if (!found.some((other) => Math.hypot(other.east - source.east, other.north - source.north) < MIN_SEPARATION)) found.push(source);
    }
  };
  add(detectSources(all.stack));
  for (const sum of sums) add(detectSources(sum));
  found.sort((a, b) => b.snr - a.snr);

  // Flags that mark glints and streaks count as bad here, as they do when frames are summed.
  const badMask = state.meta?.stackMask ?? state.meta?.badMask ?? 0;
  const everyFrame = epochs.flatMap((epoch) => epoch.frames);
  const edge = state.fieldSize / 2 - BORDER;
  // A star far past the detector's range is one source at the middle of its saturated patch.
  const patches = saturatedPatches(all.stack).filter((patch) => Math.abs(patch.east) < edge && Math.abs(patch.north) < edge);
  const insidePatch = (east: number, north: number) => patches.some((patch) => Math.hypot(east - patch.east, north - patch.north) <= patch.radius + MIN_SEPARATION);
  const candidates: Candidate[] = [];
  const blank = { line: null, moved: false, brightness: [], bands: [], ringStart: HALO_STARTS[0], glare: 0 };
  for (const patch of patches) {
    const places = sums.map((sum) => locate(sum, [patch.east, patch.north], CAPTURE));
    candidates.push({ ...blank, east: patch.east, north: patch.north, snr: (found[0]?.snr ?? 1) * 2, saturated: true, bright: true, places });
  }
  for (const source of found.filter((entry) => !insidePatch(entry.east, entry.north)).slice(0, MAX_SOURCES)) {
    const places = sums.map((sum) => {
      const place = locate(sum, [source.east, source.north], CAPTURE);
      return place && place.snr >= MIN_VISIT_SNR ? place : null;
    });
    const whole = locate(all.stack, [source.east, source.north], CAPTURE);
    const east = whole?.east ?? source.east;
    const north = whole?.north ?? source.north;
    // A core that is flagged in many images was summed from too few of them to hold its shape.
    let spoiled = 0;
    let checkedFrames = 0;
    for (const frame of everyFrame) {
      const bad = coreSpoiled(frame, east, north, badMask);
      if (bad === null) continue;
      checkedFrames++;
      if (bad) spoiled++;
    }
    candidates.push({ ...blank, east, north, snr: source.snr, saturated: false, bright: checkedFrames > 0 && spoiled > SPOILED_SHARE * checkedFrames, places });
  }
  if (!candidates.length) return { ...empty("No source in this field is bright enough to check."), visits: labels, skipped, channels: shared.size };
  await pause();

  // ---- Positions -----------------------------------------------------------------------------
  // The shift every steady source shares in a visit is pointing error, not motion. Remove it.
  const steady = candidates.filter((c) => !c.bright && c.places.every((place) => place !== null && place.snr >= REFERENCE_SNR));
  if (steady.length >= MIN_REFERENCES) {
    const offsets = sums.map((_, v) => {
      const east: number[] = [];
      const north: number[] = [];
      for (const c of steady) {
        east.push(c.places[v]!.east - c.places.reduce((total, place) => total + place!.east, 0) / count);
        north.push(c.places[v]!.north - c.places.reduce((total, place) => total + place!.north, 0) / count);
      }
      return [median(east), median(north)];
    });
    for (const c of candidates) {
      c.places.forEach((place, v) => {
        if (!place) return;
        place.east -= offsets[v][0];
        place.north -= offsets[v][1];
      });
    }
  }
  // What is left for the steady sources is the real position scatter of this field.
  const correction = Math.sqrt(count / (count - 1)); // a mean of few points hides part of the scatter
  const residualsOf = (c: Candidate): { r: number; snr: number }[] => {
    if (c.places.some((place) => place === null)) return [];
    const meanEast = c.places.reduce((total, place) => total + place!.east, 0) / count;
    const meanNorth = c.places.reduce((total, place) => total + place!.north, 0) / count;
    return c.places.flatMap((place) => [{ r: Math.abs(place!.east - meanEast), snr: place!.snr }, { r: Math.abs(place!.north - meanNorth), snr: place!.snr }]);
  };
  const positionScatter = steady.length >= MIN_REFERENCES
    ? clamp(1.4826 * median(steady.flatMap(residualsOf).map((x) => x.r)) * correction, POSITION_LIMITS)
    : DEFAULT_POSITION_SCATTER;
  // Fainter sources scatter more. Learn how much from the field: error = factor / signal-to-noise.
  const faint = candidates.filter((c) => !c.bright && !steady.includes(c)).flatMap(residualsOf);
  const centroid = faint.length >= 2 * MIN_REFERENCES ? clamp(1.4826 * median(faint.map((x) => x.r * x.snr)) * correction, CENTROID_LIMITS) : CENTROID_LIMITS[1];

  for (const c of candidates) {
    for (const place of c.places) if (place) place.err = Math.hypot(centroid / place.snr, positionScatter, c.bright ? BRIGHT_FLOOR : 0);
    const points = c.places.flatMap((place, v) => (place ? [{ year: mjdToYear(times[v]), east: place.east, north: place.north, err: place.err }] : []));
    c.line = fitMotion(points);
  }
  // A very bright star spreads glints that turn with the spacecraft. Be twice as careful beside one.
  const glare = candidates.filter((c) => c.bright);
  const cautious = (c: Candidate) => glare.some((star) => star !== c && star.snr > 5 * c.snr && Math.hypot(star.east - c.east, star.north - c.north) <= CAUTION_RADIUS);
  for (const c of candidates) {
    if (!c.line) continue;
    const seen = c.places.flatMap((place, v) => (place ? [mjdToYear(times[v])] : []));
    const shift = Math.hypot(c.line.rateEast, c.line.rateNorth) * (seen[seen.length - 1] - seen[0]);
    c.moved = c.line.significance >= MOTION_SIGMA * (cautious(c) ? CAUTION_FACTOR : 1) && shift >= MIN_SHIFT;
  }
  onProgress(0.3);

  // ---- Brightness ----------------------------------------------------------------------------
  // Measure every source on every frame, then compare visits at like wavelengths. A normal
  // source is measured in a circle. A star too bright for the detector is measured in a ring
  // around it, where its halo is still within range.
  // Every visit with enough images takes part on its own, including a deep field's months:
  // joining them would blur a star that varies within the joined span.
  const bySeason = new Map<number, Frame[]>();
  for (const frame of usable) {
    const group = bySeason.get(frame.season);
    if (group) group.push(frame);
    else bySeason.set(frame.season, [frame]);
  }
  const lights = [...bySeason.entries()]
    .filter(([, frames]) => frames.length >= MIN_IMAGES)
    .sort((a, b) => a[0] - b[0])
    .map(([season, frames]) => ({
      label: state.visits.find((visit) => visit.season === season)?.label ?? `visit ${season + 1}`,
      mjd: frames.reduce((total, frame) => total + frame.mjd, 0) / frames.length,
      frames,
    }));
  const lightFrames = lights.flatMap((light) => light.frames);
  const detectorOf = (channel: number) => Math.floor(channel / CHANNELS_PER_DETECTOR) + 1;
  let last = Date.now();
  for (let k = 0; k < candidates.length; k++) {
    const c = candidates[k];
    // Where the halo ring starts for a too-bright star: just outside its bad core.
    if (c.bright) c.ringStart = chooseRing(lightFrames, c.east, c.north, badMask);
    const ringStart = c.ringStart;
    const perVisit = new Map<number, Map<number, ChannelSum>>();
    lights.forEach((light, v) => {
      const channels = new Map<number, ChannelSum>();
      for (const frame of light.frames) {
        const pixels = getPixels(frame.id);
        if (!pixels) continue;
        // A mover is measured where its fitted motion puts it at the time of the frame.
        let east = c.east;
        let north = c.north;
        if (c.moved && c.line) {
          const dt = mjdToYear(frame.mjd) - c.line.year;
          east = c.line.east + c.line.rateEast * dt;
          north = c.line.north + c.line.rateNorth * dt;
        }
        const measured = c.bright ? measureRing(frame, pixels, east, north, ringStart, ringStart + HALO_WIDTH, badMask) : measureAperture(frame, pixels, east, north, APERTURE, badMask);
        if (!measured || !measured.good || !(measured.err > 0)) continue;
        const channel = channelAt(frame, east, north);
        const weight = 1 / (measured.err * measured.err);
        const sum = channels.get(channel) ?? { weight: 0, flux: 0 };
        sum.weight += weight;
        sum.flux += weight * measured.flux;
        channels.set(channel, sum);
      }
      perVisit.set(v, channels);
    });
    c.brightness = lights.map((_, v) => compareVisit(perVisit, v));
    c.bands = lights.map((_, v) => [1, 2, 3, 4, 5, 6].map((detector) => compareVisit(perVisit, v, (channel) => detectorOf(channel) === detector, MIN_BAND_CHANNELS)));
    if (Date.now() - last > 30) {
      onProgress(0.3 + (0.65 * (k + 1)) / candidates.length);
      await pause();
      last = Date.now();
    }
  }

  // ---- Glare ---------------------------------------------------------------------------------
  // A very bright star spreads a halo over its neighbors, and the halo changes when the star
  // does. Estimate how much of it lands in each source's circle, from the star's own ring.
  // The halo can matter in one range of wavelengths only: a red star's halo swamps its
  // neighbors at 4 microns while leaving them alone at 1. So the worst range counts.
  const typical = (rows: (VisitBrightness | null)[]): number => {
    const values = rows.flatMap((b) => (b ? [b.visit] : []));
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : NaN;
  };
  // Every way a source's light is tallied: over all wavelengths, then detector by detector.
  const tallies = (c: Candidate): number[] => [typical(c.brightness), ...[0, 1, 2, 3, 4, 5].map((d) => typical(c.bands.map((row) => row[d])))];
  const halos = candidates.filter((star) => star.bright).map((star) => ({
    star,
    // Ring light = strength times the integral of distance^-3 over the ring. Solve for the strength.
    strengths: tallies(star).map((ring) => ring / (2 * Math.PI * (1 / star.ringStart - 1 / (star.ringStart + HALO_WIDTH)))),
  }));
  for (const c of candidates) {
    if (c.bright) continue;
    const own = tallies(c);
    for (const { star, strengths } of halos) {
      const distance = Math.max(20, Math.hypot(star.east - c.east, star.north - c.north));
      const spread = distance ** -HALO_POWER * Math.PI * APERTURE * APERTURE;
      for (let k = 0; k < own.length; k++) {
        if (!(strengths[k] > 0)) continue;
        // A source too faint to measure in a range the halo fills is as good as drowned there.
        const share = own[k] > 0 ? (strengths[k] * spread) / own[k] : k === 0 ? Infinity : 0;
        if (share > c.glare) c.glare = share;
      }
    }
  }

  // True when the source is clearly detected both in the visit and in the others, so a ratio means something.
  const seen = (b: VisitBrightness | null): boolean => b !== null && b.others > 5 * b.othersErr && b.visit > 5 * b.visitErr;
  const strong = (b: VisitBrightness | null): boolean => seen(b) && b!.visit > REFERENCE_SNR * b!.visitErr;
  // The brightness change every steady source shares in a visit is calibration, not the sky. Remove it,
  // over all wavelengths and detector by detector. What is left for the steady sources is the yardstick.
  // A steady source here is an ordinary, well measured one: strong in at least two visits, weak in none.
  // It also sits clear of any bright star's halo.
  const lamps = candidates.filter((c) => !c.bright && !c.moved && c.glare < GLARE_CAUTION && c.brightness.filter(strong).length >= 2 && c.brightness.every((b) => b === null || strong(b)));
  const level = (pick: (c: Candidate, v: number) => VisitBrightness | null, fallbackGain: number[], fallbackScatter: number): { gains: number[]; scatter: number } => {
    const gains = fallbackGain.slice();
    const spreads: number[] = [];
    const noises: number[] = [];
    for (let v = 0; v < lights.length; v++) {
      // Only lamps that are strong in this very comparison can say how steady it is.
      const rows = lamps.map((c) => pick(c, v)).filter(strong) as VisitBrightness[];
      if (rows.length < MIN_REFERENCES) continue;
      gains[v] = median(rows.map((b) => b.ratio));
      for (const b of rows) {
        spreads.push(Math.abs(b.ratio / gains[v] - 1));
        noises.push(b.ratioErr / gains[v]);
      }
    }
    if (spreads.length < 2 * MIN_REFERENCES) return { gains, scatter: fallbackScatter };
    // The yardstick is what the steady sources scatter by beyond their own measurement noise.
    const spread = 1.4826 * median(spreads);
    const noise = median(noises);
    return { gains, scatter: clamp(Math.sqrt(Math.max(0, spread * spread - noise * noise)), BRIGHTNESS_LIMITS) };
  };
  const whole = level((c, v) => c.brightness[v], lights.map(() => 1), DEFAULT_BRIGHTNESS_SCATTER);
  const brightnessScatter = whole.scatter;
  const perBand = [0, 1, 2, 3, 4, 5].map((d) => level((c, v) => c.bands[v][d], whole.gains, Math.min(BRIGHTNESS_LIMITS[1], 1.5 * whole.scatter)));
  const rescale = (b: VisitBrightness | null, gain: number) => {
    if (!b) return;
    b.ratio /= gain;
    b.ratioErr /= gain;
    b.visit /= gain;
    b.visitErr /= gain;
  };
  for (const c of candidates) {
    c.brightness.forEach((b, v) => rescale(b, whole.gains[v]));
    c.bands.forEach((row, v) => row.forEach((b, d) => rescale(b, perBand[d].gains[v])));
  }
  // Faint sources disagree with their formal errors more than bright ones do. Learn by how much.
  const pulls = candidates
    .filter((c) => !c.bright && !c.moved && c.glare < GLARE_CAUTION && !lamps.includes(c))
    .flatMap((c) => c.brightness.flatMap((b) => (seen(b) ? [Math.abs(b!.ratio - 1) / b!.ratioErr] : [])));
  const widen = pulls.length >= 2 * MIN_REFERENCES ? clamp(1.4826 * median(pulls), WIDEN_LIMITS) : 1;

  // ---- Verdicts ------------------------------------------------------------------------------
  const meanMjd = times.reduce((total, time) => total + time, 0) / count;
  const known = state.fieldObjects.map((object) => ({
    object,
    offset: skyOffset(positionAt({ ra: object.ra, dec: object.dec, epoch: object.epoch, pmRa: object.pmRa ?? 0, pmDec: object.pmDec ?? 0 }, meanMjd), target),
  }));
  const home = skyOffset(positionAt(target, meanMjd), target);
  // The wavelength range each detector's images actually cover in this field.
  const ranges = [1, 2, 3, 4, 5, 6].map((detector) => {
    const waves = lightFrames.filter((frame) => frame.detector === detector && Number.isFinite(frame.wavelength)).map((frame) => frame.wavelength);
    return waves.length ? [Math.min(...waves), Math.max(...waves)] as [number, number] : null;
  });

  const changes: FoundChange[] = [];
  const checked: CheckedSource[] = [];
  for (const c of candidates) {
    const careful = cautious(c) || c.glare >= GLARE_CAUTION;
    const blinded = c.glare >= GLARE_BLIND;
    const present = (b: VisitBrightness | null): boolean | null => (!b || c.bright ? null : b.visit >= APPEAR_SIGMA * b.visitErr ? true : b.visit < ABSENT_SIGMA * b.visitErr ? false : null);
    const places: ChangePlace[] = epochs.map((epoch, v) => ({
      label: epoch.label,
      mjd: times[v],
      east: c.places[v]?.east ?? null,
      north: c.places[v]?.north ?? null,
      err: c.places[v]?.err ?? NaN,
    }));
    const levels: ChangeLevel[] = lights.map((light, v) => ({
      label: light.label,
      mjd: light.mjd,
      ratio: seen(c.brightness[v]) ? c.brightness[v]!.ratio : null,
      ratioErr: c.brightness[v]?.ratioErr ?? NaN,
      present: present(c.brightness[v]),
    }));
    const nearest = known.reduce<{ object: SkyObject; distance: number } | null>((best, entry) => {
      const distance = Math.hypot(entry.offset[0] - c.east, entry.offset[1] - c.north);
      // A saturated star's middle is less certain, so its catalog match may sit a little further off.
      return distance <= MATCH_RADIUS * (c.saturated ? 2 : 1) && (!best || distance < best.distance) ? { object: entry.object, distance } : best;
    }, null);
    const base: CheckedSource = {
      ...offsetToSky(c.east, c.north, target),
      east: c.east,
      north: c.north,
      places,
      levels,
      object: nearest?.object ?? null,
      target: Math.hypot(c.east - home[0], c.north - home[1]) <= MATCH_RADIUS * (c.saturated ? 2 : 1),
      saturated: c.bright,
      caution: careful,
      blinded,
      snr: c.snr,
    };
    checked.push(base);
    // Deep in a bright star's glare, neither position nor brightness can be trusted.
    if (blinded) continue;

    if (c.moved && c.line && c.line.significance >= MOTION_SIGMA * (careful ? CAUTION_FACTOR : 1)) {
      const when = c.places.flatMap((place, v) => (place ? [mjdToYear(times[v])] : []));
      const rate = Math.hypot(c.line.rateEast, c.line.rateNorth);
      // The catalog motion of the matched object, or of the target itself, for comparison.
      const listed = base.target && target.pmRa !== undefined && target.pmDec !== undefined
        ? [target.pmRa, target.pmDec]
        : nearest && nearest.object.pmRa !== null && nearest.object.pmDec !== null ? [nearest.object.pmRa, nearest.object.pmDec] : null;
      changes.push({
        ...base,
        kind: "moved",
        significance: c.line.significance,
        rate,
        rateErr: c.line.errEast,
        angle: ((Math.atan2(c.line.rateEast, c.line.rateNorth) * 180) / Math.PI + 360) % 360,
        shift: rate * (when[when.length - 1] - when[0]),
        catalog: listed ? { rate: Math.hypot(listed[0], listed[1]) / 1000, angle: ((Math.atan2(listed[0], listed[1]) * 180) / Math.PI + 360) % 360 } : null,
      });
    }

    // A source that is clearly there in some visits and clearly not in others came or went.
    const measured = levels.flatMap((_, v) => (c.brightness[v] ? [v] : []));
    const there = measured.filter((v) => levels[v].present === true);
    const gone = measured.filter((v) => levels[v].present === false);
    const need = careful ? CAUTION_FACTOR : 1;
    if (there.length && gone.length && there.length + gone.length === measured.length) {
      const strength = (v: number) => c.brightness[v]!.visit / c.brightness[v]!.visitErr;
      if (there.length <= gone.length) {
        // Seen in the fewer visits: it appeared. Name the visit where it is clearest.
        const v = there.reduce((a, b) => (strength(b) > strength(a) ? b : a));
        if (strength(v) >= APPEAR_SIGMA * need) changes.push({ ...base, kind: "appeared", significance: strength(v), visit: v, ratio: Infinity, band: null, bands: [], halo: false });
      } else {
        // Missing from the fewer visits: it vanished. Its weakest detection elsewhere sets the certainty.
        const weakest = Math.min(...there.map(strength));
        if (weakest >= APPEAR_SIGMA * need) changes.push({ ...base, kind: "vanished", significance: weakest, visit: gone[0], ratio: 0, band: null, bands: [], halo: false });
      }
      continue;
    }

    // Otherwise, the visit whose brightness stands out most from the others: over every
    // wavelength, or within one detector's range when the change is confined to some colors.
    const floor = c.bright ? Math.max(brightnessScatter, HALO_SCATTER) : brightnessScatter;
    const grow = c.bright ? 1 : widen;
    const weigh = (b: VisitBrightness | null, scatter: number): number => (seen(b) ? Math.abs(b!.ratio - 1) / Math.hypot(b!.ratioErr * grow, scatter) : 0);
    const bandFloor = (d: number) => (c.bright ? Math.max(perBand[d].scatter, HALO_SCATTER) : perBand[d].scatter);
    let best: { v: number; d: number | null; significance: number; ratio: number } | null = null;
    for (let v = 0; v < lights.length; v++) {
      const options: { d: number | null; b: VisitBrightness | null; significance: number }[] = [{ d: null, b: c.brightness[v], significance: weigh(c.brightness[v], floor) }];
      for (let d = 0; d < 6; d++) options.push({ d, b: c.bands[v][d], significance: weigh(c.bands[v][d], bandFloor(d)) });
      for (const option of options) {
        if (!option.b || option.significance < BRIGHTNESS_SIGMA * need || Math.abs(option.b.ratio - 1) < MIN_BRIGHTNESS) continue;
        // The whole-spectrum comparison wins unless one range is far clearer, since it is the simpler statement.
        if (!best || option.significance > best.significance * (option.d === null ? 1 : BAND_PREFERENCE)) best = { v, d: option.d, significance: option.significance, ratio: option.b.ratio };
      }
    }
    if (best) {
      const { v, d, significance, ratio } = best as { v: number; d: number | null; significance: number; ratio: number };
      const bands: BandChange[] = [];
      for (let k = 0; k < 6; k++) {
        const b = c.bands[v][k];
        if (!seen(b) || !ranges[k]) continue;
        bands.push({ detector: k + 1, range: ranges[k]!, ratio: b!.ratio, ratioErr: Math.hypot(b!.ratioErr * grow, bandFloor(k)), significance: weigh(b, bandFloor(k)) });
      }
      changes.push({ ...base, kind: ratio > 1 ? "brightened" : "faded", significance, visit: v, ratio, band: d === null ? null : ranges[d], bands, halo: c.bright });
    }
  }
  changes.sort((a, b) => b.significance - a.significance);
  onProgress(1);

  return {
    sources: candidates.length,
    visits: labels,
    skipped,
    channels: shared.size,
    positionReferences: steady.length >= MIN_REFERENCES ? steady.length : 0,
    brightnessReferences: lamps.length >= MIN_REFERENCES ? lamps.length : 0,
    positionScatter,
    brightnessScatter,
    changes,
    checked,
    note: null,
  };
}

/** A word or two for a marker on the image: "moved 5.2\u2033", "+30%", "new", or "gone". */
export function changeLabel(change: FoundChange): string {
  if (change.kind === "moved") return `moved ${change.shift!.toFixed(1)}\u2033`;
  if (change.kind === "appeared") return "new";
  if (change.kind === "vanished") return "gone";
  return formatChange(change.ratio!);
}

/** "12.5" or "34" for a brightness ratio's change in percent. */
function percentOf(ratio: number): string {
  const percent = Math.abs((ratio - 1) * 100);
  return percent < 10 ? percent.toFixed(1) : percent.toFixed(0);
}

/** "0.75 to 1.10 microns" for a wavelength range. */
function rangeText(range: [number, number]): string {
  return `${range[0].toFixed(2)} to ${range[1].toFixed(2)} microns`;
}

/** One to three plain sentences for a found change. */
export function describeChange(change: FoundChange): string {
  const name = (index: number) => change.levels[index]?.label ?? "one visit";
  if (change.kind === "moved") {
    const seen = change.places.filter((place) => place.east !== null);
    const text = `Moved ${change.shift!.toFixed(1)} arcsec to the ${compass(change.angle!)} between ${seen[0].label} and ${seen[seen.length - 1].label}. That is ${change.rate!.toFixed(1)} arcsec per year, give or take ${change.rateErr!.toFixed(1)}.`;
    return change.catalog ? `${text} Its catalog motion is ${change.catalog.rate.toFixed(1)} arcsec per year to the ${compass(change.catalog.angle)}.` : text;
  }
  if (change.kind === "appeared") {
    const there = change.levels.filter((level) => level.present).map((level) => level.label);
    return `Seen in ${there.join(" and ")} only. It is missing from the other visits.`;
  }
  if (change.kind === "vanished") return `Missing in ${name(change.visit!)}. It is there in the other visits.`;
  const word = (ratio: number) => (ratio > 1 ? "brighter" : "fainter");
  let text = `${percentOf(change.ratio!)} percent ${word(change.ratio!)} in ${name(change.visit!)} than in the other visits, ${change.band ? `at ${rangeText(change.band)}` : "at the same wavelengths"}.`;
  // A change that goes the other way at other wavelengths says a lot about its cause.
  const opposite = (change.bands ?? [])
    .filter((band) => band.significance >= 3 && band.ratio > 1 !== change.ratio! > 1)
    .sort((a, b) => b.significance - a.significance)[0];
  if (opposite) text += ` At ${rangeText(opposite.range)} it was ${percentOf(opposite.ratio)} percent ${word(opposite.ratio)}.`;
  if (change.halo) text += " Measured from the star's outer halo, because its core is too bright for the detector.";
  return text;
}
