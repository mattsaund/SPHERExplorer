// The spectrum points for the current state: the target or a probed spot, measured with the
// server's point-source fit, with a circle, or in a ring around a star too bright for the
// detector. The plots and the export all read from here.
// Written with Claude Code (Anthropic) assistance.
import { chooseRing } from "./aperture";
import { trackOffset } from "../images/layers";
import { spectrumOf, type SpectrumPoint } from "./spectrum";
import type { AppState } from "../state/store";

let cache: { frames: unknown; aperture: number | null; probe: unknown; halo: boolean; target: unknown; points: SpectrumPoint[] } | null = null;

/** Spectrum points for the current state. Recomputed only when the frames or the settings change. */
export function currentSpectrum(state: AppState): SpectrumPoint[] {
  const { aperture, probe, halo } = state.spectrum;
  if (cache && cache.frames === state.frames && cache.aperture === aperture && cache.probe === probe && cache.halo === halo && cache.target === state.target) return cache.points;
  const badMask = state.meta?.badMask ?? 0;
  let ring: number | null = null;
  if (halo && state.target && !state.target.moving) {
    // The ring starts just outside the star's bad core. Flags that mark glints count as bad here too.
    const ready = state.frames.filter((frame) => frame.status === "ready");
    const [east, north] = probe ?? (ready.length ? trackOffset(ready[ready.length >> 1], state) : [0, 0]);
    ring = chooseRing(ready, east, north, state.meta?.stackMask ?? badMask);
  }
  const points = spectrumOf(state.frames, ring !== null ? state.meta?.stackMask ?? badMask : badMask, {
    aperture,
    probe,
    trackOffset: (frame) => trackOffset(frame, state),
    ring,
  });
  cache = { frames: state.frames, aperture, probe, halo, target: state.target, points };
  return points;
}

/**
 * The share of the measurements that can be trusted, from 0 to 1. A low share means the source
 * is too bright for the detector in many images, and its halo is the better thing to measure.
 */
export function spectrumTrust(state: AppState): number {
  const points = currentSpectrum(state);
  return points.length ? points.filter((point) => point.good).length / points.length : 1;
}
