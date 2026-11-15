// Saving results: the picture on screen, the whole sequence as an animation, and the spectrum as a table.
// Everything is built in the browser. Nothing is uploaded.
// Written with Claude Code (Anthropic) assistance.
import { GIFEncoder } from "gifenc";
import { fitsArchive, fitsUrl, type CutoutRequest } from "./api";
import { formatDec, formatRa, mjdToDate } from "./astro";
import { captureStep } from "./capture";
import { describeChange } from "./changes";
import { writeFits, type FitsCard } from "./fitsfile";
import { indexFrame } from "./gifcolor";
import { plainSum } from "./layers";
import { lightCurve } from "./lightcurve";
import { currentSpectrum } from "./measure";
import { DEFAULT_APERTURE } from "./spectrum";
import type { AppState } from "./store";

/** The size of a saved picture: its side in pixels when it is square (see renderStep in FrameView.tsx). */
const PICTURE_SIDE = 1600;
/** The most steps a saved animation may hold. A longer sequence is thinned evenly. */
const GIF_STEPS = 240;
/** The size of the picture in a saved animation, in the same terms, when the file allows it. */
const GIF_SIDE = 1080;
/** A saved animation should stay under this many bytes. A film that would pass it is made smaller. */
const GIF_BYTES = 48e6;
/** But its picture is never made smaller than this. */
const GIF_LEAST = 360;

export const DATA_CREDIT = "Data: NASA SPHEREx (JPL, Caltech), from NASA/IPAC IRSA";

/** A file name built from the target and what is being saved. */
export function fileName(state: AppState, what: string, extension: string): string {
  const name = state.target?.name ?? (state.target ? `${state.target.ra.toFixed(4)}_${state.target.dec.toFixed(4)}` : "sky");
  const safe = name.replace(/[^A-Za-z0-9+._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `spherexplorer_${safe}_${what}.${extension}`;
}

/** Hand a file made in the browser to the person, under a given name. */
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
  const canvas = captureStep(state.player.index, PICTURE_SIDE);
  if (!canvas) return false;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return false;
  download(blob, fileName(state, state.mode, "png"));
  return true;
}

/** A moment for the page to stay responsive during a long job. */
const pause = () => new Promise((resolve) => setTimeout(resolve));

/**
 * Every step of the sequence as an animated GIF. onProgress receives a number from 0 to 1.
 * Each frame is drawn at the size it is saved at, so nothing is blurred by shrinking, and
 * its colors are chosen for that frame (see gifcolor.ts).
 */
export async function exportAnimation(state: AppState, onProgress: (done: number) => void): Promise<boolean> {
  const total = state.sequence.length;
  if (!total) return false;
  // Long sequences are thinned evenly so the file stays a sensible size.
  const stride = Math.ceil(total / GIF_STEPS);
  const steps = Array.from({ length: Math.ceil(total / stride) }, (_, i) => i * stride);
  const delay = Math.round(1000 / state.player.fps);

  /** One step as the GIF encoder wants it, with its picture at the size that `side` sets. */
  const frameOf = (step: number, side: number) => {
    const canvas = captureStep(step, side);
    if (!canvas) return null;
    const { width, height } = canvas;
    return { width, height, ...indexFrame(canvas.getContext("2d")!.getImageData(0, 0, width, height).data, width) };
  };

  let side = GIF_SIDE;
  // A long film at full size can be a very large file. When it could pass the limit, two
  // frames are encoded to see what one costs, and the film is made smaller to fit.
  if (steps.length * side * side * 1.5 > GIF_BYTES) {
    let bytes = 0;
    for (const step of [steps[0], steps[steps.length >> 1]]) {
      const frame = frameOf(step, side);
      if (!frame) return false;
      const one = GIFEncoder();
      one.writeFrame(frame.index, frame.width, frame.height, { palette: frame.palette, delay });
      bytes = Math.max(bytes, one.bytesView().length);
      await pause();
    }
    const expected = bytes * steps.length;
    if (expected > GIF_BYTES) side = Math.max(GIF_LEAST, Math.floor(side * Math.sqrt(GIF_BYTES / expected)));
  }

  const encoder = GIFEncoder();
  for (let i = 0; i < steps.length; i++) {
    const frame = frameOf(steps[i], side);
    if (!frame) return false;
    encoder.writeFrame(frame.index, frame.width, frame.height, { palette: frame.palette, delay, repeat: 0 });
    onProgress((i + 1) / steps.length);
    await pause();
  }
  encoder.finish();
  download(new Blob([encoder.bytes() as BlobPart], { type: "image/gif" }), fileName(state, state.mode, "gif"));
  return true;
}

/** The spectrum as comma-separated text: one row per image, with the measurement and its quality. */
export function spectrumCsv(state: AppState): string {
  const points = currentSpectrum(state);
  const target = state.target;
  const { aperture, probe, halo } = state.spectrum;
  const how = halo
    ? "# Flux is the light in a ring around the source (its halo), not the source itself, because the source is too bright for the detector. The level is the halo's. The features are the star's."
    : aperture !== null || probe
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

/** Save the spectrum table. False when there is nothing measured yet. */
export function exportSpectrum(state: AppState): boolean {
  const text = spectrumCsv(state);
  if (text.split("\n").length < 10) return false;
  download(new Blob([text], { type: "text/csv" }), fileName(state, "spectrum", "csv"));
  return true;
}

// ---- FITS files, for people who measure with their own tools ---------------------------------

/** Start a download from an address. The server names the file. */
function downloadFrom(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** What to ask the server for, to get the loaded images again: the same request that loaded them. */
export function cutoutRequest(state: AppState): CutoutRequest | null {
  const target = state.target;
  if (!target) return null;
  const frames = state.frames.filter((frame) => frame.status === "ready");
  if (!frames.length) return null;
  return {
    ra: target.ra,
    dec: target.dec,
    size: state.fieldSize,
    frames: frames.map((frame) =>
      target.moving
        ? { key: frame.key, ra: frame.track.ra, dec: frame.track.dec, delta: frame.earthDistance }
        : { key: frame.key },
    ),
  };
}

/**
 * The image on screen as a FITS file.
 * A single exposure comes from the server: the archive's own pixels, flags, and variance, with
 * the image's own world coordinates. A sum exists only in the browser, so it is written here,
 * on its north-up grid.
 */
export function exportFits(state: AppState): boolean {
  const item = state.sequence[state.player.index];
  const target = state.target;
  if (!item || !target) return false;
  if (item.frameIds.length === 1) {
    const frame = state.frames[item.frameIds[0]];
    const moving = !!target.moving;
    downloadFrom(fitsUrl(frame.key, moving ? frame.track.ra : target.ra, moving ? frame.track.dec : target.dec, state.fieldSize, moving ? frame.earthDistance : undefined));
    return true;
  }
  const sum = plainSum(item, state);
  if (!sum) return false;
  // The sum's grid is a tangent plane around the field center. For a body that is followed,
  // the center is the body's own place at the middle of the sum.
  const middle = state.frames[item.frameIds[Math.floor(item.frameIds.length / 2)]];
  const center = target.moving ? middle.track : target;
  const times = item.frameIds.map((id) => state.frames[id].mjd);
  const waves = item.frameIds.map((id) => state.frames[id].wavelength);
  const cards: FitsCard[] = [
    ["BUNIT", "MJy/sr", "surface brightness above each image's own background"],
    ["CTYPE1", "RA---TAN"],
    ["CTYPE2", "DEC--TAN"],
    ["CUNIT1", "deg"],
    ["CUNIT2", "deg"],
    ["RADESYS", "ICRS"],
    ["CRVAL1", center.ra, "[deg] field center"],
    ["CRVAL2", center.dec, "[deg] field center"],
    // The engine counts pixel centers from 0. FITS counts them from 1.
    ["CRPIX1", sum.cx + 1],
    ["CRPIX2", sum.cy + 1],
    ["CD1_1", sum.m[0] / 3600],
    ["CD1_2", sum.m[1] / 3600],
    ["CD2_1", sum.m[2] / 3600],
    ["CD2_2", sum.m[3] / 3600],
    ["TELESCOP", "SPHEREx"],
    ["ORIGIN", "SPHERExplorer", "sum made in the SPHERExplorer web tool"],
    ["OBJECT", target.name ?? "sky position"],
    ["NCOMBINE", sum.count, "exposures in the sum"],
    ["MJD-BEG", Math.min(...times), "first exposure"],
    ["MJD-END", Math.max(...times), "last exposure"],
    ["WAVEMIN", Math.min(...waves), "[um] shortest wavelength in the sum"],
    ["WAVEMAX", Math.max(...waves), "[um] longest wavelength in the sum"],
    ["FOLLOWED", !!target.moving && state.follow, "sum follows a moving target"],
  ];
  const comments = [
    `Sum of ${sum.count} NASA SPHEREx Level 2 exposures: ${item.label}.`,
    "Each exposure had its own background level removed. Outliers were clipped.",
    "Pixels are half a detector pixel wide. Exposures at different wavelengths are mixed,",
    "so this image is for finding and placing sources, not for calibrated brightness.",
    "Pixels where every exposure was saturated or flagged are NaN.",
    `${DATA_CREDIT}.`,
  ];
  download(writeFits(sum.image, sum.nx, sum.ny, cards, comments), fileName(state, state.mode, "fits"));
  return true;
}

/** Every loaded exposure as a FITS cutout, in one zip file. Throws an ApiError with words fit to show. */
export async function exportAllFits(state: AppState, signal?: AbortSignal): Promise<boolean> {
  const request = cutoutRequest(state);
  if (!request) return false;
  download(await fitsArchive(request, signal), fileName(state, "cutouts", "zip"));
  return true;
}

// ---- More tables ----------------------------------------------------------------------------

/** Brightness over time as a CSV table: each measurement against the target's usual brightness at that wavelength. */
export function lightCurveCsv(state: AppState): string {
  const curve = lightCurve(currentSpectrum(state));
  const lines = [
    `# SPHERExplorer brightness over time of ${state.target?.name ?? "a sky position"}`,
    "# relative = this measurement divided by the average of all visits at the same wavelength channel.",
    "# 1 is the usual brightness. 1.2 is 20 percent brighter.",
    `# ${DATA_CREDIT}. DOIs 10.26131/IRSA678 and 10.26131/IRSA662.`,
    "mjd,date_utc,visit,detector,wavelength_um,relative,relative_err,file",
  ];
  for (const p of curve.points) {
    lines.push([
      p.mjd.toFixed(6), mjdToDate(p.mjd).toISOString(), p.season + 1, p.detector, p.wavelength.toFixed(5), p.ratio.toFixed(5), p.err.toFixed(5),
      state.frames[p.frameId].key.split("/").pop(),
    ].join(","));
  }
  return lines.join("\n") + "\n";
}

/** Save the brightness-over-time table. False when there is nothing measured yet. */
export function exportLightCurve(state: AppState): boolean {
  const text = lightCurveCsv(state);
  if (text.split("\n").length < 7) return false;
  download(new Blob([text], { type: "text/csv" }), fileName(state, "brightness", "csv"));
  return true;
}

/** A value safe to put in one CSV cell. */
function cell(text: string): string {
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** What the change finder found, as a CSV table. One row per source that moved or changed brightness. */
export function changesCsv(state: AppState): string {
  const report = state.changes;
  if (!report) return "";
  const lines = [
    `# SPHERExplorer change report for the field of ${state.target?.name ?? "a sky position"}`,
    `# ${report.sources} sources checked across ${report.visits.join(", ")}.`,
    `# Yardstick between visits: position ${report.positionScatter.toFixed(2)} arcsec, brightness ${(report.brightnessScatter * 100).toFixed(1)} percent.`,
    "# significance = the change divided by its uncertainty. A change is listed at 5 or more.",
    `# ${DATA_CREDIT}. DOIs 10.26131/IRSA678 and 10.26131/IRSA662.`,
    "name,kind,ra_deg,dec_deg,ra,dec,change,significance,rate_arcsec_per_year,rate_err,direction_deg,brightness_ratio,in_words",
  ];
  for (const change of report.changes) {
    lines.push([
      cell(change.target && state.target?.name ? state.target.name : change.object?.name ?? ""),
      cell(change.object?.kind ?? ""),
      change.ra.toFixed(6), change.dec.toFixed(6), formatRa(change.ra), formatDec(change.dec),
      change.kind, change.significance.toFixed(1),
      change.rate !== undefined ? change.rate.toFixed(2) : "", change.rateErr !== undefined ? change.rateErr.toFixed(2) : "",
      change.angle !== undefined ? change.angle.toFixed(0) : "", change.ratio !== undefined ? change.ratio.toFixed(3) : "",
      cell(describeChange(change)),
    ].join(","));
  }
  return lines.join("\n") + "\n";
}

/** Save the change report. False when the change finder has not run. */
export function exportChanges(state: AppState): boolean {
  const text = changesCsv(state);
  if (!text) return false;
  download(new Blob([text], { type: "text/csv" }), fileName(state, "changes", "csv"));
  return true;
}
