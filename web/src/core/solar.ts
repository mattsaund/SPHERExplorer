// Where the bodies of the solar system are in the sky at a given moment.
// Each body has an orbit around the Sun (from JPL Horizons, in solarBodies.ts). Kepler's
// equation moves it along that orbit to the moment asked for, the Earth is moved the same way,
// and the difference is where the body appears from here. The Sun is the Earth's own position
// turned around. The Moon uses a short series from the Astronomical Almanac instead, because
// the Sun pulls its orbit about too quickly for one fixed orbit to hold.
// Written with Claude Code (Anthropic) assistance.
import { EARTH_ORBIT, SOLAR_BODIES } from "./solarBodies";
import type { SkyPosition } from "./types";

/** An orbit around the Sun, in the plane of the ecliptic of J2000. */
export interface SolarOrbit {
  /** Eccentricity. Below 1 is a closed orbit. Above 1 the body is passing through once. */
  e: number;
  /** Closest distance to the Sun, in au. */
  q: number;
  /** Tilt, longitude of the ascending node, and argument of perihelion, in degrees. */
  i: number;
  node: number;
  peri: number;
  /** Time of closest approach to the Sun, as a Julian date. */
  tp: number;
  /** Mean motion in degrees per day. */
  n: number;
}

/** A body as the list in solarBodies.ts describes it. */
export interface SolarSource {
  id: string;
  name: string;
  /** "Planet", "Dwarf planet", "Asteroid", "Comet", and so on, in plain words. */
  kind: string;
  /** What to type in the Find box to study it in SPHEREx images. Null for the Sun and the Moon. */
  query: string | null;
  /** Page with everything known about it. */
  url: string;
  /** One sentence about it. */
  note: string;
  /** Missing for the Sun and the Moon, which are placed in other ways. */
  orbit?: SolarOrbit;
}

/** A body and where it is right now. */
export interface SolarBody extends SolarSource, SkyPosition {
  /** Distance from the Earth and from the Sun, in au. */
  earth: number;
  sun: number;
}

const DEG = Math.PI / 180;
/** Tilt of the Earth's axis at J2000, which turns the ecliptic into the equator. */
const TILT = 23.4392911 * DEG;
/** Days light takes to cross one au. */
const LIGHT_DAYS = 0.0057755183;
const AU_KM = 149597870.7;
const EARTH_RADIUS_KM = 6378.14;

type Vector = [number, number, number];

/** Solve Kepler's equation for a closed orbit: the angle E with E - e sin E = M. */
function eccentricAnomaly(mean: number, e: number): number {
  // Bring M into one turn around zero, where the solver settles fastest.
  const m = mean - 2 * Math.PI * Math.round(mean / (2 * Math.PI));
  let big = e < 0.8 ? m : Math.PI * Math.sign(m || 1);
  for (let round = 0; round < 60; round++) {
    const step = (big - e * Math.sin(big) - m) / (1 - e * Math.cos(big));
    big -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return big;
}

/** The same for an open orbit: the value H with e sinh H - H = M. */
function hyperbolicAnomaly(mean: number, e: number): number {
  let big = Math.asinh(mean / e);
  for (let round = 0; round < 60; round++) {
    const step = (e * Math.sinh(big) - big - mean) / (e * Math.cosh(big) - 1);
    big -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return big;
}

/** Position around the Sun at a Julian date, in au, in the ecliptic of J2000. */
export function heliocentric(orbit: SolarOrbit, jd: number): Vector {
  const { e, q } = orbit;
  const mean = orbit.n * DEG * (jd - orbit.tp);
  // In the plane of the orbit: x points at perihelion.
  let x: number;
  let y: number;
  if (e < 1) {
    const a = q / (1 - e);
    const big = eccentricAnomaly(mean, e);
    x = a * (Math.cos(big) - e);
    y = a * Math.sqrt(1 - e * e) * Math.sin(big);
  } else {
    const a = q / (e - 1);
    const big = hyperbolicAnomaly(mean, e);
    x = a * (e - Math.cosh(big));
    y = a * Math.sqrt(e * e - 1) * Math.sinh(big);
  }
  // Turn the orbit into place: by the argument of perihelion, the tilt, and the node.
  const [cw, sw] = [Math.cos(orbit.peri * DEG), Math.sin(orbit.peri * DEG)];
  const [ci, si] = [Math.cos(orbit.i * DEG), Math.sin(orbit.i * DEG)];
  const [cn, sn] = [Math.cos(orbit.node * DEG), Math.sin(orbit.node * DEG)];
  const px = x * cw - y * sw;
  const py = x * sw + y * cw;
  return [px * cn - py * ci * sn, px * sn + py * ci * cn, py * si];
}

/** A direction in the ecliptic of J2000 as RA and Dec, with its length. */
function toSky(v: Vector): SkyPosition & { distance: number } {
  const y = v[1] * Math.cos(TILT) - v[2] * Math.sin(TILT);
  const z = v[1] * Math.sin(TILT) + v[2] * Math.cos(TILT);
  const distance = Math.hypot(v[0], y, z);
  return { ra: ((Math.atan2(y, v[0]) / DEG) + 360) % 360, dec: Math.asin(z / distance) / DEG, distance };
}

/** A Date as a Julian date on the steady clock that orbits are counted in. */
export function julianDate(date: Date): number {
  // Atomic time runs 69.184 seconds ahead of the clock on the wall.
  return date.getTime() / 86400000 + 2440587.5 + 69.184 / 86400;
}

/**
 * The Moon seen from the center of the Earth. From the low-precision series of the
 * Astronomical Almanac: good to about 0.3 degrees, which is less than the Moon's own width.
 */
export function moonPlace(jd: number): SkyPosition & { distance: number } {
  const t = (jd - 2451545.0) / 36525;
  const sin = (degrees: number) => Math.sin(degrees * DEG);
  const cos = (degrees: number) => Math.cos(degrees * DEG);
  const longitude =
    218.32 + 481267.881 * t + 6.29 * sin(135.0 + 477198.87 * t) - 1.27 * sin(259.3 - 413335.36 * t) + 0.66 * sin(235.7 + 890534.22 * t) +
    0.21 * sin(269.9 + 954397.74 * t) - 0.19 * sin(357.5 + 35999.05 * t) - 0.11 * sin(186.5 + 966404.03 * t);
  const latitude = 5.13 * sin(93.3 + 483202.02 * t) + 0.28 * sin(228.2 + 960400.89 * t) - 0.28 * sin(318.3 + 6003.15 * t) - 0.17 * sin(217.6 - 407332.21 * t);
  const parallax = 0.9508 + 0.0518 * cos(135.0 + 477198.87 * t) + 0.0095 * cos(259.3 - 413335.36 * t) + 0.0078 * cos(235.7 + 890534.22 * t) + 0.0028 * cos(269.9 + 954397.74 * t);
  // The series counts longitude from where the equinox is on that date. Take off how far the
  // equinox has slid since J2000, so the Moon lands on the same grid as everything else.
  const fixed = (longitude - 1.396971 * t) * DEG;
  const distance = EARTH_RADIUS_KM / Math.sin(parallax * DEG) / AU_KM;
  const flat = Math.cos(latitude * DEG);
  return toSky([distance * flat * Math.cos(fixed), distance * flat * Math.sin(fixed), distance * Math.sin(latitude * DEG)]);
}

const SUN: SolarSource = { id: "sun", name: "The Sun", kind: "Star", query: null, url: "https://science.nasa.gov/sun/", note: "Our star. SPHEREx never points near it." };
const MOON: SolarSource = { id: "moon", name: "The Moon", kind: "Moon", query: null, url: "https://science.nasa.gov/moon/", note: "The Earth's own moon." };

/** Every body the map shows, with where it is at a moment, seen from the center of the Earth. */
export function solarPlaces(date: Date): SolarBody[] {
  const jd = julianDate(date);
  const earth = heliocentric(EARTH_ORBIT, jd);
  const out: SolarBody[] = [];
  const sun = toSky([-earth[0], -earth[1], -earth[2]]);
  out.push({ ...SUN, ra: sun.ra, dec: sun.dec, earth: sun.distance, sun: 0 });
  const moon = moonPlace(jd);
  out.push({ ...MOON, ra: moon.ra, dec: moon.dec, earth: moon.distance, sun: sun.distance });
  for (const body of SOLAR_BODIES) {
    if (!body.orbit) continue;
    // Light takes time to arrive, so the body is seen where it was when the light left.
    // One pass of that correction is plenty for a marker on a map.
    let place = heliocentric(body.orbit, jd);
    let offset: Vector = [place[0] - earth[0], place[1] - earth[1], place[2] - earth[2]];
    place = heliocentric(body.orbit, jd - Math.hypot(...offset) * LIGHT_DAYS);
    offset = [place[0] - earth[0], place[1] - earth[1], place[2] - earth[2]];
    const sky = toSky(offset);
    out.push({ ...body, ra: sky.ra, dec: sky.dec, earth: sky.distance, sun: Math.hypot(...place) });
  }
  return out;
}
