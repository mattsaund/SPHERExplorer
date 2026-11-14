// Holds the pixel planes of loaded frames outside the reactive store.
// Typed arrays are large and never change, so components read them on demand.
// Written with Claude Code (Anthropic) assistance.
import { decodeHalf } from "./half";

export interface FramePixels {
  nx: number;
  ny: number;
  /** Image as float16 bit patterns, row by row. Ready to upload to the GPU as is. */
  half: Uint16Array;
  /** Flag bits per pixel, or null when the file had none. */
  flags: Uint32Array | null;
  /** Float32 copy of the image, decoded the first time it is needed. */
  float?: Float32Array;
}

const store = new Map<number, FramePixels>();

export function setPixels(id: number, pixels: FramePixels): void {
  store.set(id, pixels);
}

export function getPixels(id: number): FramePixels | undefined {
  return store.get(id);
}

/** The image of a frame as float32 values in MJy/sr. Empty pixels are NaN. */
export function imageOf(id: number): Float32Array | undefined {
  const pixels = store.get(id);
  if (!pixels) return undefined;
  pixels.float ??= decodeHalf(pixels.half);
  return pixels.float;
}

export function clearPixels(): void {
  store.clear();
}
