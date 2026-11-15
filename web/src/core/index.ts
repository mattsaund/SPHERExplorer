// The only door into the engine. UI code imports from here and nothing deeper.
// A change to an exported name or type is a contract change. See docs/architecture.md.
//
// The engine's folders:
//   state/    the store, the link in the address bar, and the selected field
//   search/   the search box's suggestions and its lists of well-known objects
//   net/      calls to the SPHERExplorer server
//   sky/      positions, motions, orbits, and the sky map's layers
//   images/   frames, sums, color, and the WebGL renderer
//   science/  brightness, spectra, features, motion, and the change finder
//   export/   saved pictures, animations, and FITS files
//   views/    the React components that draw the map, the images, and the plots
// Written with Claude Code (Anthropic) assistance.
export type {
  BlinkChoice,
  BlinkState,
  ColorBands,
  ColorMap,
  DisplaySettings,
  Distance,
  Filters,
  FlagBit,
  Frame,
  FrameStatus,
  GaiaSource,
  Hover,
  KnownBody,
  KnownCheck,
  Layout,
  LoadState,
  MapState,
  Measurement,
  Meta,
  MissionData,
  PartnerData,
  PartnerImage,
  Photometry,
  Player,
  Screen,
  SequenceItem,
  SequenceMode,
  SkyObject,
  SkyPosition,
  SpacecraftInfo,
  SpacecraftNow,
  SpectrumSettings,
  Stretch,
  Subtract,
  SurveyBand,
  SurveyPoint,
  SurveySource,
  Target,
  Telescope,
  Visit,
} from "./types";
export type { LineFamily, SpectralFeature } from "./science/lines";
export type { SpectrumBin, SpectrumPoint } from "./science/spectrum";
export type { AppState, View } from "./state/store";
export { actions, useStore } from "./state/store";
export { TEST_TARGETS } from "./search/targets";
export { COLOR_MAPS } from "./images/colormaps";
export { distanceMethod, formatAngle, formatAu, formatDate, formatDec, formatDistance, formatMonth, formatRa, mjdToDate, mjdToYear, parseCoordinates } from "./sky/astro";
export { formatWavelength } from "./images/sequence";
export { fieldCenter, fieldDate, fieldIsNow, isStudied } from "./state/field";
export { FrameView } from "./views/FrameView";
export { SpectrumPlot } from "./views/SpectrumPlot";
export { Timeline } from "./views/Timeline";
export { LINE_FAMILIES } from "./science/lines";
export { DEFAULT_APERTURE, abMagnitude, binSpectrum, formatFlux, spectrumOf } from "./science/spectrum";
export { currentSpectrum, spectrumTrust } from "./science/measure";
export { SkyMap } from "./views/SkyMap";
export { PROJECTIONS, SKY_LAYERS } from "./sky/skyLayers";
export type { ProjectionId, SkyLayer } from "./sky/skyLayers";
export { COLOR_PRESETS } from "./images/colorBands";
export type { LinkOptions, LinkState } from "./state/url";
export { EMBED_SIZE } from "./state/url";
export { surveyPoints } from "./sky/surveys";
export { LightCurvePlot } from "./views/LightCurvePlot";
export { formatChange, lightCurve } from "./science/lightcurve";
export type { LightCurve, LightPoint, VisitChange } from "./science/lightcurve";
export { DATA_CREDIT, spectrumCsv } from "./export/export";
export { OrbitView } from "./views/OrbitView";
export { compass } from "./science/motion";
export type { MotionFit, MotionPoint } from "./science/motion";
export { changeLabel, describeChange } from "./science/changes";
export type { BandChange, ChangeKind, ChangeLevel, ChangePlace, ChangeReport, CheckedSource, FoundChange } from "./science/changes";
export type { Suggestion } from "./search/suggest";
export { describeFeature, spectrumFeatures } from "./science/features";
export { BLINK_PARTNERS, blinkPartner } from "./images/blink";
export type { BlinkPartner } from "./images/blink";
export type { FeatureFinding, FeatureReport } from "./science/features";
