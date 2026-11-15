// Finds the target in other surveys. 2MASS looked around 1999 and WISE around 2010, so a
// fast-moving target has to be looked for where it was at that time, not where it is now.
// Written with Claude Code (Anthropic) assistance.
import { positionAt, skyOffset } from "./astro";
import type { MissionData, SurveyPoint, SurveySource, Target } from "../types";

/** Largest separation, in arcseconds, for a catalog source to count as the target. */
const MATCH_RADIUS: Record<string, number> = { twomass: 3.5, wise: 5 };

/** Julian year to Modified Julian Date. */
export function yearToMjd(year: number): number {
  return 51544.5 + (year - 2000) * 365.25;
}

/** The catalog source nearest to where the target was when the survey looked, if close enough. */
export function matchTarget(target: Target, sources: SurveySource[], radius: number): SurveySource | null {
  let best: SurveySource | null = null;
  let bestDistance = radius;
  for (const source of sources) {
    const then = positionAt(target, yearToMjd(source.epoch));
    const [east, north] = skyOffset(source, then);
    const distance = Math.hypot(east, north);
    if (distance <= bestDistance) {
      best = source;
      bestDistance = distance;
    }
  }
  return best;
}

/** The target's 2MASS and WISE brightness, one point per band, sorted by wavelength. */
export function surveyPoints(target: Target | null, missions: MissionData | null): SurveyPoint[] {
  if (!target || !missions) return [];
  const points: SurveyPoint[] = [];
  for (const list of ["twomass", "wise"] as const) {
    const match = matchTarget(target, missions[list], MATCH_RADIUS[list]);
    if (!match) continue;
    for (const [band, value] of Object.entries(match.bands)) {
      const facts = missions.bands[band];
      if (!facts) continue;
      points.push({
        band, survey: facts.survey, source: match.id, wavelength: facts.wavelength, width: facts.width,
        flux: value.flux, err: value.err, epoch: match.epoch,
      });
    }
  }
  return points.sort((a, b) => a.wavelength - b.wavelength);
}
