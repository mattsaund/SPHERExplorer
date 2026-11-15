// How much this computer can hold. A phone and a workstation should not load the same number
// of images of a wide field, so the image budget follows what the browser says about the computer.
// Written with Claude Code (Anthropic) assistance.

/** What the browser tells about the computer. Any part may be missing. */
export interface Device {
  /**
   * Memory in GB, as browsers report it: rounded down to a power of two and never more than 8.
   * Firefox and Safari do not report it.
   */
  memory?: number;
  /** Processor threads. */
  cores?: number;
  /** True for a wide screen with a mouse, which a phone or a tablet does not have. */
  desktop?: boolean;
}

/**
 * The smallest budget: the image pixels held for one target on any device. Each pixel costs
 * up to 10 bytes once sums and measures are built (the image twice, and its flags), so this
 * is about 600 MB at worst.
 */
export const BASE_PIXELS = 6e7;

/**
 * The image pixels this computer may hold for one target. A computer that reports 8 GB or
 * more gets twice the smallest budget, and three times with twelve or more processor
 * threads. Without a memory figure, a wide screen with a mouse and eight threads counts as
 * a desktop and gets twice. Everything else keeps the smallest budget. The server accepts
 * up to about four times the smallest, so the largest stays inside its limit.
 */
export function pixelBudget(device: Device): number {
  const cores = device.cores ?? 4;
  if (device.memory !== undefined) {
    if (device.memory < 8) return BASE_PIXELS;
    return cores >= 12 ? 3 * BASE_PIXELS : 2 * BASE_PIXELS;
  }
  return device.desktop && cores >= 8 ? 2 * BASE_PIXELS : BASE_PIXELS;
}

/** This computer, as far as the browser tells. */
export function thisDevice(): Device {
  if (typeof navigator === "undefined") return {};
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const desktop = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1100px) and (pointer: fine)").matches;
  return { memory: typeof memory === "number" ? memory : undefined, cores: navigator.hardwareConcurrency, desktop };
}
