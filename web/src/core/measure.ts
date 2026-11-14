// The spectrum points for the current state: the target or a probed spot, measured with the
// server's point-source fit or with a circle. The plots and the export all read from here.
// Written with Claude Code (Anthropic) assistance.
import { trackOffset } from "./layers";
import { spectrumOf, type SpectrumPoint } from "./spectrum";
import type { AppState } from "./store";

let cache: { frames: unknown; aperture: number | null; probe: unknown; target: unknown; points: SpectrumPoint[] } | null = null;

/** Spectrum points for the current state. Recomputed only when the frames or the settings change. */
export function currentSpectrum(state: AppState): SpectrumPoint[] {
  const { aperture, probe } = state.spectrum;
  if (cache && cache.frames === state.frames && cache.aperture === aperture && cache.probe === probe && cache.target === state.target) return cache.points;
  const points = spectrumOf(state.frames, state.meta?.badMask ?? 0, {
    aperture,
    probe,
    trackOffset: (frame) => trackOffset(frame, state),
  });
  cache = { frames: state.frames, aperture, probe, target: state.target, points };
  return points;
}
