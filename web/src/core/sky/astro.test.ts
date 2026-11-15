// Tests for coordinate parsing, formatting, motion, and visit grouping.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { assignSeasons, distanceMethod, formatAngle, formatAu, formatDec, formatDistance, formatRa, mjdToDate, mjdToYear, offsetToSky, parseCoordinates, positionAt, separation, skyOffset, skyPath } from "./astro";

describe("parseCoordinates", () => {
  it("reads decimal degrees", () => {
    expect(parseCoordinates("133.759765 -7.242182")).toEqual({ ra: 133.759765, dec: -7.242182 });
    expect(parseCoordinates("133.76, -7.24")).toEqual({ ra: 133.76, dec: -7.24 });
  });
  it("reads sexagesimal in NASA's challenge format", () => {
    const p = parseCoordinates("08h55m10.831s -7d14m42.53s")!;
    expect(p.ra).toBeCloseTo(133.795129, 5);
    expect(p.dec).toBeCloseTo(-7.245147, 5);
  });
  it("reads colons, plain numbers, and designations", () => {
    expect(parseCoordinates("17:57:47.10 +04:46:05.6")!.ra).toBeCloseTo(269.44625, 4);
    expect(parseCoordinates("22 04 23.197 -56 48 02.39")!.dec).toBeCloseTo(-56.800664, 5);
    const d = parseCoordinates("WISEA J085510.74-071442.5")!;
    expect(d.ra).toBeCloseTo(133.79475, 4);
    expect(d.dec).toBeCloseTo(-7.245139, 4);
  });
  it("keeps the sign of a declination between 0 and -1 degrees", () => {
    expect(parseCoordinates("10 00 00 -00 30 00")!.dec).toBeCloseTo(-0.5, 9);
  });
  it("reads J2000 coordinates written the way papers and NASA write them", () => {
    const nasa = parseCoordinates("RA 08h55m10.831s, Dec -7d14m42.53s")!;
    expect(nasa.ra).toBeCloseTo(133.795129, 5);
    expect(nasa.dec).toBeCloseTo(-7.245147, 5);
    const noted = parseCoordinates("R.A. = 17h57m48.50s, Decl. = +04\u00b041\u203236.1\u2033 (J2000.0)")!;
    expect(noted.ra).toBeCloseTo(269.452083, 5);
    expect(noted.dec).toBeCloseTo(4.693361, 5);
    expect(parseCoordinates("ra=133.76 dec=-7.24 J2000")).toEqual({ ra: 133.76, dec: -7.24 });
    expect(parseCoordinates("ICRS 133.76\u00b0 \u22127.24\u00b0")).toEqual({ ra: 133.76, dec: -7.24 });
    expect(parseCoordinates("133.76d -7.24d")).toEqual({ ra: 133.76, dec: -7.24 });
    expect(parseCoordinates("\u03b1 = 22:04:23.2, \u03b4 = \u221256:48:02")!.dec).toBeCloseTo(-56.800556, 5);
  });
  it("reads decimal hours and decimal minutes", () => {
    expect(parseCoordinates("8.5h -7.25d")).toEqual({ ra: 127.5, dec: -7.25 });
    const minutes = parseCoordinates("08 55.18 -07 14.7")!;
    expect(minutes.ra).toBeCloseTo(133.795, 6);
    expect(minutes.dec).toBeCloseTo(-7.245, 6);
  });
  it("reads galactic coordinates only when marked", () => {
    const center = parseCoordinates("gal 0 0")!;
    expect(center.ra).toBeCloseTo(266.405, 2);
    expect(center.dec).toBeCloseTo(-28.936, 2);
    const pole = parseCoordinates("l=123.4 b=90")!;
    expect(pole.ra).toBeCloseTo(192.8595, 3);
    expect(pole.dec).toBeCloseTo(27.1283, 3);
    expect(parseCoordinates("galactic 400 0")).toBeNull();
  });
  it("leaves object names alone", () => {
    for (const name of ["NGC 1068", "M 31", "3C 273", "47 Tuc", "G 29-38", "HD 209458", "Gliese 229", "RA Lacertae", "Dec 2025 nova", "TRAPPIST-1", "61 Cyg"]) {
      expect(parseCoordinates(name)).toBeNull();
    }
  });
  it("rejects names and nonsense", () => {
    expect(parseCoordinates("Barnard's Star")).toBeNull();
    expect(parseCoordinates("M31")).toBeNull();
    expect(parseCoordinates("120 95")).toBeNull();
    expect(parseCoordinates("400 10")).toBeNull();
    expect(parseCoordinates("10 70 00 +10 00 00")).toBeNull();
    expect(parseCoordinates("")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats sexagesimal", () => {
    expect(formatRa(133.759765)).toBe("08h55m02.34s");
    expect(formatDec(-7.242182)).toBe("-07d14m31.9s");
    expect(formatDec(4.768222)).toBe("+04d46m05.6s");
  });
  it("carries rounding into the next unit", () => {
    expect(formatRa(359.99999999)).toBe("24h00m00.00s");
    expect(formatDec(-0.0000001)).toBe("-00d00m00.0s");
  });
});

describe("time", () => {
  it("converts MJD", () => {
    expect(mjdToDate(51544.5).toISOString()).toBe("2000-01-01T12:00:00.000Z");
    expect(mjdToYear(51544.5)).toBe(2000);
    expect(mjdToYear(61041.0)).toBeCloseTo(2026.0, 2);
  });
});

describe("motion", () => {
  const barnard = { ra: 269.446267, dec: 4.768222, epoch: 2026.0, pmRa: -801.551, pmDec: 10362.394, parallax: 546.976 };
  it("moves Barnard's Star about 10.4 arcsec north in a year", () => {
    const later = positionAt(barnard, 61041.0 + 365.25);
    const [east, north] = skyOffset(later, barnard);
    expect(north).toBeCloseTo(10.362, 2);
    expect(east).toBeCloseTo(-0.8016, 2);
  });
  it("adds parallax through the factors", () => {
    const shifted = positionAt({ ...barnard, pmRa: 0, pmDec: 0 }, 61041.0, [1, -0.5]);
    const [east, north] = skyOffset(shifted, barnard);
    expect(east).toBeCloseTo(0.547, 2);
    expect(north).toBeCloseTo(-0.2735, 2);
  });
  it("round-trips offsets", () => {
    const center = { ra: 10, dec: 80 };
    const p = offsetToSky(120, -75, center);
    const [east, north] = skyOffset(p, center);
    expect(east).toBeCloseTo(120, 6);
    expect(north).toBeCloseTo(-75, 6);
  });
});

describe("assignSeasons", () => {
  it("starts a new visit after a long gap", () => {
    expect(assignSeasons([60800, 60801, 60810, 60980, 60990, 61170])).toEqual([0, 0, 0, 1, 1, 2]);
    expect(assignSeasons([])).toEqual([]);
  });
  it("cuts a long unbroken watch into calendar months", () => {
    // One exposure every 5 days for 150 days, starting 2025 May 1 (MJD 60796).
    const mjds = Array.from({ length: 31 }, (_, i) => 60796 + i * 5);
    const seasons = assignSeasons(mjds);
    // The first 60 days stay together. After that each new month starts a new visit.
    expect(seasons[0]).toBe(0);
    expect(seasons[12]).toBe(0);
    expect(new Set(seasons).size).toBeGreaterThanOrEqual(3);
    expect(seasons).toEqual([...seasons].sort((a, b) => a - b));
  });
});

describe("distances", () => {
  it("formats distances across every scale", () => {
    expect(formatDistance({ parsecs: 1.8282, method: "parallax" })).toBe("5.96 light-years");
    expect(formatDistance({ parsecs: 7790, method: "measured" })).toBe("25,400 light-years");
    expect(formatDistance({ parsecs: 761000, method: "measured" })).toBe("2.48 million light-years");
    expect(formatDistance({ parsecs: 6.8e8, method: "redshift", lightTravelYears: 2.0e9 })).toBe("about 2.22 billion light-years (its light left 2.00 billion years ago)");
    expect(distanceMethod("parallax")).toBe("from its parallax");
  });
  it("formats solar system distances", () => {
    expect(formatAu(2.61)).toBe("2.61 au (390 million km)");
    expect(formatAu(29.9)).toBe("29.9 au (4.47 billion km)");
    expect(formatAu(0.00257)).toBe("0.00257 au (384,467 km)");
  });
});

describe("measuring on the sky", () => {
  it("gives the angle and direction between two positions", () => {
    // One degree straight north.
    const north = separation({ ra: 10, dec: 20 }, { ra: 10, dec: 21 });
    expect(north.arcsec).toBeCloseTo(3600, 6);
    expect(north.angle).toBeCloseTo(0, 6);
    // East along the equator, across the 0 hour line.
    const east = separation({ ra: 359.5, dec: 0 }, { ra: 0.5, dec: 0 });
    expect(east.arcsec).toBeCloseTo(3600, 6);
    expect(east.angle).toBeCloseTo(90, 6);
    // A degree of right ascension is shorter away from the equator.
    const high = separation({ ra: 100, dec: 60 }, { ra: 101, dec: 60 });
    expect(high.arcsec / 3600).toBeCloseTo(Math.cos((60 * Math.PI) / 180), 3);
    // Pole to pole is half the sky. Sirius to Betelgeuse is 27.1 degrees.
    expect(separation({ ra: 0, dec: 90 }, { ra: 0, dec: -90 }).arcsec).toBeCloseTo(180 * 3600, 3);
    expect(separation({ ra: 101.2872, dec: -16.7161 }, { ra: 88.7929, dec: 7.4071 }).arcsec / 3600).toBeCloseTo(27.1, 1);
  });

  it("agrees with the tangent-plane offset for small angles", () => {
    const from = { ra: 133.79, dec: -7.24 };
    const to = offsetToSky(30, -40, from);
    const { arcsec, angle } = separation(from, to);
    expect(arcsec).toBeCloseTo(50, 3);
    // 30 east and 40 south: southeast, 143.13 degrees from north through east.
    expect(angle).toBeCloseTo(143.13, 1);
  });

  it("draws the shortest path between two positions", () => {
    const from = { ra: 350, dec: 10 };
    const to = { ra: 20, dec: 40 };
    const path = skyPath(from, to, 12);
    expect(path).toHaveLength(13);
    expect(path[0].ra).toBeCloseTo(350, 9);
    expect(path[12].dec).toBeCloseTo(40, 9);
    // Evenly spaced along the way, so every step is one twelfth of the whole.
    const whole = separation(from, to).arcsec;
    for (let i = 1; i < path.length; i++) expect(separation(path[i - 1], path[i]).arcsec).toBeCloseTo(whole / 12, 4);
    // The same point twice has no path to curve.
    expect(skyPath(from, from)).toHaveLength(2);
  });

  it("names an angle in the unit that reads best", () => {
    expect(formatAngle(12.34)).toBe("12.3 arcsec");
    expect(formatAngle(501.36)).toBe("8.36 arcmin");
    expect(formatAngle(2.5 * 3600)).toBe("2.500 degrees");
  });
});
