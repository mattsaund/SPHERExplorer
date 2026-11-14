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
 * Read coordinates typed by a person. Returns null when the text is not coordinates.
 * Accepts decimal degrees ("133.76 -7.24"), sexagesimal with letters or colons
 * ("08h55m10.8s -07d14m42s", "08:55:10.8 -07:14:42"), six plain numbers, and
 * catalog-style names with embedded coordinates ("J085510.83-071442.5").
 */
export function parseCoordinates(text: string): SkyPosition | null {
  const clean = text.trim().replace(/[,;]/g, " ").replace(/\s+/g, " ");
  if (!clean) return null;

  // Catalog designation, for example "WISE J085510.83-071442.5".
  const designation = clean.match(/J(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([+-])(\d{2})(\d{2})(\d{2}(?:\.\d+)?)$/i);
  if (designation) {
    const [, h, m, s, sign, d, dm, ds] = designation;
    const ra = (Number(h) + Number(m) / 60 + Number(s) / 3600) * 15;
    const dec = (Number(d) + Number(dm) / 60 + Number(ds) / 3600) * (sign === "-" ? -1 : 1);
    return valid(ra, dec);
  }

  // Two decimal numbers are degrees.
  const pair = clean.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:d|deg|°)?\s+([+-]?\d+(?:\.\d+)?)\s*(?:d|deg|°)?$/i);
  if (pair) return valid(Number(pair[1]), Number(pair[2]));

  // Sexagesimal. Split into numbers, keeping the sign of the declination.
  const parts = clean.replace(/[hdms°'"′″:]/gi, " ").trim().split(/\s+/);
  if (parts.length === 6 && parts.every((p) => /^[+-]?\d+(\.\d+)?$/.test(p))) {
    const n = parts.map(Number);
    const ra = (Math.abs(n[0]) + n[1] / 60 + n[2] / 3600) * 15;
    const negative = parts[3].startsWith("-");
    const dec = (Math.abs(n[3]) + n[4] / 60 + n[5] / 3600) * (negative ? -1 : 1);
    return valid(ra, dec);
  }
  return null;
}

function valid(ra: number, dec: number): SkyPosition | null {
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || Math.abs(dec) > 90) return null;
  // Wrap only when needed, so in-range values keep their exact digits.
  return { ra: ra < 0 || ra >= 360 ? ((ra % 360) + 360) % 360 : ra, dec };
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
  for (let i = 0; i < mjds.length; i++) {
    if (i > 0 && mjds[i] - mjds[i - 1] > gapDays) season++;
    seasons.push(season);
  }
  return seasons;
}
