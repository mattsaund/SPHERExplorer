// Talks to the SPHERExplorer API: metadata, search, and the binary frame stream.
// Written with Claude Code (Anthropic) assistance.
import type { Meta, Photometry, SkyObject, Target } from "./types";

/** Base path of the API. Same origin by default. Set VITE_API_BASE to point elsewhere. */
const BASE: string = import.meta.env.VITE_API_BASE ?? "/api";

/** Absolute address of an API path, for libraries that need a full URL. */
export function apiUrl(path: string): string {
  return new URL(BASE + path, window.location.href).href;
}

/** An error with a message fit to show a person. */
export class ApiError extends Error {}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE + path, { signal });
  } catch (cause) {
    if ((cause as Error).name === "AbortError") throw cause;
    throw new ApiError("Can't reach the SPHERExplorer server. Check your connection and try again.");
  }
  if (!response.ok) {
    const detail = await response.json().then((body) => body.detail as string, () => "");
    throw new ApiError(detail || `The server answered with an error (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function getMeta(signal?: AbortSignal): Promise<Meta> {
  return getJson<Meta>("/meta", signal);
}

/** Look up an object by name. Rejects with a plain-language ApiError when it is not found. */
export function resolveName(name: string, signal?: AbortSignal): Promise<Target> {
  return getJson<Target>(`/resolve?name=${encodeURIComponent(name.trim())}`, signal);
}

/** Known objects within `radius` degrees of a position, best known first. */
export async function getObjects(ra: number, dec: number, radius: number, limit: number, signal?: AbortSignal): Promise<SkyObject[]> {
  const body = await getJson<{ objects: SkyObject[] }>(`/objects?ra=${ra.toFixed(5)}&dec=${dec.toFixed(5)}&radius=${radius.toFixed(4)}&limit=${limit}`, signal);
  return body.objects;
}

/** The search result as the server sends it: one array per column, rows sorted by time. */
export interface SearchResult {
  ra: number;
  dec: number;
  collections: string[];
  /** Collections that could not be searched this time. */
  errors: string[];
  count: number;
  frames: {
    key: string[];
    coll: number[];
    obsid: string[];
    det: number[];
    mjd: number[];
    x: number[];
    y: number[];
    wl: (number | null)[];
    bw: (number | null)[];
    chan: number[];
    pfra: number[];
    pfdec: number[];
  };
}

export function searchFrames(ra: number, dec: number, signal?: AbortSignal): Promise<SearchResult> {
  return getJson<SearchResult>(`/search?ra=${ra.toFixed(7)}&dec=${dec.toFixed(7)}`, signal);
}

/** Header of one frame on the wire. Mirrors server/spherex_api/cutout.py. */
export interface WireHeader {
  v: number;
  key: string;
  ok: boolean;
  error?: string;
  /** "outside" when the position is not on this detector, "error" for a real failure. */
  code?: string;
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  m: [number, number, number, number];
  det: number;
  mjd: number | null;
  exp: number | null;
  wl: number;
  bw: number;
  dwl: [number, number];
  chan: number;
  fwhm: number | null;
  omega: number;
  bg: number | null;
  rms: number | null;
  nan: number;
  bits: number;
  qa: { l2?: string; astrom?: number; survey?: string; airglow?: boolean; aurora?: boolean; glow?: boolean };
  phot?: Photometry;
  planes: { name: string; dtype: string; bytes: number }[];
}

/** One decoded frame: its header plus views of the pixel planes. */
export interface WireFrame {
  header: WireHeader;
  /** Image as float16 bit patterns, row by row. */
  image?: Uint16Array;
  /** Flag bits per pixel. */
  flags?: Uint32Array;
}

const MAGIC = 0x46585053; // "SPXF" read as a little-endian uint32

/** Decode one frame from its own ArrayBuffer. */
export function decodeFrame(buffer: ArrayBuffer): WireFrame {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MAGIC) throw new ApiError("The server sent data in an unknown format.");
  const headerLength = view.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerLength))) as WireHeader;
  const frame: WireFrame = { header };
  let offset = 8 + headerLength;
  for (const plane of header.planes ?? []) {
    if (plane.name === "image" && plane.dtype === "f2") frame.image = new Uint16Array(buffer, offset, plane.bytes / 2);
    else if (plane.name === "flags" && plane.dtype === "u4") frame.flags = new Uint32Array(buffer, offset, plane.bytes / 4);
    offset += plane.bytes + ((4 - (plane.bytes % 4)) % 4);
  }
  return frame;
}

export interface CutoutRequest {
  ra: number;
  dec: number;
  /** Field width in arcseconds. */
  size: number;
  frames: { key: string; pra?: number; pdec?: number }[];
}

/**
 * Ask for many frames and receive them as they finish. onFrame runs once per frame, in arrival order.
 * The stream is a run of [uint32 length][frame bytes] records.
 */
export async function streamCutouts(request: CutoutRequest, onFrame: (frame: WireFrame) => void, signal?: AbortSignal): Promise<void> {
  let response: Response;
  try {
    response = await fetch(BASE + "/cutouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (cause) {
    if ((cause as Error).name === "AbortError") throw cause;
    throw new ApiError("Can't reach the SPHERExplorer server. Check your connection and try again.");
  }
  if (!response.ok || !response.body) throw new ApiError(`The server could not send images (${response.status}).`);

  const reader = response.body.getReader();
  // Bytes received but not yet split into frames.
  let pending = new Uint8Array(0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (pending.length === 0) {
      pending = value;
    } else {
      const joined = new Uint8Array(pending.length + value.length);
      joined.set(pending);
      joined.set(value, pending.length);
      pending = joined;
    }
    let offset = 0;
    while (pending.length - offset >= 4) {
      const length = new DataView(pending.buffer, pending.byteOffset + offset, 4).getUint32(0, true);
      if (pending.length - offset - 4 < length) break;
      // Copy the frame into its own buffer so typed-array views are aligned and independent.
      const start = pending.byteOffset + offset + 4;
      onFrame(decodeFrame(pending.buffer.slice(start, start + length) as ArrayBuffer));
      offset += 4 + length;
    }
    pending = pending.subarray(offset);
  }
}
