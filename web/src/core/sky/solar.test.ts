// The solar system's places must match JPL Horizons, a month after the orbits were taken.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { separation } from "./astro";
import { heliocentric, moonLight, solarPlaces } from "./solar";
import { SOLAR_BODIES, SOLAR_CHECK, SOLAR_EPOCH } from "./solarBodies";

/** The moment of the check as a Date. Orbits are counted on a clock 69.184 s ahead of the wall clock. */
const moment = new Date((SOLAR_CHECK.jd - 2440587.5) * 86400000 - 69184);

describe("solar system places", () => {
  const places = solarPlaces(moment);

  it("lists the Sun, the Moon, and every body with an orbit", () => {
    expect(places.length).toBe(SOLAR_BODIES.length + 2);
    expect(places.map((body) => body.id)).toContain("jupiter");
    expect(places.map((body) => body.id)).toContain("ceres");
  });

  it("agrees with JPL Horizons a month after the orbits were taken", () => {
    const off: string[] = [];
    for (const body of places) {
      const answer = SOLAR_CHECK.places[body.id];
      expect(answer, body.id).toBeDefined();
      const apart = separation(body, { ra: answer[0], dec: answer[1] }).arcsec;
      // The Moon's short series is good to a fraction of a degree. Everything else follows
      // its orbit, and stays within an arcminute over a month.
      const allowed = body.id === "moon" ? 1800 : 60;
      if (apart > allowed) off.push(`${body.name} is ${apart.toFixed(0)} arcsec off`);
    }
    expect(off).toEqual([]);
  });

  it("gives sensible distances", () => {
    const by = Object.fromEntries(places.map((body) => [body.id, body]));
    expect(by.sun.earth).toBeGreaterThan(0.98);
    expect(by.sun.earth).toBeLessThan(1.02);
    expect(by.moon.earth * 149597870.7).toBeGreaterThan(356000);
    expect(by.moon.earth * 149597870.7).toBeLessThan(407000);
    expect(by.jupiter.sun).toBeGreaterThan(4.9);
    expect(by.jupiter.sun).toBeLessThan(5.5);
    expect(by.neptune.sun).toBeGreaterThan(29.7);
    expect(by.neptune.sun).toBeLessThan(30.4);
  });

  it("handles a body passing through once, on an open orbit", () => {
    const visitor = SOLAR_BODIES.find((body) => body.orbit && body.orbit.e > 1)!;
    expect(visitor).toBeDefined();
    const [x, y, z] = heliocentric(visitor.orbit!, SOLAR_EPOCH);
    expect(Number.isFinite(x + y + z)).toBe(true);
    // At closest approach it is exactly q from the Sun.
    const near = heliocentric(visitor.orbit!, visitor.orbit!.tp);
    expect(Math.hypot(...near)).toBeCloseTo(visitor.orbit!.q, 6);
  });
});

describe("the discs of the Sun and the Moon", () => {
  // From JPL Horizons, seen from the center of the Earth: the Moon's lit share, its width and
  // the Sun's in arcseconds, and the direction away from the Sun at the Moon (its PsAng).
  const checks = [
    { when: "2026-11-15T00:00:00Z", lit: 0.2723, moonWidth: 1770.646, sunWidth: 1939.188, awayFromSun: 80.724 },
    { when: "2026-11-27T12:00:00Z", lit: 0.8805, moonWidth: 1982.351, sunWidth: 1944.196, awayFromSun: 273.037 },
    { when: "2026-12-02T06:00:00Z", lit: 0.3951, moonWidth: 1873.011, sunWidth: 1945.713, awayFromSun: 292.67 },
  ];

  it("are as wide as JPL Horizons says", () => {
    for (const check of checks) {
      const by = Object.fromEntries(solarPlaces(new Date(check.when)).map((body) => [body.id, body]));
      expect(by.sun.disc! * 7200, check.when).toBeCloseTo(check.sunWidth, 0);
      // The Moon's distance comes from a short series, good to about a third of a percent.
      expect(Math.abs(by.moon.disc! * 7200 - check.moonWidth) / check.moonWidth, check.when).toBeLessThan(0.005);
      expect(by.jupiter.disc).toBeUndefined();
    }
  });

  it("light the Moon as JPL Horizons says", () => {
    for (const check of checks) {
      const moon = solarPlaces(new Date(check.when)).find((body) => body.id === "moon")!;
      expect(Math.abs(moon.lit! - check.lit), check.when).toBeLessThan(0.01);
      const sunward = (check.awayFromSun + 180) % 360;
      const off = Math.abs(((moon.sunward! - sunward + 540) % 360) - 180);
      expect(off, check.when).toBeLessThan(1);
    }
  });

  it("call the Moon full opposite the Sun and new beside it", () => {
    const sun = { ra: 100, dec: 20, distance: 1 };
    expect(moonLight({ ra: 280, dec: -20, distance: 0.00257 }, sun).lit).toBeCloseTo(1, 4);
    expect(moonLight({ ra: 100.001, dec: 20, distance: 0.00257 }, sun).lit).toBeCloseTo(0, 4);
    // The Sun due west of the Moon lights its western edge.
    expect(moonLight({ ra: 110, dec: 0, distance: 0.00257 }, { ra: 80, dec: 0, distance: 1 }).sunward).toBeCloseTo(270, 3);
  });
});
