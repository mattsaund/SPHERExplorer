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
  /**
   * Background-subtracted mean in MJy/sr. NaN where no frame covers the pixel.
   * Infinity where frames cover it but every sample was saturated or flagged.
   */
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
/** Up to this many frames, "clipped" keeps every sample and uses medians. Beyond it, two passes. */
const SORT_LIMIT = 48;
/** Beyond SORT_LIMIT frames, samples further than this many standard deviations from the mean are dropped. */
const MEAN_CLIP_SIGMA = 3.5;
/** Rounds of finding the mean and spread before the final sum. */
const CLIP_ROUNDS = 3;

/** Up to this many values, a plain insertion sort beats the built-in sort, which costs a call and a new view each time. */
const SMALL_SORT = 64;

/** Median of the first n entries of a scratch array. Reorders the scratch array. */
function medianOf(values: Float32Array, n: number): number {
  if (n <= SMALL_SORT) {
    for (let i = 1; i < n; i++) {
      const value = values[i];
      let j = i - 1;
      while (j >= 0 && values[j] > value) {
        values[j + 1] = values[j];
        j--;
      }
      values[j + 1] = value;
    }
  } else {
    values.subarray(0, n).sort();
  }
  return n % 2 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;
}

/**
 * Move the k-th smallest of the first n entries into place k, with nothing larger before it
 * and nothing smaller after it. Much cheaper than sorting when only the middle is wanted.
 */
function select(values: Float32Array, n: number, k: number): number {
  let low = 0;
  let high = n - 1;
  while (high > low) {
    // The middle of three as the dividing value, which keeps sorted input from being the slow case.
    const mid = (low + high) >>> 1;
    let a = values[low];
    let b = values[mid];
    let c = values[high];
    if (b < a) [a, b] = [b, a];
    if (c < a) [a, c] = [c, a];
    if (c < b) [b, c] = [c, b];
    const pivot = b;
    let i = low;
    let j = high;
    while (i <= j) {
      while (values[i] < pivot) i++;
      while (values[j] > pivot) j--;
      if (i <= j) {
        const swap = values[i];
        values[i] = values[j];
        values[j] = swap;
        i++;
        j--;
      }
    }
    if (k <= j) high = j;
    else if (k >= i) low = i;
    else break;
  }
  return values[k];
}

/** Median of the first n entries of a large scratch array, without sorting all of it. Reorders the array. */
function middleOf(values: Float32Array, n: number): number {
  const upper = select(values, n, n >> 1);
  if (n % 2) return upper;
  // For an even count the other middle value is the largest of those placed before it.
  let lower = -Infinity;
  for (let i = 0; i < n >> 1; i++) if (values[i] > lower) lower = values[i];
  return (lower + upper) / 2;
}

/** Robust noise estimate of an image: 1.4826 times the median absolute deviation. */
export function robustNoise(image: Float32Array): { median: number; rms: number } {
  const finite = new Float32Array(image.length);
  let n = 0;
  for (let i = 0; i < image.length; i++) {
    const value = image[i];
    if (value - value === 0) finite[n++] = value; // true for finite numbers only
  }
  if (!n) return { median: NaN, rms: NaN };
  const middle = middleOf(finite, n);
  for (let i = 0; i < n; i++) finite[i] = Math.abs(finite[i] - middle);
  return { median: middle, rms: 1.4826 * middleOf(finite, n) };
}

/** A member with the numbers the sampling loop needs worked out once. */
interface Source {
  member: StackMember;
  /** Sky offset to pixel offset: the inverse of the member's matrix. */
  ia: number;
  ib: number;
  ic: number;
  id: number;
}

/**
 * The output is built a band of rows at a time, and this is about how many bytes of samples
 * one band may hold. A band several rows thick lets each frame be read in one compact strip,
 * which is what keeps the processor's cache useful. A band of the whole image would need
 * hundreds of megabytes for a deep sum of a wide field.
 */
const BAND_BYTES = 32 << 20;

/**
 * Put a member's samples for output rows j0 to j1 into `into`, starting at `base`.
 * An entry is the frame's own value where the frame has a usable pixel, and NaN elsewhere.
 * `covered` counts the frames that reach each output pixel, usable or not.
 */
function resample(source: Source, n: number, scale: number, badMask: number, j0: number, j1: number, into: Float32Array, base: number, covered: Uint16Array): void {
  const { member, ia, ib, ic, id } = source;
  const { image, flags, nx, ny, cx, cy } = member;
  const shiftEast = member.shift[0];
  const shiftNorth = member.shift[1];
  const center = (n - 1) / 2;
  let at = base;
  let out = j0 * n;
  for (let j = j0; j < j1; j++) {
    const north = (j - center) * scale + shiftNorth;
    const rowX = ib * north;
    const rowY = id * north;
    for (let i = 0; i < n; i++, at++, out++) {
      // Output x grows to the right, which is west on the sky.
      const east = -(i - center) * scale + shiftEast;
      const px = Math.round(cx + ia * east + rowX);
      const py = Math.round(cy + ic * east + rowY);
      if (px < 0 || py < 0 || px >= nx || py >= ny) {
        into[at] = NaN;
        continue;
      }
      covered[out]++;
      const pixel = py * nx + px;
      // A NaN in the frame (saturated or missing) carries over as it is.
      into[at] = flags !== null && flags[pixel] & badMask ? NaN : image[pixel];
    }
  }
}

/** Sum frames onto one north-up grid: each is resampled to the grid, its background removed, and outliers dropped. */
export function stackFrames(members: StackMember[], options: StackOptions): Stack {
  const n = Math.max(3, Math.round(options.size / options.scale) | 1); // odd, so the center is a pixel
  const center = (n - 1) / 2;
  const scale = options.scale;
  const total = n * n;
  // Counts frames that cover each output pixel, whether or not the sample was usable.
  const covered = new Uint16Array(total);
  const image = new Float32Array(total);

  // A member with no noise estimate or a flat matrix cannot be placed or weighted, so it is left out.
  const sources: Source[] = [];
  for (const member of members) {
    const [a, b, c, d] = member.m;
    const det = a * d - b * c;
    if (!det || !(member.rms > 0)) continue;
    sources.push({ member, ia: d / det, ib: -b / det, ic: -c / det, id: a / det });
  }
  const count = sources.length;
  const room = Math.max(1, count);
  const backgrounds = Float64Array.from(sources, (source) => source.member.bg);
  const weights = Float64Array.from(sources, (source) => 1 / (source.member.rms * source.member.rms));

  // Keeping every sample for a per-pixel median costs time in proportion to the number of
  // frames. Past a few dozen frames, clip against the mean and spread instead, which needs
  // a few quick passes over the samples.
  const keepSamples = options.method === "median" || (options.method === "clipped" && members.length <= SORT_LIMIT);
  const clip = options.method === "clipped";

  // Every member is resampled once into the band. Each output pixel then gathers its own
  // samples into a short list, and all the passes run over that list.
  const rows = Math.max(1, Math.min(n, Math.floor(BAND_BYTES / (4 * n * room))));
  const band = rows * n;
  const samples = new Float32Array(band * room);
  // One pixel's usable samples, background removed, and the weight of the frame each came from.
  const values = new Float64Array(room);
  const single = new Float32Array(room);
  const scratch = new Float32Array(room);
  const worth = new Float64Array(room);

  for (let j0 = 0; j0 < n; j0 += rows) {
    const j1 = Math.min(n, j0 + rows);
    const size = (j1 - j0) * n;
    const first = j0 * n;
    for (let k = 0; k < count; k++) resample(sources[k], n, scale, options.badMask, j0, j1, samples, k * band, covered);

    for (let p = 0; p < size; p++) {
      const out = first + p;
      let have = 0;

      if (keepSamples) {
        for (let k = 0, at = p; k < count; k++, at += band) {
          // Rounded to single precision, the form these samples have always been kept in.
          const value = Math.fround(samples[at] - backgrounds[k]);
          if (value === value) {
            single[have] = value;
            worth[have++] = weights[k];
          }
        }
        if (!have) {
          image[out] = covered[out] ? Infinity : NaN;
          continue;
        }
        for (let k = 0; k < have; k++) scratch[k] = single[k];
        const middle = medianOf(scratch, have);
        if (!clip) {
          image[out] = middle;
          continue;
        }
        // Scatter of this pixel across frames. A bright star varies a lot from frame to frame
        // (each frame is a different wavelength), so its own scatter sets the limit, not the sky noise.
        for (let k = 0; k < have; k++) scratch[k] = Math.abs(single[k] - middle);
        const bound = have >= CLIP_MIN ? CLIP_SIGMA * 1.4826 * medianOf(scratch, have) : Infinity;
        let top = 0;
        let bottom = 0;
        for (let k = 0; k < have; k++) {
          if (Math.abs(single[k] - middle) > bound) continue;
          top += worth[k] * single[k];
          bottom += worth[k];
        }
        image[out] = bottom > 0 ? top / bottom : middle;
        continue;
      }

      for (let k = 0, at = p; k < count; k++, at += band) {
        const value = samples[at] - backgrounds[k];
        if (value === value) {
          values[have] = value;
          worth[have++] = weights[k];
        }
      }
      if (!have) {
        image[out] = covered[out] ? Infinity : NaN;
        continue;
      }
      // The mean and the limit are rounded to single precision after each round, as they always were.
      let mean = 0;
      let limit = Infinity;
      let kept = have;
      if (clip) {
        // Find the mean and spread of the pixel across frames, then repeat using only the samples
        // inside the limit. One round is not enough: a single huge outlier widens the spread so
        // much that smaller ones hide behind it.
        for (let round = 0; round < CLIP_ROUNDS; round++) {
          let plain = 0;
          let squares = 0;
          kept = 0;
          for (let k = 0; k < have; k++) {
            const value = values[k];
            if (Math.abs(value - mean) > limit) continue;
            plain += value;
            squares += value * value;
            kept++;
          }
          if (kept) {
            mean = Math.fround(plain / kept);
            limit = Math.fround(MEAN_CLIP_SIGMA * Math.sqrt(Math.max(0, squares / kept - mean * mean)));
          }
        }
      }
      // Weighted mean of the samples that sit within the final limit.
      let sum = 0;
      let weight = 0;
      for (let k = 0; k < have; k++) {
        const value = values[k];
        if (Math.abs(value - mean) > limit) continue;
        sum += worth[k] * value;
        weight += worth[k];
      }
      image[out] = weight > 0 ? sum / weight : kept ? mean : covered[out] ? Infinity : NaN;
    }
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
