// Talks to the SPHERExplorer API: metadata, search, and the binary frame stream.
// Written with Claude Code (Anthropic) assistance.
import type { Suggestion } from "./suggest";
import type { KnownBody, Meta, MissionData, PartnerData, Photometry, SkyObject, SpacecraftInfo, Target } from "./types";

/** Base path of the API. Same origin by default. Set VITE_API_BASE to point elsewhere. */
const BASE: string = import.meta.env.VITE_API_BASE ?? "/api";

/** Absolute address of an API path, for libraries that need a full URL. */
export function apiUrl(path: string): string {
  return new URL(BASE + path, window.location.href).href;
}

/** Address of a coverage map of the SPHEREx archive, as a FITS MOC file. */
export function coverageUrl(name: "spectral-images" | "deep-fields"): string {
  return apiUrl(`/coverage/${name}`);
}

/** Address of one Level 2 image cut out around a position, as a FITS file with image, flags, and variance. */
export function fitsUrl(key: string, ra: number, dec: number, size: number, delta?: number): string {
  const query = new URLSearchParams({ key, ra: String(ra), dec: String(dec), size: String(size) });
  if (delta !== undefined) query.set("delta", String(delta));
  return apiUrl(`/fits?${query}`);
}

/** Many FITS cutouts in one zip file. The request is the one used to load the images. */
export async function fitsArchive(request: CutoutRequest, signal?: AbortSignal): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(BASE + "/fits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal });
  } catch (cause) {
    if ((cause as Error).name === "AbortError") throw cause;
    throw new ApiError("Can't reach the SPHERExplorer server. Check your connection and try again.");
  }
  if (!response.ok) {
    const detail = await response.json().then((body) => body?.detail as string | undefined, () => undefined);
    throw new ApiError(detail ?? `The server could not make the files (${response.status}).`);
  }
  return response.blob();
}

/** An error with a message fit to show a person. */
export class ApiError extends Error {
  /** The HTTP status of the answer, when the server gave one. 404 means the thing asked for does not exist. */
  status?: number;
}

/** Fetch JSON from our API. Failures become an ApiError with words fit to show a person. */
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
    const error = new ApiError(detail || `The server answered with an error (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

/** Instrument facts and the live data collections. Loaded once. */
export function getMeta(signal?: AbortSignal): Promise<Meta> {
  return getJson<Meta>("/meta", signal);
}

/** What a name lookup returns: a fixed target, or a solar system body to be followed. */
export type Resolved = Target | { moving: true; name: string; kind: string; command: string; url?: string };

/** Look up an object by name. Rejects with a plain-language ApiError when it is not found. */
export function resolveName(name: string, signal?: AbortSignal): Promise<Resolved> {
  return getJson<Resolved>(`/resolve?name=${encodeURIComponent(name.trim())}`, signal);
}

/** Search box rows that need a lookup: the typed text when it is a known name, then asteroids and comets. */
export async function getSuggestions(text: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const body = await getJson<{ suggestions: Suggestion[] }>(`/suggest?q=${encodeURIComponent(text.trim())}`, signal);
  return body.suggestions;
}

/** Every image that caught a solar system body, with the body's position in each. */
export function searchMoving(command: string, signal?: AbortSignal): Promise<SearchResult> {
  return getJson<SearchResult>(`/moving?command=${encodeURIComponent(command)}`, signal);
}

/** Known objects within `radius` degrees of a position, best known first. */
export async function getObjects(ra: number, dec: number, radius: number, limit: number, signal?: AbortSignal): Promise<SkyObject[]> {
  const body = await getJson<{ objects: SkyObject[] }>(`/objects?ra=${ra.toFixed(5)}&dec=${dec.toFixed(5)}&radius=${radius.toFixed(4)}&limit=${limit}`, signal);
  return body.objects;
}

/** Known asteroids, comets, and planets within `radius` arcseconds of a position at a moment. Slow: several seconds. */
export async function getKnown(ra: number, dec: number, mjd: number, radius: number, signal?: AbortSignal): Promise<KnownBody[]> {
  const body = await getJson<{ bodies: KnownBody[] }>(`/known?ra=${ra.toFixed(6)}&dec=${dec.toFixed(6)}&mjd=${mjd.toFixed(6)}&radius=${Math.round(radius)}`, signal);
  return body.bodies;
}

/** Gaia, 2MASS, and WISE sources within `radius` arcseconds of a position. */
export function getMissions(ra: number, dec: number, radius: number, signal?: AbortSignal): Promise<MissionData> {
  return getJson<MissionData>(`/missions?ra=${ra.toFixed(5)}&dec=${dec.toFixed(5)}&radius=${Math.round(radius)}`, signal);
}

/** Visible-light images of a position from Canada's NEOSSat. */
export function getNeossat(ra: number, dec: number, signal?: AbortSignal): Promise<PartnerData> {
  return getJson<PartnerData>(`/neossat?ra=${ra.toFixed(5)}&dec=${dec.toFixed(5)}`, signal);
}

/** Orbital elements of SPHEREx and the state of the public archive. */
export function getSpacecraft(signal?: AbortSignal): Promise<SpacecraftInfo> {
  return getJson<SpacecraftInfo>("/spacecraft", signal);
}

/** The search result as the server sends it: one array per column, rows sorted by time. */
export interface SearchResult {
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
    /** Only for a solar system body: where it was at each exposure (seen from Earth's center), its distances in au, and magnitude. */
    ra?: number[];
    dec?: number[];
    delta?: number[];
    r?: number[];
    mag?: (number | null)[];
  };
}

/** Every SPHEREx image that covers a sky position. */
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
  /** The sky position at (cx, cy), degrees. */
  ra: number;
  dec: number;
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

const MAGIC = 0x46585053; // "SPXF" read as a little-endian uint32: a plain frame
const PACKED = 0x5a585053; // "SPXZ": a packed frame

/** Decode one plain frame from its own ArrayBuffer. */
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

/** True when this browser can unpack packed frames. Every current browser can. Old ones get the older stream. */
export function canUnpack(): boolean {
  return typeof DecompressionStream === "function";
}

/** Inflate bytes that were deflated in the zlib format. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("deflate");
  const writer = stream.writable.getWriter();
  // Not awaited: the write finishes as the reader below drains the other end.
  void writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close()).catch(() => {});
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/**
 * Decode one record of the stream: a plain frame, or a packed one.
 *
 * A packed frame holds the header, then the image's high bytes and the flags deflated
 * together with each byte position gathered, then the image's low bytes as they are. The
 * server packs it that way because the low bytes are noise that no packing shrinks, while
 * the rest packs well. Here the bytes are put back in their places.
 */
export async function decodeRecord(buffer: ArrayBuffer): Promise<WireFrame> {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== PACKED) return decodeFrame(buffer);
  const headerLength = view.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerLength))) as WireHeader;
  const count = view.getUint32(8 + headerLength, true);
  const packedLength = view.getUint32(12 + headerLength, true);
  const start = 16 + headerLength;
  const plain = await inflate(new Uint8Array(buffer, start, packedLength));
  if (plain.length !== 5 * count || buffer.byteLength < start + packedLength + count) throw new ApiError("The server sent a damaged image.");
  const low = new Uint8Array(buffer, start + packedLength, count);
  const image = new Uint16Array(count);
  for (let i = 0; i < count; i++) image[i] = low[i] | (plain[i] << 8);
  // The flags follow the image's high bytes: all first bytes, then all second bytes, and so on.
  const flags = new Uint32Array(count);
  const b0 = count;
  const b1 = 2 * count;
  const b2 = 3 * count;
  const b3 = 4 * count;
  for (let i = 0; i < count; i++) flags[i] = (plain[b0 + i] | (plain[b1 + i] << 8) | (plain[b2 + i] << 16) | (plain[b3 + i] << 24)) >>> 0;
  return { header, image, flags };
}

export interface CutoutRequest {
  ra: number;
  dec: number;
  /** Field width in arcseconds. */
  size: number;
  frames: { key: string; pra?: number; pdec?: number; ra?: number; dec?: number; delta?: number }[];
}

/** How many frames may be unpacking at once. More would only pile up memory when the network outruns the unpacking. */
const UNPACKING = 12;

/**
 * Bytes as they arrive from the network, handed back in pieces of a chosen length.
 * The chunks are kept as they came and each record is copied out once, when all of it is
 * here. Joining every new chunk onto the old ones would copy a large frame many times over.
 */
class Chunks {
  private parts: Uint8Array[] = [];
  private head = 0; // index of the first chunk not used up yet
  private first = 0; // bytes of that chunk already taken
  size = 0;

  add(chunk: Uint8Array): void {
    this.parts.push(chunk);
    this.size += chunk.length;
  }

  /** The next `length` bytes, without taking them. Used to read the length of a record. */
  peek(length: number): Uint8Array {
    return this.copy(length);
  }

  /** Take the next `length` bytes, in a buffer of their own. */
  take(length: number): ArrayBuffer {
    const out = this.copy(length);
    let left = length;
    while (left > 0) {
      const room = this.parts[this.head].length - this.first;
      if (room > left) {
        this.first += left;
        left = 0;
      } else {
        left -= room;
        this.head++;
        this.first = 0;
      }
    }
    // Let go of the chunks that are used up, now and then, so the list stays short.
    if (this.head > 64) {
      this.parts.splice(0, this.head);
      this.head = 0;
    }
    this.size -= length;
    return out.buffer as ArrayBuffer;
  }

  private copy(length: number): Uint8Array {
    const out = new Uint8Array(length);
    let filled = 0;
    let skip = this.first;
    for (let index = this.head; filled < length; index++) {
      const piece = this.parts[index].subarray(skip, skip + length - filled);
      out.set(piece, filled);
      filled += piece.length;
      skip = 0;
    }
    return out;
  }
}

/**
 * Ask for many frames and receive them as they finish. onFrame runs once per frame, as each is ready.
 * The stream is a run of [uint32 length][record] records. A browser that can unpack asks for
 * packed frames, which cost the server far less to make and nothing to send a second time.
 */
export async function streamCutouts(request: CutoutRequest, onFrame: (frame: WireFrame) => void, signal?: AbortSignal): Promise<void> {
  let response: Response;
  try {
    response = await fetch(BASE + "/cutouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(canUnpack() ? { ...request, pack: true } : request),
      signal,
    });
  } catch (cause) {
    if ((cause as Error).name === "AbortError") throw cause;
    throw new ApiError("Can't reach the SPHERExplorer server. Check your connection and try again.");
  }
  if (!response.ok || !response.body) throw new ApiError(`The server could not send images (${response.status}).`);

  const reader = response.body.getReader();
  const chunks = new Chunks();
  // Frames still being unpacked. Unpacking is off the main thread, so several run at once.
  const unpacking = new Set<Promise<void>>();
  let failure: unknown = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.add(value);
    while (chunks.size >= 4) {
      const length = new DataView(chunks.peek(4).buffer).getUint32(0, true);
      if (chunks.size < 4 + length) break;
      chunks.take(4);
      const job: Promise<void> = decodeRecord(chunks.take(length)).then(
        (frame) => {
          if (!signal?.aborted) onFrame(frame);
        },
        (cause) => {
          failure ??= cause;
        },
      );
      unpacking.add(job);
      void job.finally(() => unpacking.delete(job));
      if (unpacking.size >= UNPACKING) await Promise.race(unpacking);
    }
    if (failure) break;
  }
  await Promise.all(unpacking);
  if (failure) {
    void reader.cancel().catch(() => {});
    throw failure;
  }
}
