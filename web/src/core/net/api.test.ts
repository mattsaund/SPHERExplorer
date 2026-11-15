// The stream of images: packed records must unpack to the same pixels, however the network cuts the bytes.
// Written with Claude Code (Anthropic) assistance.
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeFrame, decodeRecord, streamCutouts, type WireFrame } from "./api";

/** A plain frame as the server encodes it: magic, header length, JSON header, then the planes padded to 4 bytes. */
function plainFrame(key: string, image: Uint16Array, flags: Uint32Array): Uint8Array {
  const header = { v: 1, key, ok: true, nx: image.length, ny: 1, planes: [{ name: "image", dtype: "f2", bytes: image.length * 2 }, { name: "flags", dtype: "u4", bytes: flags.length * 4 }] };
  let text = new TextEncoder().encode(JSON.stringify(header));
  const padded = new Uint8Array(text.length + ((4 - (text.length % 4)) % 4)).fill(32);
  padded.set(text);
  text = padded;
  const imageBytes = new Uint8Array(image.buffer.slice(0));
  const imagePad = (4 - (imageBytes.length % 4)) % 4;
  const out = new Uint8Array(8 + text.length + imageBytes.length + imagePad + flags.length * 4);
  const view = new DataView(out.buffer);
  out.set([0x53, 0x50, 0x58, 0x46]); // "SPXF"
  view.setUint32(4, text.length, true);
  out.set(text, 8);
  out.set(imageBytes, 8 + text.length);
  out.set(new Uint8Array(flags.buffer.slice(0)), 8 + text.length + imageBytes.length + imagePad);
  return out;
}

/** The same frame packed the way the server packs it: high bytes and gathered flag bytes deflated, low bytes as they are. */
function packedFrame(plain: Uint8Array, count: number): Uint8Array {
  const view = new DataView(plain.buffer);
  const headerLength = view.getUint32(4, true);
  const imageAt = 8 + headerLength;
  const flagsAt = imageAt + 2 * count + ((4 - ((2 * count) % 4)) % 4);
  const gathered = new Uint8Array(5 * count);
  const low = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    low[i] = plain[imageAt + 2 * i];
    gathered[i] = plain[imageAt + 2 * i + 1];
    for (let b = 0; b < 4; b++) gathered[count + b * count + i] = plain[flagsAt + 4 * i + b];
  }
  const squeezed = deflateSync(gathered, { level: 1 });
  const out = new Uint8Array(8 + headerLength + 8 + squeezed.length + count);
  const outView = new DataView(out.buffer);
  out.set([0x53, 0x50, 0x58, 0x5a]); // "SPXZ"
  outView.setUint32(4, headerLength, true);
  out.set(plain.subarray(8, 8 + headerLength), 8);
  outView.setUint32(8 + headerLength, count, true);
  outView.setUint32(12 + headerLength, squeezed.length, true);
  out.set(squeezed, 16 + headerLength);
  out.set(low, 16 + headerLength + squeezed.length);
  return out;
}

/** Pixels that exercise every byte: NaN, infinities, negatives, and flags in every byte position. */
function pixels(count: number, seed: number): { image: Uint16Array; flags: Uint32Array } {
  const image = new Uint16Array(count);
  const flags = new Uint32Array(count);
  let state = seed * 2654435761 + 1;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < count; i++) {
    image[i] = next() & 0xffff;
    flags[i] = next() % 5 === 0 ? next() : 0;
  }
  if (count > 3) {
    image[0] = 0x7e00; // NaN
    image[1] = 0xfc00; // minus infinity
    flags[2] = 0xffffffff;
    flags[3] = 1 << 21;
  }
  return { image, flags };
}

describe("decodeRecord", () => {
  it("unpacks a packed frame to the same pixels as the plain one", async () => {
    for (const count of [1, 2, 3, 5, 64, 4761, 173_889]) {
      const { image, flags } = pixels(count, count);
      const plain = plainFrame("k", image, flags);
      const fromPlain = decodeFrame(plain.buffer.slice(0) as ArrayBuffer);
      const fromPacked = await decodeRecord(packedFrame(plain, count).buffer as ArrayBuffer);
      expect(fromPacked.header).toEqual(fromPlain.header);
      expect(fromPacked.image).toEqual(image);
      expect(fromPacked.flags).toEqual(flags);
      expect(fromPlain.image).toEqual(image);
      expect(fromPlain.flags).toEqual(flags);
    }
  });
  it("reads a plain record as before, such as a frame that failed", async () => {
    const text = new TextEncoder().encode(JSON.stringify({ v: 1, key: "k", ok: false, error: "nope", code: "error", planes: [] }) + "  ");
    const failed = new Uint8Array(8 + text.length - (text.length % 4));
    failed.set([0x53, 0x50, 0x58, 0x46]);
    new DataView(failed.buffer).setUint32(4, text.length - (text.length % 4), true);
    failed.set(text.subarray(0, text.length - (text.length % 4)), 8);
    const frame = await decodeRecord(failed.buffer as ArrayBuffer);
    expect(frame.header.ok).toBe(false);
    expect(frame.image).toBeUndefined();
  });
  it("refuses a record that was cut short", async () => {
    const { image, flags } = pixels(100, 9);
    const packed = packedFrame(plainFrame("k", image, flags), 100);
    await expect(decodeRecord(packed.buffer.slice(0, packed.length - 10) as ArrayBuffer)).rejects.toThrow();
  });
});

describe("streamCutouts", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A stream body: each record with its length in front, cut into chunks of the given sizes, over and over. */
  function respond(records: Uint8Array[], cuts: number[]): Response {
    let total = 0;
    for (const record of records) total += 4 + record.length;
    const body = new Uint8Array(total);
    let offset = 0;
    for (const record of records) {
      new DataView(body.buffer).setUint32(offset, record.length, true);
      body.set(record, offset + 4);
      offset += 4 + record.length;
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let at = 0;
        for (let i = 0; at < body.length; i++) {
          const size = cuts[i % cuts.length];
          controller.enqueue(body.slice(at, at + size));
          at += size;
        }
        controller.close();
      },
    });
    return new Response(stream, { status: 200 });
  }

  it("asks for packed frames and puts them together however the bytes are cut", async () => {
    const made = [3, 700, 4761, 50_000, 1, 9000].map((count, index) => ({ key: `k${index}`, ...pixels(count, index + 1) }));
    const records = made.map((frame) => packedFrame(plainFrame(frame.key, frame.image, frame.flags), frame.image.length));
    // Pieces of one or two bytes are tried on the two small frames only. On the large ones they
    // would make hundreds of thousands of chunks, which no network does and no test should wait for.
    const cases: [number, number[]][] = [[2, [1]], [2, [2, 1, 3]], [6, [1000, 1, 7]], [6, [4096]], [6, [65_536]], [6, [10_000_000]]];
    for (const [howMany, cuts] of cases) {
      const part = made.slice(0, howMany);
      let sent: unknown = null;
      vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
        sent = JSON.parse(init.body as string);
        return respond(records.slice(0, howMany), cuts);
      });
      const got: WireFrame[] = [];
      await streamCutouts({ ra: 1, dec: 2, size: 300, frames: part.map((frame) => ({ key: frame.key })) }, (frame) => got.push(frame));
      expect((sent as { pack?: boolean }).pack).toBe(true);
      expect(got.length).toBe(part.length);
      for (const frame of part) {
        const match = got.find((candidate) => candidate.header.key === frame.key)!;
        expect(match.image).toEqual(frame.image);
        expect(match.flags).toEqual(frame.flags);
      }
    }
  });

  it("stops with an error when a record is damaged", async () => {
    const { image, flags } = pixels(500, 3);
    const packed = packedFrame(plainFrame("k", image, flags), 500);
    packed[packed.length - 600] ^= 0xff; // spoil the deflated part
    packed[30 + 500] ^= 0x55;
    const damaged = packed.slice(0, packed.length - 3);
    vi.stubGlobal("fetch", async () => respond([damaged], [4096]));
    await expect(streamCutouts({ ra: 1, dec: 2, size: 300, frames: [{ key: "k" }] }, () => {})).rejects.toThrow();
  });
});
