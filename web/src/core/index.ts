// The only door into the engine. UI code imports from here and nothing deeper.
// A change to an exported name or type is a contract change. See docs/architecture.md.
// Written with Claude Code (Anthropic) assistance.
export type {
  ColorMap,
  DisplaySettings,
  Filters,
  FlagBit,
  Frame,
  FrameStatus,
  Hover,
  LoadState,
  Meta,
  Photometry,
  Player,
  SequenceItem,
  SequenceMode,
  SkyPosition,
  SpectrumSettings,
  Stretch,
  Target,
  Visit,
} from "./types";
export type { LineFamily, SpectralFeature } from "./lines";
export type { SpectrumBin, SpectrumPoint } from "./spectrum";
export type { AppState, View } from "./store";
export { actions, useStore } from "./store";
export { TEST_TARGETS } from "./targets";
export { COLOR_MAPS } from "./colormaps";
export { formatDate, formatDec, formatMonth, formatRa, mjdToDate, mjdToYear, parseCoordinates } from "./astro";
export { formatWavelength } from "./sequence";
export { FrameView } from "./FrameView";
export { SpectrumPlot } from "./SpectrumPlot";
export { Timeline } from "./Timeline";
export { LINE_FAMILIES } from "./lines";
export { abMagnitude, binSpectrum, formatFlux, spectrumOf } from "./spectrum";
