// The solar system's places must match JPL Horizons, a month after the orbits were taken.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { separation } from "./astro";
import { heliocentric, solarPlaces } from "./solar";
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
