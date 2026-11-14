// Sky surveys the map can show, as HiPS tile sets. All are served by NASA/IPAC IRSA with
// open cross-origin access, so the map does not depend on the CDS servers.
// Source list: https://irsa.ipac.caltech.edu/data/hips/list
// Written with Claude Code (Anthropic) assistance.

export interface SkyLayer {
  id: string;
  /** Short name for menus. */
  name: string;
  /** The telescope or survey behind it. */
  mission: string;
  /** Kind of light, in plain words. */
  light: string;
  /** One sentence on what it shows. */
  about: string;
  url: string;
  /** True for a cube with one image per SPHEREx channel. */
  cube?: boolean;
  /** For a full-color view of the SPHEREx cube: the channels shown as red, green, and blue. Built by our server. */
  color?: [number, number, number];
}

const IRSA = "https://irsa.ipac.caltech.edu/data/hips/";

export const SKY_LAYERS: SkyLayer[] = [
  {
    id: "spherex", name: "SPHEREx all-sky", mission: "NASA SPHEREx", light: "Near infrared, 102 colors",
    about: "The whole sky in 102 infrared colors from SPHEREx's first year. Slide through the colors.",
    url: IRSA + "SPHEREx/spherex_allsky_cube", cube: true,
  },
  {
    id: "spherex-color", name: "SPHEREx full color", mission: "NASA SPHEREx", light: "Near infrared, three colors",
    about: "Three SPHEREx colors at once: 1.25 microns as blue, 2.2 as green, and 4.6 as red. Stars are blue. Dust and cool gas glow red.",
    url: IRSA + "SPHEREx/spherex_allsky_cube", color: [90, 47, 22],
  },
  {
    id: "2mass", name: "2MASS color", mission: "2MASS", light: "Near infrared",
    about: "The infrared sky in three colors (1.2, 1.7, and 2.2 microns). Sees through dust to cool stars.",
    url: IRSA + "CDS/2MASS/Color",
  },
  {
    id: "wise", name: "WISE color", mission: "NASA WISE", light: "Mid infrared",
    about: "Warm dust and cool objects at 3.4, 4.6, and 22 microns.",
    url: IRSA + "CDS/AllWISE/RGB-W4-W2-W1",
  },
  {
    id: "wise-w1", name: "WISE 3.4 µm", mission: "NASA WISE", light: "Mid infrared",
    about: "WISE band 1. Overlaps SPHEREx detector 4.",
    url: IRSA + "CDS/AllWISE/W1",
  },
  {
    id: "wise-w2", name: "WISE 4.6 µm", mission: "NASA WISE", light: "Mid infrared",
    about: "WISE band 2. Overlaps SPHEREx detector 6. Cold brown dwarfs are brightest here.",
    url: IRSA + "CDS/AllWISE/W2",
  },
  {
    id: "dss", name: "Visible light (DSS)", mission: "Digitized Sky Survey", light: "Visible",
    about: "The sky as photographic plates saw it. Close to what a large backyard telescope shows.",
    url: IRSA + "CDS/DSS2/color",
  },
  {
    id: "sdss", name: "SDSS color", mission: "Sloan Digital Sky Survey", light: "Visible",
    about: "Sharp visible-light images over about a third of the sky.",
    url: IRSA + "CDS/SDSS/DR9/color",
  },
  {
    id: "galex", name: "GALEX ultraviolet", mission: "NASA GALEX", light: "Ultraviolet",
    about: "Hot young stars and star-forming galaxies in ultraviolet light.",
    url: IRSA + "CDS/GALEX/GR6-03-2014/AIS-Color",
  },
  {
    id: "spitzer", name: "Spitzer 3.6 µm", mission: "NASA Spitzer", light: "Mid infrared",
    about: "Deep, sharp infrared images of selected regions from Spitzer's IRAC camera.",
    url: IRSA + "CDS/SPITZER/IRAC1",
  },
  {
    id: "glimpse", name: "Spitzer Milky Way", mission: "NASA Spitzer GLIMPSE360", light: "Mid infrared",
    about: "The plane of the Milky Way seen through its dust.",
    url: IRSA + "Spitzer/GLIMPSE360",
  },
  {
    id: "iras", name: "IRAS dust", mission: "IRAS", light: "Far infrared",
    about: "Cold dust across the whole sky at 12 to 100 microns.",
    url: IRSA + "CDS/IRIS/color",
  },
  {
    id: "herschel", name: "Herschel dust", mission: "ESA Herschel", light: "Far infrared",
    about: "Cold dust and star-forming clouds at 70 to 160 microns, in selected regions.",
    url: IRSA + "ESAC/PACS-color",
  },
  {
    id: "planck", name: "Planck microwave", mission: "ESA Planck", light: "Microwave",
    about: "The coldest dust in the galaxy and the glow of the early universe.",
    url: IRSA + "CDS/PLANCK/R2/HFI/color",
  },
];

/** Map projections Aladin Lite offers, with plain names. */
export const PROJECTIONS = [
  { id: "SIN", name: "Globe", about: "The sky as a sphere you can spin all the way around." },
  { id: "AIT", name: "Whole sky (oval)", about: "The entire sky at once in an oval. Shapes stay close to true." },
  { id: "MOL", name: "Whole sky (equal area)", about: "The entire sky at once. Every patch keeps its true share of area." },
  { id: "MER", name: "Flat map", about: "A flat rectangular map, like a classroom world map." },
  { id: "ZEA", name: "All-sky disc", about: "The whole sky in one circle around where you look." },
  { id: "STG", name: "Wide angle", about: "A wide view that keeps shapes true, like a fisheye lens." },
  { id: "TAN", name: "True shapes", about: "What a camera sees. Straight lines on the sky stay straight." },
] as const;

export type ProjectionId = (typeof PROJECTIONS)[number]["id"];
