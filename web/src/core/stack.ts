// Sums frames on a common north-up grid. Adding frames raises faint sources out of the noise.
// Each frame keeps its own geometry until this step, so pixels are resampled only once.
// Written with Claude Code (Anthropic) assistance.

/** One frame going into a sum. */
export interface StackMember {
  nx: number;
  ny: number;
  /** Field center in frame pixels. */
  cx: number;
  cy: number;
  /** Pixel-to-sky matrix [de/dx, de/dy, dn/dx, dn/dy] in arcseconds per pixel. */
  m: [number, number, number, number];
  /** Background level and noise in MJy/sr. */
  bg: number;
  rms: number;
  image: Float32Array;
  flags: Uint32Array | null;
  /** Sky offset [east, north] in arcseconds to add when sampling. Used to follow a moving target. */
  shift: [number, number];
}

export interface StackOptions {
  /** Field width in arcseconds. */
  size: number;
  /** Output pixel size in arcseconds. */
  scale: number;
  /**
   * "mean" weights frames by their noise.
   * "clipped" does the same after dropping samples far from the pixel's median, which removes
   * cosmic rays and hot pixels that the flags missed.
   * "median" keeps only what most frames agree on.
   */
  method: "mean" | "clipped" | "median";
  /** Flag bits that exclude a pixel. */
  badMask: number;
}

/** A summed image. Laid out like a frame so the same renderer draws it. */
export interface Stack {
  nx: number;
  ny: number;
  cx: number;
  cy: number;
  m: [number, number, number, number];
  /** Background-subtracted mean in MJy/sr. NaN where no frame contributed. */
  image: Float32Array;
  /** Noise level of the result in MJy/sr, measured from the result itself. */
  rms: number;
  /** Frames that contributed. */
  count: number;
}

/** Samples further than this many robust sigmas from a pixel's median are dropped by "clipped". */
const CLIP_SIGMA = 4.5;
/** Clipping needs at least this many samples to judge the scatter. */
const CLIP_MIN = 5;

/** Median of the first n entries of a scratch array. Reorders the scratch array. */
function medianOf(values: Float32Array, n: number): number {
  const part = values.subarray(0, n);
  part.sort();
  return n % 2 ? part[(n - 1) / 2] : (part[n / 2 - 1] + part[n / 2]) / 2;
}

/** Robust noise estimate of an image: 1.4826 times the median absolute deviation. */
export function robustNoise(image: Float32Array): { median: number; rms: number } {
  const finite = image.filter(Number.isFinite);
  if (!finite.length) return { median: NaN, rms: NaN };
  const middle = medianOf(finite.slice(), finite.length);
  for (let i = 0; i < finite.length; i++) finite[i] = Math.abs(finite[i] - middle);
  return { median: middle, rms: 1.4826 * medianOf(finite, finite.length) };
}

export function stackFrames(members: StackMember[], options: StackOptions): Stack {
  const n = Math.max(3, Math.round(options.size / options.scale) | 1); // odd, so the center is a pixel
  const center = (n - 1) / 2;
  const scale = options.scale;
  const total = n * n;
  const sum = new Float32Array(total);
  const weight = new Float32Array(total);
  // The median and the clipped mean need every sample: one row per member.
  const samples = options.method === "mean" ? null : new Float32Array(total * members.length).fill(NaN);
  const weights = members.map((member) => (member.rms > 0 ? 1 / (member.rms * member.rms) : 0));

  members.forEach((member, index) => {
    const [a, b, c, d] = member.m;
    const det = a * d - b * c;
    if (!det || !(member.rms > 0)) return;
    // Inverse matrix: sky offset to pixel offset.
    const ia = d / det, ib = -b / det, ic = -c / det, id = a / det;
    const w = 1 / (member.rms * member.rms);
    const { image, flags, nx, ny } = member;
    for (let j = 0; j < n; j++) {
      const north = (j - center) * scale + member.shift[1];
      for (let i = 0; i < n; i++) {
        // Output x grows to the right, which is west on the sky.
        const east = -(i - center) * scale + member.shift[0];
        const px = Math.round(member.cx + ia * east + ib * north);
        const py = Math.round(member.cy + ic * east + id * north);
        if (px < 0 || py < 0 || px >= nx || py >= ny) continue;
        const at = py * nx + px;
        const value = image[at];
        if (value !== value) continue; // NaN: saturated or missing
        if (flags && flags[at] & options.badMask) continue;
        const out = j * n + i;
        if (samples) samples[index * total + out] = value - member.bg;
        else {
          sum[out] += w * (value - member.bg);
          weight[out] += w;
        }
      }
    }
  });

  const image = new Float32Array(total);
  if (samples) {
    const values = new Float32Array(members.length);
    const scratch = new Float32Array(members.length);
    const which = new Int32Array(members.length);
    const clip = options.method === "clipped";
    for (let out = 0; out < total; out++) {
      let count = 0;
      for (let k = 0; k < members.length; k++) {
        const value = samples[k * total + out];
        if (value === value) {
          values[count] = value;
          which[count++] = k;
        }
      }
      if (!count) {
        image[out] = NaN;
        continue;
      }
      scratch.set(values.subarray(0, count));
      const middle = medianOf(scratch, count);
      if (!clip) {
        image[out] = middle;
        continue;
      }
      // Scatter of this pixel across frames. A bright star varies a lot from frame to frame
      // (each frame is a different wavelength), so its own scatter sets the limit, not the sky noise.
      for (let k = 0; k < count; k++) scratch[k] = Math.abs(values[k] - middle);
      const limit = count >= CLIP_MIN ? CLIP_SIGMA * 1.4826 * medianOf(scratch, count) : Infinity;
      let top = 0;
      let bottom = 0;
      for (let k = 0; k < count; k++) {
        if (Math.abs(values[k] - middle) > limit) continue;
        top += weights[which[k]] * values[k];
        bottom += weights[which[k]];
      }
      image[out] = bottom > 0 ? top / bottom : middle;
    }
  } else {
    for (let out = 0; out < total; out++) image[out] = weight[out] > 0 ? sum[out] / weight[out] : NaN;
  }

  return {
    nx: n,
    ny: n,
    cx: center,
    cy: center,
    m: [-scale, 0, 0, scale],
    image,
    rms: robustNoise(image).rms,
    count: members.length,
  };
}
