// Sky math: coordinate parsing and formatting, time conversion, motion, and visit grouping.
// Written with Claude Code (Anthropic) assistance.
import type { SkyPosition, Target } from "./types";

const DEG = Math.PI / 180;
const MAS_PER_DEG = 3.6e6;

/** Modified Julian Date to a JavaScript Date (UTC). */
export function mjdToDate(mjd: number): Date {
  return new Date((mjd - 40587) * 86400000);
}

/** Modified Julian Date to a Julian year, for example 2026.37. */
export function mjdToYear(mjd: number): number {
  return 2000 + (mjd - 51544.5) / 365.25;
}

/** "2025 Nov 3" style date for labels. */
export function formatDate(mjd: number): string {
  return mjdToDate(mjd).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Nov 2025" style month for visit labels. */
export function formatMonth(mjd: number): string {
  return mjdToDate(mjd).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
}

function sexagesimal(value: number, places: number): [string, string, string] {
  const total = Math.round(Math.abs(value) * 3600 * 10 ** places) / 10 ** places;
  const first = Math.floor(total / 3600);
  const second = Math.floor((total - first * 3600) / 60);
  const third = total - first * 3600 - second * 60;
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return [pad(first, 2), pad(second, 2), third.toFixed(places).padStart(places ? places + 3 : 2, "0")];
}

/** Right ascension in degrees to "08h55m02.34s". */
export function formatRa(deg: number): string {
  const [h, m, s] = sexagesimal((((deg % 360) + 360) % 360) / 15, 2);
  return `${h}h${m}m${s}s`;
}

/** Declination in degrees to "-07d14m31.9s". */
export function formatDec(deg: number): string {
  const [d, m, s] = sexagesimal(deg, 1);
  return `${deg < 0 ? "-" : "+"}${d}d${m}m${s}s`;
}

/**
 * The angle between two sky positions in arcseconds, and the direction from the first to the
 * second in degrees, counted from north through east. Exact at any separation.
 */
export function separation(from: SkyPosition, to: SkyPosition): { arcsec: number; angle: number } {
  const d1 = from.dec * DEG;
  const d2 = to.dec * DEG;
  const dra = (to.ra - from.ra) * DEG;
  const east = Math.cos(d2) * Math.sin(dra);
  const north = Math.cos(d1) * Math.sin(d2) - Math.sin(d1) * Math.cos(d2) * Math.cos(dra);
  const along = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(dra);
  return {
    arcsec: (Math.atan2(Math.hypot(east, north), along) / DEG) * 3600,
    angle: ((Math.atan2(east, north) / DEG) + 360) % 360,
  };
}

/** Points along the shortest path on the sky between two positions, ends included, for drawing a line. */
export function skyPath(from: SkyPosition, to: SkyPosition, steps = 48): SkyPosition[] {
  const unit = (p: SkyPosition) => [Math.cos(p.dec * DEG) * Math.cos(p.ra * DEG), Math.cos(p.dec * DEG) * Math.sin(p.ra * DEG), Math.sin(p.dec * DEG)];
  const a = unit(from);
  const b = unit(to);
  const angle = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  // The same point within rounding, or opposite points with no single shortest path: nothing to curve.
  if (Math.sin(angle) < 1e-6) return [from, to];
  const path: SkyPosition[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wa = Math.sin((1 - t) * angle) / Math.sin(angle);
    const wb = Math.sin(t * angle) / Math.sin(angle);
    const [x, y, z] = [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]];
    path.push({ ra: ((Math.atan2(y, x) / DEG) + 360) % 360, dec: Math.asin(Math.min(1, Math.max(-1, z))) / DEG });
  }
  return path;
}

/** An angle on the sky in the unit that reads best: arcseconds, arcminutes, or degrees. */
export function formatAngle(arcsec: number): string {
  const size = Math.abs(arcsec);
  if (size < 60) return `${size.toFixed(1)} arcsec`;
  if (size < 3600) return `${(size / 60).toFixed(2)} arcmin`;
  return `${(size / 3600).toFixed(3)} degrees`;
}

/**
 * Read coordinates typed by a person. Returns null when the text is not coordinates,
 * so the caller can treat it as an object name instead.
 *
 * Coordinates are J2000 equatorial (ICRS), the system used by NASA's challenge and by catalogs.
 * Accepted forms:
 * - decimal degrees: "133.76 -7.24", "133.76d -7.24d", "ra=133.76 dec=-7.24"
 * - hours, minutes, seconds: "08h55m10.8s -07d14m42s", "08:55:10.8 -07:14:42", "08 55 10.8 -07 14 42"
 * - hours and decimal minutes: "08 55.18 -07 14.7"
 * - decimal hours: "8.9197h -7.245d"
 * - labels and notes around them: "RA 08h55m10.831s, Dec -7d14m42.53s (J2000)"
 * - catalog names with built-in coordinates: "WISE J085510.83-071442.5"
 * - galactic coordinates when marked: "gal 359.94 -0.05" or "l=359.94 b=-0.05"
 */
export function parseCoordinates(text: string): SkyPosition | null {
  let clean = text
    .trim()
    // Typed minus signs come in several shapes. Make them all a plain hyphen.
    .replace(/[\u2212\u2013\u2014\u2010\u2011]/g, "-")
    .replace(/[,;]/g, " ")
    .replace(/\s+/g, " ");
  if (!clean) return null;

  // Catalog designation, for example "WISE J085510.83-071442.5".
  const designation = clean.match(/J(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([+-])(\d{2})(\d{2})(\d{2}(?:\.\d+)?)$/i);
  if (designation) {
    const [, h, m, s, sign, d, dm, ds] = designation;
    const ra = (Number(h) + Number(m) / 60 + Number(s) / 3600) * 15;
    const dec = (Number(d) + Number(dm) / 60 + Number(ds) / 3600) * (sign === "-" ? -1 : 1);
    return valid(ra, dec);
  }

  // Galactic longitude and latitude, only when marked as such.
  const galactic = clean.match(/^(?:gal(?:actic)?\s+|l\s*=\s*)([+-]?\d+(?:\.\d+)?)\s*(?:b\s*=\s*)?([+-]?\d+(?:\.\d+)?)$/i);
  if (galactic) {
    const l = Number(galactic[1]);
    const b = Number(galactic[2]);
    return l >= 0 && l <= 360 && Math.abs(b) <= 90 ? galacticToEquatorial(l, b) : null;
  }

  // Drop notes about the system, and the labels in front of each number.
  clean = clean
    .replace(/\(?\b(?:J2000(?:\.0)?|ICRS|FK5|equatorial|equinox|epoch)\b\)?/gi, " ")
    .replace(/(?:^|\s)(?:r\.?a\.?|right ascension|dec(?:l(?:ination)?)?\.?|\u03b1|\u03b4)\s*[:=]?\s*(?=[+-]?\d)/gi, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Two decimal numbers. Degrees, unless the first is marked as hours.
  const pair = clean.match(/^([+-]?\d+(?:\.\d+)?)\s*(h|hr|hours?|d|deg|\u00b0)?\s+([+-]?\d+(?:\.\d+)?)\s*(?:d|deg|\u00b0)?$/i);
  if (pair) {
    const hours = /^h/i.test(pair[2] ?? "");
    return valid(Number(pair[1]) * (hours ? 15 : 1), Number(pair[3]));
  }

  // Sexagesimal. Split into numbers, keeping the sign of the declination.
  const parts = clean.replace(/[hdms\u00b0'"\u2032\u2033:]/gi, " ").trim().split(/\s+/);
  if (!parts.every((p) => /^[+-]?\d+(\.\d+)?$/.test(p))) return null;
  const n = parts.map(Number);
  if (parts.length === 6) {
    const ra = (Math.abs(n[0]) + n[1] / 60 + n[2] / 3600) * 15;
    const dec = (Math.abs(n[3]) + n[4] / 60 + n[5] / 3600) * (parts[3].startsWith("-") ? -1 : 1);
    return n[1] < 60 && n[2] < 60 && n[4] < 60 && n[5] < 60 ? valid(ra, dec) : null;
  }
  if (parts.length === 4) {
    // Hours and decimal minutes, degrees and decimal minutes.
    const ra = (Math.abs(n[0]) + n[1] / 60) * 15;
    const dec = (Math.abs(n[2]) + n[3] / 60) * (parts[2].startsWith("-") ? -1 : 1);
    return n[1] < 60 && n[3] < 60 ? valid(ra, dec) : null;
  }
  return null;
}

function valid(ra: number, dec: number): SkyPosition | null {
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || Math.abs(dec) > 90 || ra < 0 || ra > 360) return null;
  return { ra: ra === 360 ? 0 : ra, dec };
}

/** Galactic longitude and latitude in degrees to J2000 equatorial (IAU 1958 system, Hipparcos constants). */
export function galacticToEquatorial(l: number, b: number): SkyPosition {
  // Rows of the rotation from equatorial to galactic. Its transpose goes the other way.
  const R = [
    [-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
    [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
    [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
  ];
  const g = [Math.cos(b * DEG) * Math.cos(l * DEG), Math.cos(b * DEG) * Math.sin(l * DEG), Math.sin(b * DEG)];
  const x = R[0][0] * g[0] + R[1][0] * g[1] + R[2][0] * g[2];
  const y = R[0][1] * g[0] + R[1][1] * g[1] + R[2][1] * g[2];
  const z = R[0][2] * g[0] + R[1][2] * g[1] + R[2][2] * g[2];
  const ra = (Math.atan2(y, x) / DEG + 360) % 360;
  return { ra, dec: Math.asin(Math.max(-1, Math.min(1, z))) / DEG };
}

/**
 * Where a target is at a given time, from proper motion and parallax.
 * parallaxFactor is the sky shift in arcseconds per arcsecond of parallax (from the search result).
 * Linear motion is exact enough over the few years of SPHEREx data.
 */
export function positionAt(target: Target, mjd: number, parallaxFactor: [number, number] = [0, 0]): SkyPosition {
  const years = mjdToYear(mjd) - target.epoch;
  const east = (target.pmRa ?? 0) * years + (target.parallax ?? 0) * parallaxFactor[0];
  const north = (target.pmDec ?? 0) * years + (target.parallax ?? 0) * parallaxFactor[1];
  return {
    ra: target.ra + east / MAS_PER_DEG / Math.cos(target.dec * DEG),
    dec: target.dec + north / MAS_PER_DEG,
  };
}

/** Tangent-plane offset of a position from a center, in arcseconds [east, north]. */
export function skyOffset(position: SkyPosition, center: SkyPosition): [number, number] {
  const ra = position.ra * DEG;
  const dec = position.dec * DEG;
  const ra0 = center.ra * DEG;
  const dec0 = center.dec * DEG;
  const cosc = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(ra - ra0);
  const xi = (Math.cos(dec) * Math.sin(ra - ra0)) / cosc;
  const eta = (Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(ra - ra0)) / cosc;
  return [(xi / DEG) * 3600, (eta / DEG) * 3600];
}

/** Inverse of skyOffset: the position at an offset [east, north] in arcseconds from a center. */
export function offsetToSky(east: number, north: number, center: SkyPosition): SkyPosition {
  const xi = (east / 3600) * DEG;
  const eta = (north / 3600) * DEG;
  const ra0 = center.ra * DEG;
  const dec0 = center.dec * DEG;
  const denom = Math.cos(dec0) - eta * Math.sin(dec0);
  const ra = ra0 + Math.atan2(xi, denom);
  const dec = Math.atan2(Math.sin(dec0) + eta * Math.cos(dec0), Math.hypot(xi, denom));
  return { ra: (((ra / DEG) % 360) + 360) % 360, dec: dec / DEG };
}

/**
 * Number the visits. SPHEREx returns to a field about every six months and stays about two weeks,
 * so a gap longer than gapDays starts a new visit. Input must be sorted by time.
 */
export function assignSeasons(mjds: number[], gapDays = 45): number[] {
  const seasons: number[] = [];
  let season = 0;
  let start = 0;
  for (let i = 0; i < mjds.length; i++) {
    if (i > 0 && mjds[i] - mjds[i - 1] > gapDays) {
      season++;
      start = i;
    } else if (i > 0 && mjds[i] - mjds[start] > LONG_WATCH_DAYS && monthOf(mjds[i]) !== monthOf(mjds[i - 1])) {
      // Fields near the ecliptic poles are watched almost without a break.
      // Cut such a long watch at each new calendar month so change over time stays visible.
      season++;
    }
    seasons.push(season);
  }
  return seasons;
}

/** A stretch of observing longer than this many days is cut into calendar months. */
const LONG_WATCH_DAYS = 60;

function monthOf(mjd: number): number {
  const date = mjdToDate(mjd);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/** Summarize the visits of a time-sorted list of exposures that already carry visit numbers. */
export function summarizeVisits(mjds: number[], seasons: number[]): { season: number; start: number; end: number; label: string; count: number }[] {
  const visits: { season: number; start: number; end: number; label: string; count: number }[] = [];
  mjds.forEach((mjd, i) => {
    const visit = visits[seasons[i]];
    if (!visit) visits[seasons[i]] = { season: seasons[i], start: mjd, end: mjd, label: "", count: 1 };
    else {
      visit.end = Math.max(visit.end, mjd);
      visit.count++;
    }
  });
  // Name each visit by the month at its middle. Add the day when two visits share a month.
  for (const visit of visits) visit.label = formatMonth((visit.start + visit.end) / 2);
  for (const visit of visits) {
    if (visits.filter((other) => other.label === visit.label).length > 1) visit.label = formatDate(visit.start);
  }
  return visits;
}

const LIGHT_YEARS_PER_PARSEC = 3.26156;
const KM_PER_AU = 149597870.7;

function grouped(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** A count of light-years in words a person can picture: "5.96", "25,400", "2.48 million", "2.2 billion". */
function lightYears(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toPrecision(3)} billion`;
  if (value >= 1e6) return `${(value / 1e6).toPrecision(3)} million`;
  if (value >= 1000) return grouped(Number(value.toPrecision(3)));
  return value.toPrecision(3);
}

/** A distance in plain words, for example "5.96 light-years" or "2.48 million light-years". */
export function formatDistance(distance: { parsecs: number; method: string; lightTravelYears?: number }): string {
  const text = `${lightYears(distance.parsecs * LIGHT_YEARS_PER_PARSEC)} light-years`;
  if (distance.method === "redshift" && distance.lightTravelYears) {
    return `about ${text} (its light left ${lightYears(distance.lightTravelYears)} years ago)`;
  }
  return text;
}

/** How a distance was found, in a few words. */
export function distanceMethod(method: string): string {
  if (method === "parallax") return "from its parallax";
  if (method === "redshift") return "from its redshift";
  return "from published measurements";
}

/** A solar system distance: "2.61 au (390 million km)". One au is the distance from Earth to the Sun. */
export function formatAu(au: number): string {
  const km = au * KM_PER_AU;
  const kmText = km >= 1e9 ? `${(km / 1e9).toPrecision(3)} billion km` : km >= 1e6 ? `${Math.round(km / 1e6)} million km` : `${grouped(km)} km`;
  return `${au.toPrecision(3)} au (${kmText})`;
}
