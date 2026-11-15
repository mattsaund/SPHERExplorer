// Half-precision (float16) decoding. Frames travel as float16 to halve their size.
// Written with Claude Code (Anthropic) assistance.

/** Value of every possible 16-bit pattern, built once. */
const TABLE = new Float32Array(65536);
for (let bits = 0; bits < 65536; bits++) {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x3ff;
  let value: number;
  if (exponent === 0) value = (fraction / 1024) * 2 ** -14;
  else if (exponent === 31) value = fraction ? NaN : Infinity;
  else value = (1 + fraction / 1024) * 2 ** (exponent - 15);
  TABLE[bits] = sign * value;
}

/** One float16 bit pattern to a number. */
export function halfToFloat(bits: number): number {
  return TABLE[bits];
}

/** A whole float16 array to float32. */
export function decodeHalf(source: Uint16Array, out = new Float32Array(source.length)): Float32Array {
  for (let i = 0; i < source.length; i++) out[i] = TABLE[source[i]];
  return out;
}

/** True when a float16 bit pattern is NaN. */
export function halfIsNaN(bits: number): boolean {
  return (bits & 0x7c00) === 0x7c00 && (bits & 0x3ff) !== 0;
}
