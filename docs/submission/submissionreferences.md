# Submission references

The rows for the two link lists on the Space Apps project page, in the form's own format: a Link Text and a Link Url for each row. Click Add New Link once per row.

The form has no References field. Its second list asks for "any code, text, and images (even if they are open source or freely available)", so the code libraries and the tools go there with the data.

Each row was checked against the code and the dependency files on Nov 15, 2026, and each link was opened that day. Claude Code (Anthropic), an SI tool, made the check and wrote this file. Matt and Austin decide what goes in the form. The complete list, with every paper, formula, license, and acknowledgment, is `docs/references.md`.

## NASA Data

14 rows. All of them are on the public project page, in this order (read on Nov 15 at 6:32 pm).

| Link Text | Link Url | Used for |
|---|---|---|
| SPHEREx Spectral Images, Data Release 1 (NASA/IPAC IRSA) | https://doi.org/10.26131/IRSA678 | Every SPHEREx image in the film |
| SPHEREx Spectral Images, Quick Release 3 (NASA/IPAC IRSA) | https://doi.org/10.26131/IRSA662 | The newest SPHEREx images |
| SPHEREx Spectral All-Sky Cube, Data Release 1 (NASA/IPAC IRSA) | https://doi.org/10.26131/IRSA679 | The base layer of the sky map, by channel and in color |
| SPHEREx images in IRSA's public AWS bucket | https://irsa.ipac.caltech.edu/cloud_access/ | Where the server reads the image files |
| NASA/IPAC Infrared Science Archive (IRSA) | https://irsa.ipac.caltech.edu/ | Image search as a fallback, and the SPHEREx coverage maps |
| SPHEREx Explanatory Supplement | https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf | The file layout, the flags, and the calibration |
| SPHEREx archive documentation (IRSA) | https://caltech-ipac.github.io/spherex-archive-documentation/ | How the archive and its files are organized |
| IRSA SPHEREx Data Explorer | https://irsa.ipac.caltech.edu/applications/spherex/ | Studied for the design, as the challenge suggests |
| Sky survey tiles from NASA missions: 2MASS, WISE, Spitzer, GALEX, and IRAS (IRSA) | https://irsa.ipac.caltech.edu/data/hips/list | Map layers, and Blink against WISE and 2MASS. IRAS was a joint mission of NASA, the Netherlands, and the UK |
| JPL Horizons | https://ssd.jpl.nasa.gov/horizons/ | Paths of planets, asteroids, and comets through the images |
| JPL Small-Body Database | https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html | Names and orbits of asteroids and comets |
| 2MASS Point Source Catalog (IRSA) | https://irsa.ipac.caltech.edu/Missions/2mass.html | Brightness of the same stars, for comparison. 2MASS was funded by NASA and the NSF |
| AllWISE Source Catalog (IRSA) | https://irsa.ipac.caltech.edu/data/WISE/docs/release/AllWISE/ | Brightness of the same stars, for comparison |
| MAST, NASA's archive at STScI | https://archive.stsci.edu/ | The service that delivers the Gaia catalog. The Gaia data itself is ESA's, under partner data |

One more row would be true, if wanted. The cards for the Sun, the Moon, and the planets link to NASA's own pages: "NASA Science pages for the Sun, the Moon, and the planets", https://science.nasa.gov/solar-system/.

## Space Agency Partner & Other Data

### Data and services

13 rows. All of them are on the public project page, in this order (read on Nov 15 at 6:32 pm).

| Link Text | Link Url | Used for |
|---|---|---|
| NEOSSat astronomy images, Canadian Space Agency (served by CADC) | https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/neossat/ | Visible-light images of the same field. Contains information licensed under the Open Government Licence - Canada |
| Gaia DR3, European Space Agency | https://www.cosmos.esa.int/web/gaia/dr3 | Star positions, proper motions, and parallaxes |
| SIMBAD and the Sesame name resolver, CDS Strasbourg | https://simbad.cds.unistra.fr/ | Object names and facts, through the CfA and IDIA mirrors |
| VizieR, CDS Strasbourg | https://vizier.cds.unistra.fr/ | The 2MASS and AllWISE catalogs |
| Aladin Lite, CDS Strasbourg | https://aladin.cds.unistra.fr/AladinLite/ | The sky map |
| SkyBoT, IMCCE Paris Observatory | https://ssp.imcce.fr/webservices/skybot/ | The known asteroids, comets, and planets in an image |
| CelesTrak | https://celestrak.org/ | Orbits for the live map of telescopes |
| Herschel, European Space Agency | https://www.cosmos.esa.int/web/herschel | A sky map layer, from tiles served by IRSA |
| Planck, European Space Agency | https://www.cosmos.esa.int/web/planck | A sky map layer, from tiles served by IRSA |
| DSS2 and SDSS sky tiles (served by IRSA) | https://irsa.ipac.caltech.edu/data/hips/list | Map layers, and Blink against the Digitized Sky Survey |
| NIST Atomic Spectra Database | https://www.nist.gov/pml/atomic-spectra-database | Wavelengths of the atomic lines marked on spectra |
| Natural Earth | https://www.naturalearthdata.com/ | Land outlines on the map of telescopes |
| WiseView | https://github.com/backyardworlds/wiseview | Studied as prior art for blinking images |

One row came out of the form on Nov 15 at 6:28 pm: "NEOSSat tutorial, Canadian Space Agency". It was read, and no code or data came from it.

WiseView and the IRSA SPHEREx Data Explorer were studied, not used as code or data. They stay because the challenge names WiseView as a model and the coverage overlays follow the Data Explorer. Ending their link text with "(studied as a model)" would make that plain.

### Code and tools

26 rows to add. None of them is on the public project page (read on Nov 15 at 6:32 pm). If time is short, the first 14 rows and the last one matter most: they are the code inside the tool, the SI tool, and the complete list.

| Link Text | Link Url | Used for |
|---|---|---|
| Astropy | https://www.astropy.org/ | Reading FITS files and sky coordinates on the server |
| NumPy | https://numpy.org/ | Image arrays and the math on the server |
| FastAPI | https://fastapi.tiangolo.com/ | The server's web API |
| Uvicorn | https://uvicorn.dev/ | Runs the server |
| Pydantic | https://pydantic.dev/docs/ | Checks each request |
| HTTPX | https://www.python-httpx.org/ | The server's requests to the archives |
| Pillow | https://python-pillow.org/ | The color sky tiles |
| React | https://react.dev/ | The web interface |
| Zustand | https://github.com/pmndrs/zustand | The web app's state |
| satellite.js | https://github.com/shashwatak/satellite-js | Live positions of the telescopes in orbit |
| gifenc | https://github.com/mattdesl/gifenc | Saved animations |
| world-atlas and topojson-client | https://github.com/topojson/world-atlas | Land outlines on the map of telescopes |
| Matplotlib colormaps | https://matplotlib.org/ | The color tables: viridis, magma, inferno, plasma, cividis |
| Claude Code (Anthropic), SI tool | https://claude.com/product/claude-code | Wrote and tested code and docs under the team's direction |
| Google Cloud Run | https://cloud.google.com/run | Hosting |
| GitHub Actions | https://github.com/features/actions | Checks, deploys, and the index refresh |
| Docker | https://www.docker.com/ | The production container |
| TypeScript | https://www.typescriptlang.org/ | The web app's language and type check |
| Vite | https://vite.dev/ | Builds the web app |
| Vitest | https://vitest.dev/ | Web tests |
| pytest | https://docs.pytest.org/en/stable/ | Server tests |
| uv | https://docs.astral.sh/uv/ | Python packaging |
| Puppeteer (demo video) | https://pptr.dev/ | Captures of the tool for the demo video |
| FFmpeg (demo video) | https://ffmpeg.org/ | Encodes the demo video |
| Inter typeface (demo video) | https://rsms.me/inter/ | The type in the demo video |
| SPHERExplorer reference list: every paper, formula, license, and acknowledgment | https://github.com/mattsaund/SPHERExplorer/blob/main/docs/references.md | The complete list |

## What the check found

- Every data and service row is called or loaded by the code. Its host or its package is in `server/`, `web/src/`, or the dependency files. Two rows are for tools that were studied only: WiseView and the IRSA SPHEREx Data Explorer. The NEOSSat tutorial was read only, and its row is no longer in the form.
- Not rows here, because the row for the resource covers them: the papers that the archives ask to be cited, the survey papers for the map layers, sub-packages, type definitions, single CI steps, and single cloud services.
- Not rows here, because the tool does not use them: HITRAN2020 (named in `docs/references.md` as a source to check against), the IRSA TAP and cutout services, and the papers that were background reading (Bock, Akeson, Korngut, Meisner, Gagné, Rustamkulov, and Chen).
- Formulas and published values that the code does use are in `docs/references.md` with their papers: the effective PSF, the repeated median, error diffusion, Vincenty's formula, Meeus and the Astronomical Almanac, ice band positions, flux zero points, and cosmological parameters.
