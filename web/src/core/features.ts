// Finds which known spectral features stand out in a spectrum. For each feature in the
// library it compares the brightness at the feature with a straight line drawn through the
// spectrum on either side. A feature counts when the gap is large against both the
// measurement noise and the small channel-to-channel ripple of the instrument.
// SPHEREx has low spectral resolution, so several things can share one wavelength. Each
// finding lists what else could explain it. docs/methods.md describes the method.
// Written with Claude Code (Anthropic) assistance.
import { LINE_FAMILIES, type LineFamily } from "./lines";
import { currentSpectrum } from "./measure";
import { binSpectrum, type SpectrumBin } from "./spectrum";
import type { AppState } from "./store";

/** One feature that stands out in a spectrum. */
export interface FeatureFinding {
  /** Id and plain name of the family, for example "water" and "Water". */
  familyId: string;
  family: string;
  /** The feature's own label, for example "H₂O ice". */
  label: string;
  /** Rest wavelength, and where it falls after the redshift, in microns. */
  rest: number;
  observed: number;
  /** "dip" when the spectrum is fainter there than on either side, "bump" when brighter. */
  kind: "dip" | "bump";
  /**
   * Size of the dip or bump as a fraction of the brightness on either side. 0.3 is 30 percent.
   * Null when there is almost no light on either side, as with a glowing gas cloud.
   */
  strength: number | null;
  /** How many times its uncertainty the dip or bump is. */
  significance: number;
  /** Names of other families with a feature at the same place. Any of them could be the cause. */
  also: string[];
  /**
   * The visit in which the feature shows, for example "Dec 2025", or null when it shows in
   * all visits taken together. A comet or a variable star can show a feature in one visit only.
   */
  visit: string | null;
}

/** The result of checking a spectrum against the feature library. */
export interface FeatureReport {
  /** Features that stand out, most certain first. */
  findings: FeatureFinding[];
  /** Library features that fell on measured wavelengths and were checked. */
  checked: number;
  /** Plain words when the spectrum can't be checked. */
  note: string | null;
}

/**
 * A feature counts at this many times its uncertainty, and at this fraction of the brightness
 * beside it. A narrow line fills one channel, where the natural peak of a star's spectrum can
 * also stand a few percent above its neighbors, so a line must be stronger than a wide band.
 */
const MIN_SIGMA = 5;
const MIN_BAND_STRENGTH = 0.05;
const MIN_LINE_STRENGTH = 0.1;
/**
 * In the spectrum of one visit of a changing source, each channel was seen on a different day.
 * The source's own changes then show as steps between channels, so a feature must be this strong.
 */
const MIN_VISIT_STRENGTH = 0.3;
/** Channel-to-channel ripple of the instrument's calibration, as a fraction. Nothing smaller can be trusted. */
const RIPPLE = 0.01;
/** A narrow line is looked for within this many channel steps of its place. */
const LINE_REACH = 0.75;
/** The comparison region on each side is at least this many channel steps wide, and needs this many points. */
const SIDE_STEPS = 3;
const MIN_SIDE_POINTS = 2;
/** The spectrum needs this many measured channels to be worth checking. */
const MIN_CHANNELS = 12;
/**
 * At least this share of the measurements must be trusted. A source too bright for the
 * detector loses its brightest channels first, which carves false dips into what is left.
 */
const MIN_TRUSTED = 0.6;
/**
 * A spectrum with this many wide dips at least this deep is shaped by molecular bands, as cool
 * stars and brown dwarfs are. The peaks left between the bands look like bright lines and the
 * band edges like dark ones, so narrow lines are not judged in such a spectrum.
 */
const BANDED_COUNT = 2;
const BANDED_DEPTH = 0.2;
/**
 * A feature must also stand out from the wider spectrum around it: a trend line through every
 * point within this reach in log wavelength (about 22 percent either way). It must differ from
 * that line the same way, by at least this share of what the close comparison found.
 * This tells a real dip from the plain gap between two bright bands, and a real bump from the
 * plain spectrum beside a dark band. Close up, those look the same.
 */
const WIDE_REACH = 0.2;
const WIDE_SHARE = 0.5;
const WIDE_MIN_POINTS = 6;
/**
 * Visits whose brightness differs by this factor are judged one by one, not together. The
 * brightness of a visit is read from channels measured at least this well, and a visit's own
 * spectrum is judged only when its typical channel is measured at least this well.
 */
const UNSTEADY = 1.5;
const LEVEL_SNR = 10;
const VISIT_SNR = 5;
/** Where features overlap, the widest one at least this share as certain as the best gives the finding its name. */
const HEADLINE_SHARE = 0.6;

/** A curve fitted through points: its value and the variance of that value at any x. */
interface Fit {
  at: (x: number) => number;
  variance: (x: number) => number;
}

/**
 * Weighted least-squares polynomial through points, of degree 1 or 2. x is centered first so
 * the sums stay well behaved. Returns null when the points can't pin the curve down.
 */
export function fitCurve(xs: number[], ys: number[], weights: number[], degree: 1 | 2): Fit | null {
  const terms = degree + 1;
  if (xs.length < terms) return null;
  let sw = 0, sx = 0;
  for (let i = 0; i < xs.length; i++) {
    sw += weights[i];
    sx += weights[i] * xs[i];
  }
  const center = sx / sw;
  // Normal equations A c = b for the powers of (x - center).
  const a = Array.from({ length: terms }, () => new Array<number>(terms).fill(0));
  const b = new Array<number>(terms).fill(0);
  for (let i = 0; i < xs.length; i++) {
    const powers = [1, xs[i] - center, (xs[i] - center) ** 2];
    for (let r = 0; r < terms; r++) {
      b[r] += weights[i] * powers[r] * ys[i];
      for (let c = 0; c < terms; c++) a[r][c] += weights[i] * powers[r] * powers[c];
    }
  }
  // Invert A by Gauss-Jordan. It is 2 by 2 or 3 by 3.
  const inverse = a.map((row, r) => [...row, ...row.map((_, c) => (r === c ? 1 : 0))]);
  for (let col = 0; col < terms; col++) {
    let pivot = col;
    for (let r = col + 1; r < terms; r++) if (Math.abs(inverse[r][col]) > Math.abs(inverse[pivot][col])) pivot = r;
    if (Math.abs(inverse[pivot][col]) < 1e-300) return null;
    [inverse[col], inverse[pivot]] = [inverse[pivot], inverse[col]];
    const scale = inverse[col][col];
    for (let c = 0; c < 2 * terms; c++) inverse[col][c] /= scale;
    for (let r = 0; r < terms; r++) {
      if (r === col) continue;
      const factor = inverse[r][col];
      for (let c = 0; c < 2 * terms; c++) inverse[r][c] -= factor * inverse[col][c];
    }
  }
  const cov = inverse.map((row) => row.slice(terms));
  const coefficients = cov.map((row) => row.reduce((total, value, c) => total + value * b[c], 0));
  const powersOf = (x: number) => [1, x - center, (x - center) ** 2].slice(0, terms);
  return {
    at: (x) => powersOf(x).reduce((total, power, k) => total + power * coefficients[k], 0),
    variance: (x) => {
      const powers = powersOf(x);
      let total = 0;
      for (let r = 0; r < terms; r++) for (let c = 0; c < terms; c++) total += powers[r] * cov[r][c] * powers[c];
      return Math.max(0, total);
    },
  };
}

/** Middle value of a list. Reorders the list. */
function middle(values: number[]): number {
  values.sort((a, b) => a - b);
  return values.length ? values[values.length >> 1] : 0;
}

/**
 * A straight line through points that ignores outliers. For each point it takes the middle
 * slope to every other point, then the middle of those, then the middle offset (the repeated
 * median of Siegel 1982). Almost half the points can sit on features without bending the line.
 */
export function robustLine(xs: number[], ys: number[]): (x: number) => number {
  const perPoint: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const slopes: number[] = [];
    for (let j = 0; j < xs.length; j++) if (j !== i && xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    if (slopes.length) perPoint.push(middle(slopes));
  }
  const slope = middle(perPoint);
  const offset = middle(ys.map((y, i) => y - slope * xs[i]));
  return (x) => offset + slope * x;
}

/** Typical gap between measured channels near a wavelength. */
function stepNear(bins: SpectrumBin[], wavelength: number): number {
  let nearest = 0;
  for (let i = 1; i < bins.length; i++) if (Math.abs(bins[i].wavelength - wavelength) < Math.abs(bins[nearest].wavelength - wavelength)) nearest = i;
  const gaps: number[] = [];
  for (let i = Math.max(1, nearest - 2); i <= Math.min(bins.length - 1, nearest + 2); i++) gaps.push(bins[i].wavelength - bins[i - 1].wavelength);
  gaps.sort((a, b) => a - b);
  return gaps.length ? gaps[gaps.length >> 1] : NaN;
}

/**
 * Check a spectrum for every feature of the given families. bins must be sorted by wavelength,
 * one per channel. redshift stretches the rest wavelengths, for galaxies.
 * With paired = true a narrow line counts only where two or more images were averaged, since
 * one image alone can hold a stray bright pixel. Use it for the spectrum of a single visit.
 * With coarse = true only bands at least two channels wide are judged. Use it for a rough
 * spectrum, such as one measured from a star's halo.
 */
export function findFeatures(bins: SpectrumBin[], redshift = 0, families: LineFamily[] = LINE_FAMILIES, paired = false, coarse = false): FeatureReport {
  const usable = bins.filter((bin) => Number.isFinite(bin.flux) && bin.err > 0).sort((a, b) => a.wavelength - b.wavelength);
  if (usable.length < MIN_CHANNELS) return { findings: [], checked: 0, note: "Too few wavelengths are measured here to look for features." };
  const stretch = 1 + redshift;

  // Where each library feature falls, and the span it covers.
  const spans = families.flatMap((family) =>
    family.features.map((feature) => {
      const observed = feature.wavelength * stretch;
      const step = stepNear(usable, observed);
      return { family, feature, observed, step, half: Math.max(((feature.width ?? 0) * stretch) / 2, LINE_REACH * step) };
    }),
  );

  type Span = (typeof spans)[number];
  let checked = 0;
  /** A feature that stands out from the spectrum right beside it, with what is needed to check it further. */
  interface Candidate {
    span: Span;
    finding: FeatureFinding;
    /** How far it sits from the close comparison, and the points it was measured on. */
    gap: number;
    judged: SpectrumBin[];
  }
  /** Measure one feature against the spectrum right beside it. Returns null when it does not stand out or can't be judged. */
  const measure = (span: Span): Candidate | null => {
    const { observed, step, half } = span;
    if (!(step > 0)) return null;
    if (coarse && (span.feature.width ?? 0) * stretch < 2 * step) return null;
    const guard = half + 0.5 * step;
    const reach = guard + Math.max(SIDE_STEPS * step, half);
    const inside = usable.filter((bin) => Math.abs(bin.wavelength - observed) <= half);
    const left = usable.filter((bin) => bin.wavelength < observed - guard && bin.wavelength >= observed - reach);
    const right = usable.filter((bin) => bin.wavelength > observed + guard && bin.wavelength <= observed + reach);
    if (!inside.length || left.length < MIN_SIDE_POINTS || right.length < MIN_SIDE_POINTS) return null;
    checked++;

    // The spectrum's level at the feature, read from the points on either side. Where there
    // is light on both sides the fit is done on logarithms, where a smooth spectrum (a power
    // law, or the gentle arc of a star's peak) is close to a straight line. A narrow line is
    // judged against a curve that can bend, so the peak of a star's spectrum is not mistaken
    // for a bright line. With no light beside it, a plain straight line is used.
    const sides = [...left, ...right];
    const narrow = span.feature.width === undefined;
    const bright = sides.every((bin) => bin.flux > 3 * bin.err);
    const degree = narrow && left.length >= 3 && right.length >= 3 ? 2 : 1;
    const fit = bright
      ? fitCurve(sides.map((bin) => Math.log(bin.wavelength)), sides.map((bin) => Math.log(bin.flux)), sides.map((bin) => (bin.flux / bin.err) ** 2), degree)
      : fitCurve(sides.map((bin) => bin.wavelength), sides.map((bin) => bin.flux), sides.map((bin) => 1 / (bin.err * bin.err)), 1);
    if (!fit) return null;
    const line = (wavelength: number) => (bright ? Math.exp(fit.at(Math.log(wavelength))) : fit.at(wavelength));
    const level = line(observed);
    const levelVar = bright ? level * level * fit.variance(Math.log(observed)) : fit.variance(observed);

    // How far the spectrum at the feature sits from that curve. A band is judged by the
    // average over its width. A narrow line lands in one channel, so it is judged by the
    // channel that stands out most.
    let iw = 0, gap = 0;
    let judged = inside;
    if (narrow) {
      const peak = inside.reduce((best, bin) => (Math.abs(bin.flux - line(bin.wavelength)) > Math.abs(best.flux - line(best.wavelength)) ? bin : best));
      if (paired && peak.count < 2) return null;
      gap = peak.flux - line(peak.wavelength);
      iw = 1 / (peak.err * peak.err);
      judged = [peak];
      // A real line stands clear of the channels right beside it, on both sides. The shoulder
      // of a deep band, or the slope of the spectrum, stands clear of one side only.
      const first = usable.indexOf(inside[0]);
      const last = usable.indexOf(inside[inside.length - 1]);
      const before = usable[first - 1];
      const after = usable[last + 1];
      if (!before || !after) return null;
      const margin = 0.5 * MIN_LINE_STRENGTH * Math.abs(line(peak.wavelength));
      const standsOut = gap > 0 ? peak.flux - Math.max(before.flux, after.flux) : Math.min(before.flux, after.flux) - peak.flux;
      if (standsOut < margin) return null;
    } else {
      for (const bin of inside) {
        const w = 1 / (bin.err * bin.err);
        iw += w;
        gap += w * (bin.flux - line(bin.wavelength));
      }
      gap /= iw;
    }
    // The ripple is a fraction of the light present, at the feature or beside it, whichever is more.
    const present = Math.max(Math.abs(level), Math.abs(level + gap));
    const err = Math.sqrt(1 / iw + levelVar + (RIPPLE * present) ** 2);
    const significance = Math.abs(gap) / err;
    const lit = level > 3 * Math.sqrt(levelVar);
    const strength = lit ? gap / level : null;
    const least = paired ? MIN_VISIT_STRENGTH : narrow ? MIN_LINE_STRENGTH : MIN_BAND_STRENGTH;
    if (significance < MIN_SIGMA || (strength !== null && Math.abs(strength) < least)) return null;
    // A dip needs light to dip from.
    if (gap < 0 && !lit) return null;
    // A wide band shows as a bump only for the few that glow, such as a comet's gases.
    if (gap > 0 && !narrow && !span.feature.emits) return null;

    const also = [...new Set(spans
      .filter((other) => other.family.id !== span.family.id && Math.abs(other.observed - observed) <= other.half + half)
      .map((other) => other.family.name))];
    const finding: FeatureFinding = {
      familyId: span.family.id,
      family: span.family.name,
      label: span.feature.label,
      rest: span.feature.wavelength,
      observed,
      kind: gap < 0 ? "dip" : "bump",
      strength: strength === null ? null : Math.abs(strength),
      significance,
      also,
      visit: null,
    };
    return { span, finding, gap, judged };
  };

  const candidates = spans.flatMap((span) => {
    const candidate = measure(span);
    return candidate ? [candidate] : [];
  });
  // Each candidate must also stand out from the wider spectrum: a trend line through the
  // points around it, leaving out its own span and the spans of the other candidates.
  const confirmed = candidates.filter((candidate) => {
    const { span, gap, judged } = candidate;
    const taken = candidates.filter((other) => other !== candidate).map((other) => [other.span.observed - other.span.half, other.span.observed + other.span.half]);
    const context = usable.filter((bin) =>
      Math.abs(Math.log(bin.wavelength / span.observed)) <= WIDE_REACH &&
      Math.abs(bin.wavelength - span.observed) > span.half &&
      !taken.some(([low, high]) => bin.wavelength >= low && bin.wavelength <= high));
    // With too little plain spectrum around it, the close comparison stands.
    if (context.length < WIDE_MIN_POINTS) return true;
    const logs = context.every((bin) => bin.flux > 0) && judged.every((bin) => bin.flux > 0);
    const trend = robustLine(context.map((bin) => Math.log(bin.wavelength)), context.map((bin) => (logs ? Math.log(bin.flux) : bin.flux)));
    const base = (wavelength: number) => (logs ? Math.exp(trend(Math.log(wavelength))) : trend(Math.log(wavelength)));
    let far = 0, weight = 0;
    for (const bin of judged) {
      const w = 1 / (bin.err * bin.err);
      far += w * (bin.flux - base(bin.wavelength));
      weight += w;
    }
    far /= weight;
    return Math.sign(far) === Math.sign(gap) && Math.abs(far) >= WIDE_SHARE * Math.abs(gap);
  });
  // A dip with a confirmed bump on each side is the plain spectrum between two bright bands,
  // whose wings reach further than the library says. The same goes for a bump between two dips.
  const findings = confirmed
    .filter((candidate) => {
      const { observed, half } = candidate.span;
      const beside = (low: number, high: number) =>
        confirmed.some((other) => other.finding.kind !== candidate.finding.kind && other.span.observed + other.span.half >= low && other.span.observed - other.span.half <= high);
      // "Beside" reaches as far as the wider comparison does.
      return !(beside(observed * Math.exp(-WIDE_REACH), observed - half) && beside(observed + half, observed * Math.exp(WIDE_REACH)));
    })
    .map((candidate) => candidate.finding);

  const spanOf = (finding: FeatureFinding) => spans.find((entry) => entry.family.id === finding.familyId && entry.feature.wavelength === finding.rest)!;
  const narrowOne = (finding: FeatureFinding) => spanOf(finding).feature.width === undefined;
  // In a spectrum shaped by wide molecular bands, narrow lines can't be told from band edges.
  const deep = findings.filter((finding) => !narrowOne(finding) && finding.kind === "dip" && (finding.strength ?? 0) >= BANDED_DEPTH);
  const judged = deep.length >= BANDED_COUNT ? findings.filter((finding) => !narrowOne(finding)) : findings;

  // Overlapping findings of the same kind are one dip or bump, however many library features
  // sit on it. Gather them, most certain first.
  judged.sort((a, b) => b.significance - a.significance);
  const groups: FeatureFinding[][] = [];
  for (const finding of judged) {
    const span = spanOf(finding);
    const group = groups.find((members) => members[0].kind === finding.kind && Math.abs(spanOf(members[0]).observed - span.observed) <= spanOf(members[0]).half + span.half);
    if (group) group.push(finding);
    else groups.push([finding]);
  }
  // Name each by its widest feature that is nearly as certain as the best. A wide band that
  // fits explains the whole dip. A narrow feature inside it explains only its middle.
  const kept = groups.map((members) => {
    const contenders = members.filter((member) => member.significance >= HEADLINE_SHARE * members[0].significance);
    const head = contenders.reduce((widest, member) => (spanOf(member).half > spanOf(widest).half ? member : widest));
    const others = members.flatMap((member) => [member.family, ...member.also]);
    return { ...head, also: [...new Set([...head.also, ...others])].filter((name) => name !== head.family) };
  });
  kept.sort((a, b) => b.significance - a.significance);
  return { findings: kept, checked, note: null };
}

/**
 * Check a source's spectrum for features, choosing how to combine its visits.
 * A steady source is judged on all visits together, which gives the cleanest spectrum.
 * A source whose brightness changed a lot between visits (a comet, a flaring star) is judged
 * visit by visit, because the average of very different spectra means nothing. Each finding
 * then names the visit it shows in most clearly.
 * visits maps a visit number to its name.
 */
export function findFeaturesByVisit(all: SpectrumBin[], perVisit: SpectrumBin[], redshift: number, visits: Map<number, string>, coarse = false): FeatureReport {
  const seasons = [...new Set(perVisit.map((bin) => bin.season))]
    .map((season) => ({ season, bins: perVisit.filter((bin) => bin.season === season) }))
    .filter((entry) => entry.bins.length >= MIN_CHANNELS);
  // How bright each visit was against the spectrum of all visits, over the channels both have.
  // Channel by channel, because visits do not all cover the same wavelengths.
  const reference = new Map(all.filter((bin) => bin.flux > 0).map((bin) => [bin.channel, bin.flux]));
  const levels = seasons.flatMap((entry) => {
    const ratios = entry.bins.filter((bin) => bin.flux > LEVEL_SNR * bin.err && reference.has(bin.channel)).map((bin) => bin.flux / reference.get(bin.channel)!);
    return ratios.length >= MIN_CHANNELS ? [middle(ratios)] : [];
  });
  const unsteady = levels.length > 1 && Math.max(...levels) >= UNSTEADY * Math.min(...levels);
  if (!unsteady) return findFeatures(all, redshift, LINE_FAMILIES, false, coarse);

  const merged = new Map<string, FeatureFinding>();
  let checked = 0;
  for (const { season, bins } of seasons) {
    // A visit in which the source is barely detected has nothing to say.
    if (middle(bins.map((bin) => bin.flux / bin.err)) < VISIT_SNR) continue;
    const report = findFeatures(bins, redshift, LINE_FAMILIES, true, coarse);
    checked = Math.max(checked, report.checked);
    for (const finding of report.findings) {
      const key = `${finding.familyId}:${finding.rest}:${finding.kind}`;
      const known = merged.get(key);
      if (!known || finding.significance > known.significance) merged.set(key, { ...finding, visit: visits.get(season) ?? `visit ${season + 1}` });
    }
  }
  return { findings: [...merged.values()].sort((a, b) => b.significance - a.significance), checked, note: null };
}

let cache: { points: unknown; redshift: number; report: FeatureReport } | null = null;


/** The features that stand out in the spectrum now on screen. Recomputed only when the spectrum or redshift changes. */
export function spectrumFeatures(state: AppState): FeatureReport {
  const points = currentSpectrum(state);
  const redshift = state.spectrum.redshift;
  if (cache && cache.points === points && cache.redshift === redshift) return cache.report;
  const trusted = points.filter((point) => point.good).length;
  if (points.length && trusted < MIN_TRUSTED * points.length) {
    const report: FeatureReport = { findings: [], checked: 0, note: "This source is too bright for the detector in many images, so its spectrum has gaps. Features can't be judged here." };
    cache = { points, redshift, report };
    return report;
  }
  const names = new Map(state.visits.map((visit) => [visit.season, visit.label]));
  // A halo spectrum is rougher than a direct one, so only its wide bands are judged.
  const report = findFeaturesByVisit(binSpectrum(points, false), binSpectrum(points, true), redshift, names, state.spectrum.halo);
  cache = { points, redshift, report };
  return report;
}

/** One plain sentence for a finding, for example "Water (H₂O ice): a dip of 34 percent at 3.05 microns." */
export function describeFeature(finding: FeatureFinding): string {
  let size = "";
  if (finding.strength === null) size = ", with almost no light on either side";
  else if (finding.kind === "bump" && finding.strength >= 3) size = `, ${Math.round(finding.strength + 1)} times as bright as the light on either side`;
  else size = ` of ${finding.strength >= 0.1 ? (finding.strength * 100).toFixed(0) : (finding.strength * 100).toFixed(1)} percent`;
  // "a dip of 34 percent at 3.05 microns" reads better than "a dip at 3.05 microns of 34 percent".
  const where = `at ${finding.observed.toFixed(2)} microns`;
  const body = size.startsWith(",") ? `a ${finding.kind} ${where}${size}` : `a ${finding.kind}${size} ${where}`;
  const when = finding.visit ? `, in ${finding.visit}` : "";
  const text = `${finding.family} (${finding.label}): ${body}${when}.`;
  return finding.also.length ? `${text} Could also be ${finding.also.join(" or ").toLowerCase()}.` : text;
}
