// Shared types for the SPHERExplorer engine. Part of the frontend contract.
// Written with Claude Code (Anthropic) assistance.

/** A position on the sky. Angles are ICRS degrees. */
export interface SkyPosition {
  ra: number;
  dec: number;
}

/** How far away an object is, and how that is known. */
export interface Distance {
  /** Distance in parsecs. For "redshift" this is where the object is now, after the universe expanded. */
  parsecs: number;
  /** "parallax" (measured shift against the background), "measured" (a published value), or "redshift". */
  method: "parallax" | "measured" | "redshift";
  /** For redshift distances: how many years the light has traveled. */
  lightTravelYears?: number;
}

/** A place on the sky, with optional motion so it can be followed through time. */
export interface Target extends SkyPosition {
  /** Display name, if the target was found by name. */
  name?: string;
  /** Julian year the position refers to, for example 2016.0. */
  epoch: number;
  /** Proper motion in mas per year. pmRa includes the cos(dec) factor. */
  pmRa?: number;
  pmDec?: number;
  /** Parallax in mas. */
  parallax?: number;
  /** Object type in plain words, for example "Brown dwarf". */
  kind?: string;
  /** Where the position came from, for example "SIMBAD". */
  source?: string;
  /** How far away it is, when known. Solar system bodies carry their distance on each frame instead. */
  distance?: Distance | null;
  /** A page that lists everything known about the object (SIMBAD, or JPL for solar system bodies). */
  url?: string | null;
  /**
   * Set for a solar system body, which is somewhere else in every image.
   * `command` is its identifier at JPL Horizons. ra and dec then hold its latest observed position.
   */
  moving?: { command: string };
}

/** Progress of anything that loads. */
export type LoadState = "idle" | "loading" | "ready" | "failed";

/** One flag bit of the SPHEREx FLAGS plane. */
export interface FlagBit {
  bit: number;
  name: string;
  /** Plain-language meaning. */
  text: string;
  /** True when the bit makes a pixel unusable for measurement. */
  mask: boolean;
}

/** Instrument facts and live data collections, loaded once from the API. */
export interface Meta {
  version: string;
  /** Names of the IRSA collections being searched, for example "spherex_dr1". */
  collections: string[];
  /** Arcseconds per detector pixel. */
  pixelScale: number;
  /** Wavelength range in microns and resolving power per detector, keyed "1" to "6". */
  detectors: Record<string, { min: number; max: number; r: number }>;
  /** Central wavelength in microns of the 102 spectral channels. */
  channels: number[];
  flags: FlagBit[];
  /** All flag bits with mask = true, combined. */
  badMask: number;
  /** Flag bits that exclude a pixel when frames are summed. */
  stackMask: number;
  /** Facts about the exposure index behind the search, or null when IRSA is searched live. */
  index: { exposures: number; built: string; newest: number | null; releases: string[] } | null;
}

/** PSF-fit brightness of the target in one frame. */
export interface Photometry {
  /** Flux density in microjansky, or null when it could not be measured. */
  flux: number | null;
  /** One-sigma uncertainty in microjansky. */
  err: number | null;
  /** Local sky level and scatter in MJy/sr. */
  sky: number | null;
  skyRms: number | null;
  /** Share of the PSF weight that fell on usable pixels, 0 to 1. */
  frac: number;
  /** Flag bits found within 1.5 pixels of the target. */
  bits: number;
  /** Saturated (empty) pixels within 1.5 pixels of the target. */
  nan: number;
  /** Measured position in frame pixels. */
  x: number;
  y: number;
}

/**
 * Where a frame stands. "outside" means the search expected the target on this detector
 * but it fell just past the edge. Such frames are left out without counting as failures.
 */
export type FrameStatus = "pending" | "ready" | "failed" | "outside";

/** One visit of the survey to the field. */
export interface Visit {
  /** Visit number, counting from 0. Matches Frame.season. */
  season: number;
  /** First and last exposure, Modified Julian Date. */
  start: number;
  end: number;
  /** Short name, for example "May 2025". */
  label: string;
  /** Images taken during the visit. */
  count: number;
}

/**
 * One SPHEREx exposure of the target on one detector.
 * Fields in the first group are known right after the search. The rest arrive with the pixels.
 */
export interface Frame {
  /** Position in the search result. Stable for the life of a target. */
  id: number;
  /** File key in the SPHEREx S3 bucket. */
  key: string;
  /** IRSA collection the frame came from. */
  collection: string;
  obsId: string;
  /** Detector array, 1 to 6. */
  detector: number;
  /** Exposure midpoint, Modified Julian Date (UTC). */
  mjd: number;
  /** Wavelength and bandwidth at the target in microns. Estimated until status is "ready". */
  wavelength: number;
  bandwidth: number;
  /** Index of the nearest of the 102 spectral channels. */
  channel: number;
  /** Which visit of the survey to this field, counting from 0. */
  season: number;
  /** Where the target is at this frame's time, after proper motion and parallax. */
  track: SkyPosition;
  /** Sky shift [east, north] in arcseconds per arcsecond of parallax at this frame's time. */
  parallaxFactor?: [number, number];
  /**
   * The sky position this frame is centered on. Normally the field center.
   * For a solar system body it is the body's own position at the time of the frame.
   */
  center?: SkyPosition;
  /** For a solar system body: distance from Earth and from the Sun in au, and predicted magnitude. */
  earthDistance?: number;
  sunDistance?: number;
  magnitude?: number | null;
  status: FrameStatus;
  /** Why the frame failed, in plain words. */
  error?: string;

  /** Frame size in pixels. */
  nx?: number;
  ny?: number;
  /** Field center in frame pixels. */
  cx?: number;
  cy?: number;
  /** Pixel-to-sky matrix [de/dx, de/dy, dn/dx, dn/dy] in arcseconds per pixel. */
  m?: [number, number, number, number];
  /** Wavelength change per pixel in x and y, in microns. */
  dwl?: [number, number];
  /** Median background and robust scatter in MJy/sr. */
  bg?: number | null;
  rms?: number | null;
  /** PSF width in arcseconds. */
  fwhm?: number | null;
  /** All flag bits present in the frame, combined. */
  bits?: number;
  /** Count of saturated (empty) pixels in the frame. */
  nan?: number;
  /** Quality notes from the pipeline. */
  qa?: { l2?: string; astrom?: number; survey?: string; airglow?: boolean; aurora?: boolean; glow?: boolean };
  phot?: Photometry;
}

/** How the playable sequence is built from the frames. */
export type SequenceMode =
  /** Every exposure, in time order. */
  | "exposures"
  /** One summed image per visit. Best for motion. */
  | "visits"
  /** One summed image per spectral channel. A sweep through wavelength. */
  | "channels"
  /** Everything summed into a single deep image. */
  | "deep";

/** One step of the playable sequence: a single frame or a sum of frames. */
export interface SequenceItem {
  /** Stable identity, used to cache sums. */
  key: string;
  /** Short label, for example "Nov 2025" or "4.61 µm". */
  label: string;
  /** Frames that make up this step. */
  frameIds: number[];
  /** Mean time and wavelength of the members. */
  mjd: number;
  wavelength: number;
}

/** Brightness mapping curves. */
export type Stretch = "linear" | "sqrt" | "log" | "asinh";

/** Color tables for images. */
export type ColorMap = "gray" | "viridis" | "magma" | "inferno" | "plasma" | "cividis";

/** Three wavelength ranges, in microns, that make the red, green, and blue of a color image. */
export interface ColorBands {
  id: string;
  /** Short name for menus. */
  name: string;
  /** One sentence on what the colors show. */
  about: string;
  red: [number, number];
  green: [number, number];
  blue: [number, number];
}

/** How images are drawn. */
export interface DisplaySettings {
  /**
   * Full color. Summed images are built three times, from three wavelength ranges, and shown
   * as red, green, and blue. Single exposures hold one wavelength, so they stay in one color.
   */
  color: boolean;
  /** The wavelength ranges used for full color. */
  bands: ColorBands;
  stretch: Stretch;
  /** Black and white points. In noise units when normalize is on, else MJy/sr above background. */
  lo: number;
  hi: number;
  colorMap: ColorMap;
  invert: boolean;
  /** Smooth between pixels instead of showing them as squares. */
  smooth: boolean;
  /** Scale each frame by its own noise so the look stays steady across wavelengths. */
  normalize: boolean;
  /** Tint pixels the pipeline flagged as unusable. */
  showFlags: boolean;
  /** Mark the target's expected position. */
  showMarker: boolean;
  /** Label known objects in the field. */
  showObjects: boolean;
  /** Mark Gaia stars at their position for the date of each image. */
  showGaia: boolean;
  /** Mark what the change finder found on the image. */
  showChanges: boolean;
}

/** Which frames take part. */
export interface Filters {
  /** One switch per detector, index 0 is detector 1. */
  detectors: boolean[];
  /** Wavelength window in microns. */
  wlMin: number;
  wlMax: number;
}

/** Playback state. */
export interface Player {
  /** Current step of the sequence. */
  index: number;
  playing: boolean;
  /** Steps per second. */
  fps: number;
}

/** What is under the pointer in the frame view. */
export interface Hover extends SkyPosition {
  /** Pixel value in MJy/sr, or null over empty pixels. */
  value: number | null;
  /** Wavelength at that pixel in microns. */
  wavelength: number | null;
  /** Flag bits at that pixel. */
  bits: number;
}

/** How the spectrum plot is drawn. */
export interface SpectrumSettings {
  /** Logarithmic brightness axis. */
  log: boolean;
  /** One spectrum per visit instead of all visits combined. Shows brightness changes. */
  perVisit: boolean;
  /** Show every single measurement behind the averages. */
  showPoints: boolean;
  /** Show the target's 2MASS and WISE brightness next to the SPHEREx spectrum. */
  showSurveys: boolean;
  /**
   * Radius in arcseconds of the circle to measure, or null to use the point-source fit.
   * A circle suits galaxies, nebulae, and comet comas. The fit is best for stars.
   */
  aperture: number | null;
  /**
   * Measure the ring of light around the source instead of the source itself. For a star too
   * bright for the detector, whose core is lost but whose halo rises and falls with it.
   * The spectrum keeps its features, but its overall level is the halo's, not the star's.
   */
  halo: boolean;
  /**
   * A spot other than the target to take the spectrum of, as a sky offset [east, north] in
   * arcseconds from the field center. Null measures the target. A probe is always measured with a circle.
   */
  probe: [number, number] | null;
  /** Ids of the feature families to mark, from LINE_FAMILIES. */
  families: string[];
  /** Redshift applied to the feature marks. 0 for nearby objects. */
  redshift: number;
}

/** A known object shown on the sky map. Positions are at `epoch`, carried there by proper motion. */
export interface SkyObject extends SkyPosition {
  /** Catalog identifier. */
  id: string;
  /** Name tidied for display. */
  name: string;
  epoch: number;
  /** Object type in plain words. */
  kind: string | null;
  /** Catalog type code, for example "BD*". */
  code: string | null;
  pmRa: number | null;
  pmDec: number | null;
  parallax: number | null;
  redshift: number | null;
  spectralType: string | null;
  /** How many published papers mention it. A rough measure of fame. */
  refs: number | null;
  /** Visible-light and 2.2 micron magnitudes, when known. */
  vMag: number | null;
  kMag: number | null;
  /** Page with full details about the object. */
  url: string;
  /** How far away it is, when a parallax or redshift is known. */
  distance: Distance | null;
}

/** State of the sky map. */
export interface MapState {
  /** True once the map engine has loaded. */
  ready: boolean;
  /** Why the map could not start, in plain words. */
  failure: string | null;
  /** Projection id from PROJECTIONS. */
  projection: string;
  /** Layer id from SKY_LAYERS. */
  layer: string;
  /** SPHEREx channel shown by the all-sky layer, 0 to 101. */
  channel: number;
  /** Coordinate grid on or off. */
  grid: boolean;
  /** Labels for known objects on or off. */
  labels: boolean;
  /** Where the map looks and how wide, in degrees. Follows the user's movements. */
  center: SkyPosition;
  fov: number;
  /** Known objects in view, best known first. */
  objects: SkyObject[];
  objectsState: LoadState;
  /** The object the user chose, if any. */
  selected: SkyObject | null;
  /** Where that object was chosen: on the sky map, or on the image side (its labels and its list). */
  selectedIn: "map" | "images";
  /** A place the user chose by clicking the map or an image, if any. The map draws it as the selected area. */
  picked: SkyPosition | null;
  /** Where that place was chosen: on the sky map or in the images. */
  pickedIn: "map" | "images";
  /**
   * True while the square of the field being studied is shown on the map.
   * A search switches it on. Closing the selected area switches it off.
   */
  fieldShown: boolean;
  /** Coverage map of every SPHEREx spectral image in the archive, on or off. */
  coverage: boolean;
  /** Coverage map of the SPHEREx deep fields, on or off. */
  deepFields: boolean;
  /** The HEALPix tile grid that all-sky maps are cut into, on or off. */
  tiles: boolean;
  /** True while the measure tool is on. A drag on the map then measures an angle instead of moving the map. */
  measuring: boolean;
  /** The line last measured on the map, if any. */
  measured: Measurement | null;
}

/** A line measured between two points on the sky map. */
export interface Measurement {
  from: SkyPosition;
  to: SkyPosition;
  /** The angle between the two ends, in arcseconds. */
  separation: number;
  /** The direction from the first end to the second, in degrees from north through east. */
  angle: number;
}

/**
 * What to subtract from the image on screen, to show only what changed.
 * - "none": show the image as it is.
 * - "first": subtract the first step of the sequence.
 * - "previous": subtract the step before this one.
 * - "others": subtract the sum of every other step. For single exposures, only exposures
 *   at a matching wavelength go into that sum, because every exposure has its own wavelength.
 */
export type Subtract = "none" | "first" | "previous" | "others";

/** A star from Gaia DR3. The position is at `epoch` (2016.0) and moves with pmRa and pmDec. */
export interface GaiaSource extends SkyPosition {
  id: string;
  epoch: number;
  pmRa: number | null;
  pmDec: number | null;
  parallax: number | null;
  /** Gaia G, BP, and RP magnitudes. */
  g: number | null;
  bp: number | null;
  rp: number | null;
}

/** A source from a survey that measured brightness in broad bands (2MASS or WISE). */
export interface SurveySource extends SkyPosition {
  id: string;
  /** Julian year the survey saw the source at this position. */
  epoch: number;
  /** Brightness per band name: flux and error in microjansky, and the catalog magnitude. */
  bands: Record<string, { flux: number; err: number | null; mag: number | null }>;
}

/** Facts about a survey band. */
export interface SurveyBand {
  /** Flux of a zero-magnitude star in jansky. */
  zero: number;
  /** Center and width in microns. */
  wavelength: number;
  width: number;
  /** "2MASS" or "WISE". */
  survey: string;
}

/** What other missions recorded near the target. */
export interface MissionData {
  bands: Record<string, SurveyBand>;
  gaia: GaiaSource[];
  twomass: SurveySource[];
  wise: SurveySource[];
  /** Sources that could not be reached this time. */
  errors: string[];
}

/** The target's brightness in one band of another survey, for comparison with the SPHEREx spectrum. */
export interface SurveyPoint {
  /** Band name, for example "Ks" or "W2". */
  band: string;
  survey: string;
  /** Catalog name of the matched source. */
  source: string;
  wavelength: number;
  width: number;
  /** Microjansky. */
  flux: number;
  err: number | null;
  /** Julian year of the measurement. */
  epoch: number;
}

/** One visible-light image from NEOSSat, the Canadian Space Agency satellite. */
export interface PartnerImage {
  id: string;
  /** Start of the exposure, Modified Julian Date. */
  mjd: number;
  /** Exposure time in seconds. */
  exposure: number | null;
  /** What NEOSSat was aimed at, when recorded. */
  target: string | null;
  /** Small and full-size preview pictures, and the FITS file. */
  thumbnail: string;
  preview: string;
  fits: string;
}

/** Images of the field from a partner space agency. */
export interface PartnerData {
  mission: string;
  agency: string;
  /** Licence line that must be shown with the images. */
  credit: string;
  count: number;
  /** Dates of the first and last image, Modified Julian Date. */
  first: number | null;
  last: number | null;
  /** Newest first. */
  images: PartnerImage[];
}

/** Orbital elements of the spacecraft and facts about the public archive. */
/** A known solar system body near a place in the sky at one moment. From IMCCE SkyBoT. */
export interface KnownBody extends SkyPosition {
  /** For example "(4) Vesta" or "C/2025 N1". */
  name: string;
  /** For example "Main-belt asteroid (inner)" or "Comet". */
  kind: string;
  /** How far it was from the place asked about, arcseconds. */
  separation: number;
  /** Visual magnitude, when known. */
  magnitude: number | null;
  /** Speed across the sky in arcseconds per hour, and direction in degrees from north through east. */
  rate: number;
  angle: number;
  /** Distance from the Earth and from the Sun in au, when known. */
  earthDistance: number | null;
  sunDistance: number | null;
  /** What to pass to actions.search to follow it through the SPHEREx images. */
  query: string;
}

/** The answer to "was a known solar system body at this spot when the image was taken?" */
export interface KnownCheck {
  /** The spot and the moment asked about. */
  position: SkyPosition;
  mjd: number;
  /** True when the image on screen was a sum of several, so the moment is only its middle. */
  summed: boolean;
  /** How far around the spot was searched, arcseconds. */
  radius: number;
  /** True when the whole field of the image was searched, not the surroundings of one picked spot. */
  field: boolean;
  status: "loading" | "ready" | "failed";
  /** The bodies found, nearest first. Empty when none is known there. */
  bodies: KnownBody[];
  /** Plain-language reason when the lookup failed. */
  error?: string;
}

/**
 * A telescope whose data the tool shows, and where it is: circling the Earth now, at an
 * observatory on the ground, far from the Earth, or no longer in orbit.
 */
export interface Telescope {
  id: string;
  name: string;
  /** Who built and ran it. */
  agency: string;
  where: "orbit" | "ground" | "deep" | "gone";
  /** What the tool uses from it, in plain words. */
  use: string;
  /** When it flew or where it stands, in plain words. */
  note: string;
  /** For a telescope in orbit: its orbital elements in the OMM format, or null when they could not be fetched. */
  elements?: Record<string, string | number> | null;
  /** For an observatory on the ground: its place in degrees, east positive. */
  latitude?: number;
  longitude?: number;
}

export interface SpacecraftInfo {
  name: string;
  fullName: string;
  /** Launch date, ISO. */
  launched: string;
  /** Orbit in plain words. */
  orbit: string;
  /** Orbital elements in the OMM format, or null when they could not be fetched. */
  elements: Record<string, string | number> | null;
  /** How many exposures are public and how recent the newest is (Modified Julian Date). */
  archive: { exposures: number; built: string; newest: number | null; releases: string[] } | null;
  /** Where the newest public exposures looked. */
  recent: { obsId: string; mjd: number; ra: number; dec: number }[];
  /** Every telescope behind the tool, SPHEREx first. */
  telescopes: Telescope[];
}

/** Where the spacecraft is right now, worked out in the browser from its orbital elements. */
export interface SpacecraftNow {
  /** Point on the ground directly below, degrees. */
  latitude: number;
  longitude: number;
  /** Height above the ground and speed, in km and km/s. */
  altitude: number;
  speed: number;
  /** Minutes for one trip around the Earth. */
  period: number;
  /** True when the spacecraft is in sunlight. */
  sunlit: boolean;
}
