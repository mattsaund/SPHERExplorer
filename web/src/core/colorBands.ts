// Ready-made choices for full-color images: which wavelengths become red, green, and blue.
// The longest wavelengths are always red, as in most infrared color pictures.
// Written with Claude Code (Anthropic) assistance.
import type { ColorBands } from "./types";

export const COLOR_PRESETS: ColorBands[] = [
  {
    id: "wide", name: "Full range",
    about: "The whole SPHEREx range in thirds. Hot stars look blue-white. Cool and dusty objects look red.",
    blue: [0.74, 1.65], green: [1.65, 3.82], red: [3.82, 5.01],
  },
  {
    id: "short", name: "Starlight",
    about: "Detectors 1, 2, and 3. Close to the colors of other near-infrared sky surveys.",
    blue: [0.74, 1.11], green: [1.11, 1.65], red: [1.65, 2.42],
  },
  {
    id: "long", name: "Cool objects",
    about: "Detectors 4, 5, and 6. Brown dwarfs, dust, and gas clouds stand out.",
    blue: [2.42, 3.82], green: [3.82, 4.42], red: [4.42, 5.01],
  },
  {
    id: "ice", name: "Water ice",
    about: "Green sits on the 3 micron band where water ice absorbs. Icy sources turn magenta.",
    blue: [2.42, 2.8], green: [2.9, 3.25], red: [3.4, 3.82],
  },
];
