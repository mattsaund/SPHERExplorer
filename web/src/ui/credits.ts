// Credit for every data source, service, library, and tool that SPHERExplorer uses, as the About tab
// lists them. The data rows are the ones on the team's Space Apps project page, kept in
// docs/submission/submissionreferences.md. The complete list, with licenses, is docs/references.md.
// Written with Claude Code (Anthropic) assistance.

/** A name to show and the page it links to. */
export interface CreditLink {
  name: string;
  url: string;
}

/** One line of credit: one or more linked names, and what the tool uses them for. */
export interface Credit {
  links: CreditLink[];
  use: string;
}

export const REPO = "https://github.com/mattsaund/SPHERExplorer";
export const CHALLENGE = "https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/";

/** The two people of team Turing Complete, with their own sites. */
export const TEAM: CreditLink[] = [
  { name: "Matthew Saunders", url: "https://msaunders.dev" },
  { name: "Austin Laubach", url: "https://laubach.dev" },
];

/** Pages in the repository that the About tab points to. */
export const DOCS = {
  methods: `${REPO}/blob/main/docs/methods.md`,
  embedding: `${REPO}/blob/main/docs/embedding.md`,
  references: `${REPO}/blob/main/docs/references.md`,
  si: `${REPO}/blob/main/docs/si-usage.md`,
};

export const SI_TOOL: CreditLink = { name: "Claude Code", url: "https://claude.com/product/claude-code" };

const one = (name: string, url: string, use: string): Credit => ({ links: [{ name, url }], use });

export const NASA_DATA: Credit[] = [
  one("SPHEREx Spectral Images, Data Release 1", "https://doi.org/10.26131/IRSA678", "Every SPHEREx image the tool plays"),
  one("SPHEREx Spectral Images, Quick Release 3", "https://doi.org/10.26131/IRSA662", "The newest SPHEREx images"),
  one("SPHEREx Spectral All-Sky Cube, Data Release 1", "https://doi.org/10.26131/IRSA679", "The SPHEREx layer of the sky map, by channel and in color"),
  one("SPHEREx images in IRSA's public cloud bucket", "https://irsa.ipac.caltech.edu/cloud_access/", "Where the server reads the image files"),
  one("NASA/IPAC Infrared Science Archive (IRSA)", "https://irsa.ipac.caltech.edu/", "The archive that serves SPHEREx, and its coverage maps"),
  one("SPHEREx Explanatory Supplement", "https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf", "The file layout, the flags, and the calibration"),
  one("SPHEREx archive documentation", "https://caltech-ipac.github.io/spherex-archive-documentation/", "How the archive and its files are organized"),
  one("IRSA SPHEREx Data Explorer", "https://irsa.ipac.caltech.edu/applications/spherex/", "Studied for the design, as the challenge suggests"),
  one("Sky survey tiles from 2MASS, WISE, Spitzer, GALEX, and IRAS", "https://irsa.ipac.caltech.edu/data/hips/list", "Map layers, and Blink against WISE and 2MASS"),
  one("JPL Horizons", "https://ssd.jpl.nasa.gov/horizons/", "Paths of planets, asteroids, and comets through the images"),
  one("JPL Small-Body Database", "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html", "Names and orbits of asteroids and comets"),
  one("2MASS Point Source Catalog", "https://irsa.ipac.caltech.edu/Missions/2mass.html", "Brightness of the same stars, for comparison"),
  one("AllWISE Source Catalog", "https://irsa.ipac.caltech.edu/data/WISE/docs/release/AllWISE/", "Brightness of the same stars, for comparison"),
  one("MAST, NASA's archive at STScI", "https://archive.stsci.edu/", "The service that delivers the Gaia catalog"),
];

export const PARTNER_DATA: Credit[] = [
  one("NEOSSat, Canadian Space Agency", "https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/neossat/", "Visible-light images of the same field, served by CADC"),
  one("Gaia DR3, European Space Agency", "https://www.cosmos.esa.int/web/gaia/dr3", "Star positions, proper motions, and parallaxes"),
  one("SIMBAD and the Sesame name resolver, CDS Strasbourg", "https://simbad.cds.unistra.fr/", "Object names and facts"),
  one("VizieR, CDS Strasbourg", "https://vizier.cds.unistra.fr/", "The 2MASS and AllWISE catalogs"),
  one("Aladin Lite, CDS Strasbourg", "https://aladin.cds.unistra.fr/AladinLite/", "The sky map"),
  one("SkyBoT, IMCCE Paris Observatory", "https://ssp.imcce.fr/webservices/skybot/", "The known asteroids, comets, and planets in an image"),
  one("CelesTrak", "https://celestrak.org/", "Orbits for the live map of telescopes"),
  one("Herschel and Planck, European Space Agency", "https://www.cosmos.esa.int/", "Two sky map layers, from tiles served by IRSA"),
  one("DSS2 and SDSS sky tiles", "https://irsa.ipac.caltech.edu/data/hips/list", "Map layers, and Blink against the Digitized Sky Survey"),
  one("NIST Atomic Spectra Database", "https://www.nist.gov/pml/atomic-spectra-database", "Wavelengths of the atomic lines marked on spectra"),
  one("Natural Earth", "https://www.naturalearthdata.com/", "Land outlines on the map of telescopes"),
  one("WiseView", "https://github.com/backyardworlds/wiseview", "Studied as prior art for blinking images"),
];

export const CODE: Credit[] = [
  one("Astropy", "https://www.astropy.org/", "FITS files and sky coordinates on the server"),
  one("NumPy", "https://numpy.org/", "Image arrays and the math on the server"),
  {
    links: [
      { name: "FastAPI", url: "https://fastapi.tiangolo.com/" },
      { name: "Uvicorn", url: "https://uvicorn.dev/" },
      { name: "Pydantic", url: "https://pydantic.dev/docs/" },
      { name: "HTTPX", url: "https://www.python-httpx.org/" },
    ],
    use: "The server, and its requests to the archives",
  },
  one("Pillow", "https://python-pillow.org/", "The color sky tiles"),
  {
    links: [
      { name: "React", url: "https://react.dev/" },
      { name: "Zustand", url: "https://github.com/pmndrs/zustand" },
    ],
    use: "The web interface and its state",
  },
  one("satellite.js", "https://github.com/shashwatak/satellite-js", "Live positions of the telescopes in orbit"),
  one("gifenc", "https://github.com/mattdesl/gifenc", "Saved animations"),
  one("world-atlas and topojson-client", "https://github.com/topojson/world-atlas", "Land outlines on the map of telescopes"),
  one("Matplotlib colormaps", "https://matplotlib.org/", "The color tables: viridis, magma, inferno, plasma, and cividis"),
  {
    links: [
      { name: "TypeScript", url: "https://www.typescriptlang.org/" },
      { name: "Vite", url: "https://vite.dev/" },
      { name: "Vitest", url: "https://vitest.dev/" },
      { name: "pytest", url: "https://docs.pytest.org/en/stable/" },
      { name: "uv", url: "https://docs.astral.sh/uv/" },
    ],
    use: "The language, the build, the tests, and the packaging",
  },
  {
    links: [
      { name: "Docker", url: "https://www.docker.com/" },
      { name: "Google Cloud Run", url: "https://cloud.google.com/run" },
      { name: "GitHub Actions", url: "https://github.com/features/actions" },
    ],
    use: "The container, the hosting, the checks, the deploys, and the index refresh",
  },
  {
    links: [
      { name: "Puppeteer", url: "https://pptr.dev/" },
      { name: "FFmpeg", url: "https://ffmpeg.org/" },
      { name: "Inter", url: "https://rsms.me/inter/" },
    ],
    use: "The demo video: captures of the tool, the encoding, and the type",
  },
];

/** What the archives ask to be said, in their own words. */
export const ACKNOWLEDGMENTS: string[] = [
  "This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration.",
  "This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.",
  "This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.",
  "This publication makes use of data products from the Two Micron All Sky Survey, which is a joint project of the University of Massachusetts and the Infrared Processing and Analysis Center/California Institute of Technology, funded by the National Aeronautics and Space Administration and the National Science Foundation.",
  "This publication makes use of data products from the Wide-field Infrared Survey Explorer, which is a joint project of the University of California, Los Angeles, and the Jet Propulsion Laboratory/California Institute of Technology, funded by the National Aeronautics and Space Administration.",
  "This research has made use of the SIMBAD database, CDS, Strasbourg Astronomical Observatory, France.",
  "This research has made use of the VizieR catalogue access tool, CDS, Strasbourg Astronomical Observatory, France.",
  "Contains information licensed under the Open Government Licence - Canada.",
];
