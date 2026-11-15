// Tests for finding the target in 2MASS and WISE.
// Written with Claude Code (Anthropic) assistance.
import { describe, expect, it } from "vitest";
import { matchTarget, surveyPoints, yearToMjd } from "./surveys";
import type { MissionData, SurveySource, Target } from "../types";

// Epsilon Indi B at 2026.0 and where 2MASS saw it in mid 2000.
const target: Target = { ra: 331.096656, dec: -56.800664, epoch: 2026.0, pmRa: 3981.977, pmDec: -2466.832 };
const seen2000: SurveySource = { id: "2MASS J22041058-5646581", ra: 331.044113, dec: -56.782829, epoch: 2000.54, bands: { J: { flux: 27400, err: 600, mag: 11.908 } } };
const bystander: SurveySource = { id: "2MASS J22042545-5648534", ra: 331.106, dec: -56.8148, epoch: 2000.54, bands: { J: { flux: 461, err: 40, mag: 16.3 } } };

describe("matchTarget", () => {
  it("looks where a fast mover was at the survey date", () => {
    expect(matchTarget(target, [bystander, seen2000], 3.5)?.id).toBe("2MASS J22041058-5646581");
  });
  it("finds nothing at today's position for a fast mover", () => {
    const still = { ...target, pmRa: 0, pmDec: 0 };
    expect(matchTarget(still, [seen2000], 3.5)).toBeNull();
  });
});

describe("surveyPoints", () => {
  it("returns one point per band with band facts attached", () => {
    const missions: MissionData = {
      bands: { J: { zero: 1594, wavelength: 1.235, width: 0.162, survey: "2MASS" } },
      gaia: [], twomass: [bystander, seen2000], wise: [], errors: [],
    };
    const points = surveyPoints(target, missions);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ band: "J", survey: "2MASS", flux: 27400, wavelength: 1.235 });
    expect(surveyPoints(null, missions)).toEqual([]);
    expect(surveyPoints(target, null)).toEqual([]);
  });
  it("converts years to MJD", () => {
    expect(yearToMjd(2000)).toBe(51544.5);
  });
});
