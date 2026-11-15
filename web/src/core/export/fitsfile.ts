// Writes a small FITS image file in the browser: one two-dimensional float image with a plain
// header. Used to save a summed image, which exists only in the browser.
// Single exposures are saved by the server instead, which copies the archive's own pixels.
// Written with Claude Code (Anthropic) assistance.

/** A header line: a keyword, its value, and an optional comment. */
export type FitsCard = [key: string, value: string | number | boolean, comment?: string];

const BLOCK = 2880;

/** One 80-character header line, in the fixed layout every FITS reader accepts. */
export function fitsCard(key: string, value: string | number | boolean, comment = ""): string {
  let field: string;
  if (typeof value === "boolean") {
    field = (value ? "T" : "F").padStart(20);
  } else if (typeof value === "number") {
    // Integers as they are. Other numbers with enough digits for float64, never longer than the field.
    const text = Number.isInteger(value) ? String(value) : value.toPrecision(15).replace(/\.?0+(e|$)/, "$1").replace("e+", "E").replace("e", "E");
    field = text.padStart(20);
  } else {
    // A quote inside a string is doubled, and the quoted text is at least eight characters.
    field = `'${value.replace(/'/g, "''").padEnd(8)}'`.padEnd(20);
  }
  const line = `${key.toUpperCase().padEnd(8)}= ${field}${comment ? ` / ${comment}` : ""}`;
  return line.slice(0, 80).padEnd(80);
}

/** A comment line of the header. Long text is split over several lines. */
export function fitsComment(text: string): string[] {
  const lines: string[] = [];
  for (let start = 0; start < text.length; start += 72) lines.push(`COMMENT ${text.slice(start, start + 72)}`.padEnd(80));
  return lines;
}

/**
 * A FITS file holding one float32 image of nx by ny pixels. Row 0 of `image` is the first row
 * in the file, which FITS readers draw at the bottom. Values that are not finite are written
 * as NaN, the FITS way of saying "no data".
 */
export function writeFits(image: Float32Array, nx: number, ny: number, cards: FitsCard[], comments: string[] = []): Blob {
  const lines = [
    fitsCard("SIMPLE", true, "a standard FITS file"),
    fitsCard("BITPIX", -32, "32-bit floating point"),
    fitsCard("NAXIS", 2),
    fitsCard("NAXIS1", nx),
    fitsCard("NAXIS2", ny),
    ...cards.map(([key, value, comment]) => fitsCard(key, value, comment)),
    ...comments.flatMap(fitsComment),
    "END".padEnd(80),
  ];
  const header = lines.join("").padEnd(Math.ceil((lines.length * 80) / BLOCK) * BLOCK);
  const dataBytes = nx * ny * 4;
  const data = new DataView(new ArrayBuffer(Math.ceil(dataBytes / BLOCK) * BLOCK));
  for (let i = 0; i < nx * ny; i++) {
    const value = image[i];
    data.setFloat32(i * 4, Number.isFinite(value) ? value : NaN, false); // FITS is big-endian
  }
  return new Blob([new TextEncoder().encode(header), data.buffer], { type: "application/fits" });
}
