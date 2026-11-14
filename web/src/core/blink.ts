// Blinking: swapping the SPHEREx image on screen with an older survey's picture of the same
// patch of sky, back and forth. Whatever jumps between the two has moved in the years between.
// The older pictures are HiPS tile sets served by IRSA, the same ones the sky map shows.
// Written with Claude Code (Anthropic) assistance.
import { SKY_LAYERS } from "./skyLayers";
import type { AppState } from "./store";
import type { BlinkChoice } from "./types";

/** An older survey the image can be blinked against. */
export interface BlinkPartner {
  id: Exclude<BlinkChoice, "auto">;
  name: string;
  /** When its pictures were taken, in words. */
  years: string;
  /** Address of its tile set. */
  url: string;
}

function tiles(layer: string): string {
  return SKY_LAYERS.find((entry) => entry.id === layer)?.url ?? "";
}

/**
 * The partners, nearest SPHEREx in wavelength first.
 * WISE mapped the sky in 2010. 2MASS observed from 1997 to 2001. The Digitized Sky Survey
 * is scanned photographic plates, mostly from the 1980s and 1990s.
 */
export const BLINK_PARTNERS: readonly BlinkPartner[] = [
  { id: "wise-w2", name: "WISE 4.6 µm", years: "2010", url: tiles("wise-w2") },
  { id: "wise-w1", name: "WISE 3.4 µm", years: "2010", url: tiles("wise-w1") },
  { id: "2mass", name: "2MASS", years: "1997 to 2001", url: tiles("2mass") },
  { id: "dss", name: "Visible light (DSS)", years: "1980s and 1990s", url: tiles("dss") },
];

/** How long each picture stays on screen while blinking, in milliseconds. */
export const BLINK_MS = 800;

/**
 * The partner in use. With "auto" it is the one nearest in wavelength to the image on screen:
 * WISE 4.6 µm for detectors 5 and 6, WISE 3.4 µm for detector 4, and 2MASS for the rest.
 */
export function blinkPartner(state: Pick<AppState, "blink" | "sequence" | "player">): BlinkPartner {
  const choice = state.blink.choice;
  const named = BLINK_PARTNERS.find((partner) => partner.id === choice);
  if (named) return named;
  const wavelength = state.sequence[state.player.index]?.wavelength ?? 0;
  const id = wavelength >= 3.9 ? "wise-w2" : wavelength >= 2.5 ? "wise-w1" : "2mass";
  return BLINK_PARTNERS.find((partner) => partner.id === id)!;
}
