# References

Every external resource goes here with its license and required credit. Set "In use" to yes in the same commit that starts using it. The submission References field and the README credits come from this file.

## Data

| Resource | Provider | Terms | Credit or DOI | In use |
|---|---|---|---|---|
| SPHEREx DR1 Spectral Images | NASA SPHEREx (JPL, Caltech) via NASA/IPAC IRSA | Public, no restrictions | DOI 10.26131/IRSA678 | Yes |
| SPHEREx DR1 Spectral All-Sky Cube | Same | Same | DOI 10.26131/IRSA679 | Yes (map base layer) |
| SPHEREx QR3 Spectral Images | Same | Same | DOI 10.26131/IRSA662 | Yes |
| Gaia DR3 | ESA Gaia, DPAC, served by MAST (VizieR mirror as backup) | Gaia credit required | Gaia Collaboration 2016, 2023 | Yes (star positions and motions) |
| NEOSSat astronomy data | Canadian Space Agency (CSA), CADC | Open Government Licence - Canada | Credit line below | Not yet |
| SIMBAD | CDS, Strasbourg (or CfA and IDIA mirrors) | Credit required | Wenger et al. 2000 | Yes (name lookup) |
| VizieR | CDS, Strasbourg (CfA and IDIA mirrors) | Credit required | Ochsenbein et al. 2000, DOI 10.26093/cds/vizier | Yes (2MASS and AllWISE catalogs) |
| 2MASS Point Source Catalog | UMass, IPAC/Caltech, NASA, NSF (VizieR II/246) | Public | Skrutskie et al. 2006. Flux zero points from Cohen et al. 2003 | Yes (J, H, Ks brightness) |
| AllWISE Source Catalog | NASA WISE, JPL, IPAC (VizieR II/328) | Public | Wright et al. 2010. Cutri et al. 2013. Flux zero points from Jarrett et al. 2011 | Yes (W1, W2 brightness) |
| UltracoolSheet | Best et al. | CC-BY-4.0 | DOI 10.5281/zenodo.15802304 | Not yet |

| Sky survey tiles (HiPS) served by IRSA: 2MASS, AllWISE, DSS2, SDSS DR9, GALEX, Spitzer IRAC and GLIMPSE360, IRAS IRIS, Herschel PACS, Planck | Each survey team, HiPS built by CDS, ESA, and IPAC | Public | Layer credits in `web/src/core/skyLayers.ts`. List at https://irsa.ipac.caltech.edu/data/hips/list | Yes (map layers) |

IRSA data use terms: https://irsa.ipac.caltech.edu/data_use_terms.html

## Required acknowledgment text

SPHEREx (from IRSA):

> This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration.

IRSA (also list the facility keyword "IRSA"):

> This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.

Gaia:

> This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.

2MASS:

> This publication makes use of data products from the Two Micron All Sky Survey, which is a joint project of the University of Massachusetts and the Infrared Processing and Analysis Center/California Institute of Technology, funded by the National Aeronautics and Space Administration and the National Science Foundation.

WISE:

> This publication makes use of data products from the Wide-field Infrared Survey Explorer, which is a joint project of the University of California, Los Angeles, and the Jet Propulsion Laboratory/California Institute of Technology, funded by the National Aeronautics and Space Administration.

SIMBAD and VizieR:

> This research has made use of the SIMBAD database, CDS, Strasbourg Astronomical Observatory, France.

> This research has made use of the VizieR catalogue access tool, CDS, Strasbourg Astronomical Observatory, France.

NEOSSat (Open Government Licence - Canada, official text uses an en dash before "Canada"):

> Contains information licensed under the Open Government Licence - Canada.

## Papers and documents

- Bock et al. 2026, ApJ 999, 139 (arXiv 2511.02985). SPHEREx mission.
- Akeson et al. 2026, ApJS 285, 67. SPHEREx data pipeline.
- Korngut et al. 2026 (arXiv 2603.29835). SPHEREx instrument and calibration.
- SPHEREx Explanatory Supplement: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf
- SPHEREx Archive User Guide: https://caltech-ipac.github.io/spherex-archive-documentation/
- Meisner et al. 2026 (arXiv 2608.00046). Undersampling limits SPHEREx coaddition and differencing.
- Gagné et al. 2026 (arXiv 2604.22012). SPHEREx spectra of ultracool dwarfs (SPIFF).
- Rustamkulov et al. 2026 (arXiv 2607.00543). SPHEREx view of WISE 0855.
- Chen et al. 2022 (arXiv 2205.08077). Epsilon Indi Ba and Bb orbit.
- NIST Atomic Spectra Database (Kramida et al.), https://www.nist.gov/pml/atomic-spectra-database. Atomic line wavelengths in `web/src/core/lines.ts`.
- Gibb et al. 2004, ApJS 151, 35, and Boogert et al. 2015, ARA&A 53, 541. Ice band positions.
- Anderson and King 2000, PASP 112, 1360. The effective PSF method behind the brightness fit.

## Software and services

Add the license and version when a library goes into the build.

| Name | License | Credit | In use |
|---|---|---|---|
| Astropy 8 | BSD-3-Clause | Astropy Collaboration 2013, 2018, 2022 | Yes (API) |
| NumPy 2 | BSD-3-Clause | Harris et al. 2020 | Yes (API) |
| FastAPI, Starlette, Uvicorn | MIT, BSD-3-Clause | | Yes (API) |
| HTTPX | BSD-3-Clause | | Yes (API) |
| Pillow 13 | MIT-CMU | | Yes (API, color sky tiles) |
| pytest, pytest-asyncio | MIT, Apache-2.0 | | Yes (tests) |
| uv | MIT or Apache-2.0 | Astral | Yes (tooling) |
| React 19, React DOM | MIT | | Yes (web) |
| Zustand 5 | MIT | | Yes (web) |
| Vite 8, @vitejs/plugin-react | MIT | | Yes (build) |
| TypeScript 7 | Apache-2.0 | | Yes (build) |
| Vitest 5 | MIT | | Yes (tests) |
| matplotlib colormaps (viridis, magma, inferno, plasma, cividis) | CC0 | van der Walt and Smith 2015. Nunez et al. 2018 (cividis) | Yes (key colors in `web/src/core/colormaps.ts`) |
| astroquery | BSD-3-Clause | Ginsburg et al. 2019 | Not yet |
| Aladin Lite 3.9.2-beta (CDS) | LGPL-3.0-or-later | Boch and Fernique 2014. Baumann et al. 2022. The Aladin logo and link stay in the view | Yes (sky map, loaded on demand) |
| WiseView | Public domain | Caselden et al. 2018, ASCL 1806.004 | Reference only |
| satellite.js | MIT | | Not yet |
| gifenc 1.0.3 | MIT | Matt DesLauriers | Yes (animation export) |
| Mediabunny | MPL-2.0 | | Not yet |
| sampjs | CC0 | | Not yet |
| NEOSSat tutorial (CSA) | MIT, Crown copyright 2023 | | Reference only |
| IRSA SIA and the AWS S3 bucket `nasa-irsa-spherex` | Public | IRSA acknowledgment | Yes (search and pixels) |
| IRSA TAP and cutout service | Public | IRSA acknowledgment | Not used. The API reads S3 directly |
| Sesame name resolver (CDS), through the CfA and IDIA mirrors | Credit required | SIMBAD and VizieR acknowledgments | Yes (name lookup) |
| MAST catalog API (Gaia DR3) | Public | MAST, STScI | Yes |
| IMCCE SkyBoT | Public | Berthier et al. 2006 | Not yet |
| JPL Horizons and Small-Body Database APIs | Public | JPL Solar System Dynamics. Giorgini et al. 1996 | Yes (names and paths of planets, asteroids, and comets) |
| CelesTrak | Public, rate limited | CelesTrak | Not yet |
| CADC (NEOSSat) | Public | CADC | Not yet |
