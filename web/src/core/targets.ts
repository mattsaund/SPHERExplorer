// The five test targets NASA names in the challenge, with motion.
// Positions are ICRS at epoch 2026.0. Sources are listed in docs/research/test-targets.md.
// Written with Claude Code (Anthropic) assistance.
import type { Target } from "./types";

export const TEST_TARGETS: readonly Target[] = [
  {
    name: "Barnard's Star",
    ra: 269.446267, dec: 4.768222, epoch: 2026.0,
    pmRa: -801.551, pmDec: 10362.394, parallax: 546.976,
    kind: "Red dwarf, fastest-moving star in the sky", source: "Gaia DR3",
  },
  {
    name: "Epsilon Indi B",
    ra: 331.096656, dec: -56.800664, epoch: 2026.0,
    pmRa: 3981.977, pmDec: -2466.832, parallax: 274.843,
    kind: "Brown dwarf pair", source: "Gaia DR3",
  },
  {
    name: "WISE 0855-0714",
    ra: 133.759765, dec: -7.242182, epoch: 2026.0,
    pmRa: -8123.7, pmDec: 673.2, parallax: 439.0,
    kind: "Coldest known brown dwarf", source: "SIMBAD",
  },
  {
    name: "RW Aurigae",
    ra: 76.956083, dec: 30.401139, epoch: 2026.0,
    kind: "Young variable star pair", source: "Gaia DR3",
  },
  {
    name: "R Draconis",
    ra: 248.167233, dec: 66.755024, epoch: 2026.0,
    kind: "Pulsating red giant (Mira variable)", source: "Gaia DR3",
  },
];
