// Saving results: the picture on screen, the whole sequence as an animation, and the spectrum as a table.
// Everything is built in the browser. Nothing is uploaded.
// Written with Claude Code (Anthropic) assistance.
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { mjdToDate } from "./astro";
import { captureStep } from "./capture";
import { currentSpectrum } from "./measure";
import { DEFAULT_APERTURE } from "./spectrum";
import type { AppState } from "./store";

/** Longest side of an exported animation in pixels, and the most steps it may hold. */
const GIF_SIZE = 560;
const GIF_STEPS = 240;

export const DATA_CREDIT = "Data: NASA SPHEREx (JPL, Caltech), from NASA/IPAC IRSA";

/** A file name built from the target and what is being saved. */
export function fileName(state: AppState, what: string, extension: string): string {
  const name = state.target?.name ?? (state.target ? `${state.target.ra.toFixed(4)}_${state.target.dec.toFixed(4)}` : "sky");
  const safe = name.replace(/[^A-Za-z0-9+._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `spherexplorer_${safe}_${what}.${extension}`;
}

export function download(blob: Blob, name: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

/** The picture on screen as a PNG file. */
export async function exportImage(state: AppState): Promise<boolean> {
  const canvas = captureStep(state.player.index);
  if (!canvas) return false;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return false;
  download(blob, fileName(state, state.mode, "png"));
  return true;
}

/** Every step of the sequence as an animated GIF. onProgress receives a number from 0 to 1. */
export async function exportAnimation(state: AppState, onProgress: (done: number) => void): Promise<boolean> {
  const total = state.sequence.length;
  if (!total) return false;
  // Long sequences are thinned evenly so the file stays a sensible size.
  const stride = Math.ceil(total / GIF_STEPS);
  const steps = Array.from({ length: Math.ceil(total / stride) }, (_, i) => i * stride);
  const encoder = GIFEncoder();
  const scratch = document.createElement("canvas");
  const pen = scratch.getContext("2d", { willReadFrequently: true })!;
  const delay = Math.round(1000 / state.player.fps);

  for (let i = 0; i < steps.length; i++) {
    const frame = captureStep(steps[i]);
    if (!frame) return false;
    if (i === 0) {
      const shrink = Math.min(1, GIF_SIZE / Math.max(frame.width, frame.height));
      scratch.width = Math.round(frame.width * shrink);
      scratch.height = Math.round(frame.height * shrink);
    }
    pen.drawImage(frame, 0, 0, scratch.width, scratch.height);
    const pixels = pen.getImageData(0, 0, scratch.width, scratch.height).data;
    const palette = quantize(pixels, 256);
    encoder.writeFrame(applyPalette(pixels, palette), scratch.width, scratch.height, { palette, delay, repeat: 0 });
    onProgress((i + 1) / steps.length);
    // Give the page a moment to stay responsive.
    await new Promise((resolve) => setTimeout(resolve));
  }
  encoder.finish();
  download(new Blob([encoder.bytes() as BlobPart], { type: "image/gif" }), fileName(state, state.mode, "gif"));
  return true;
}

/** The spectrum as comma-separated text: one row per image, with the measurement and its quality. */
export function spectrumCsv(state: AppState): string {
  const points = currentSpectrum(state);
  const target = state.target;
  const { aperture, probe } = state.spectrum;
  const how = aperture !== null || probe
    ? `# Flux is the light inside a circle of radius ${aperture ?? DEFAULT_APERTURE} arcsec, minus the sky in a ring around it.`
    : "# Flux is a PSF-fit point-source flux density from each SPHEREx Level 2 image.";
  const lines = [
    `# SPHERExplorer spectrum of ${target?.name ?? "a sky position"}`,
    target?.moving
      ? `# Solar system body followed with a JPL Horizons ephemeris (${target.moving.command})`
      : target ? `# Position (ICRS, epoch ${target.epoch}): RA ${target.ra.toFixed(6)} deg, Dec ${target.dec.toFixed(6)} deg` : "#",
    target?.moving ? "# Each image is centered on the body's position at that time, as seen from SPHEREx" : target?.pmRa !== undefined ? `# Proper motion followed: ${target.pmRa} mas/yr east, ${target.pmDec} mas/yr north` : "# No proper motion applied",
    how,
    probe ? `# Measured at a spot ${probe[0].toFixed(1)} arcsec east and ${probe[1].toFixed(1)} arcsec north of the position above.` : "#",
    "# good = 0 marks measurements touched by saturation or flagged pixels.",
    `# ${DATA_CREDIT}. DOIs 10.26131/IRSA678 and 10.26131/IRSA662.`,
    "wavelength_um,bandwidth_um,flux_uJy,flux_err_uJy,mjd,date_utc,detector,channel,visit,good,file",
  ];
  for (const p of points) {
    const frame = state.frames[p.frameId];
    lines.push([
      p.wavelength.toFixed(5), p.bandwidth.toFixed(5), p.flux.toFixed(2), p.err.toFixed(2), p.mjd.toFixed(6),
      mjdToDate(p.mjd).toISOString(), p.detector, p.channel, p.season + 1, p.good ? 1 : 0, frame.key.split("/").pop(),
    ].join(","));
  }
  return lines.join("\n") + "\n";
}

export function exportSpectrum(state: AppState): boolean {
  const text = spectrumCsv(state);
  if (text.split("\n").length < 10) return false;
  download(new Blob([text], { type: "text/csv" }), fileName(state, "spectrum", "csv"));
  return true;
}
