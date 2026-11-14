# References

Every external resource goes here with its license and required credit. Set "In use" to yes in the same commit that starts using it. The submission References field and the README credits come from this file.

## Data

| Resource | Provider | Terms | Credit or DOI | In use |
|---|---|---|---|---|
| SPHEREx DR1 Spectral Images | NASA SPHEREx (JPL, Caltech) via NASA/IPAC IRSA | Public, no restrictions | DOI 10.26131/IRSA678 | Not yet |
| SPHEREx DR1 Spectral All-Sky Cube | Same | Same | DOI 10.26131/IRSA679 | Not yet |
| SPHEREx QR3 Spectral Images | Same | Same | DOI 10.26131/IRSA662 | Not yet |
| Gaia DR3 | ESA Gaia, DPAC (via MAST, ESA, or VizieR) | Gaia credit required | Gaia Collaboration 2016, 2023 | Not yet |
| NEOSSat astronomy data | Canadian Space Agency (CSA), CADC | Open Government Licence - Canada | Credit line below | Not yet |
| SIMBAD | CDS, Strasbourg (or CfA and IDIA mirrors) | Credit required | Wenger et al. 2000 | Not yet |
| VizieR | CDS, Strasbourg (or mirrors) | Credit required | Ochsenbein et al. 2000, DOI 10.26093/cds/vizier | Not yet |
| UltracoolSheet | Best et al. | CC-BY-4.0 | DOI 10.5281/zenodo.15802304 | Not yet |

IRSA data use terms: https://irsa.ipac.caltech.edu/data_use_terms.html

## Required acknowledgment text

SPHEREx (from IRSA):

> This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration.

IRSA (also list the facility keyword "IRSA"):

> This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.

Gaia:

> This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.

SIMBAD and VizieR, if used:

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

## Software and services

Add the license and version when a library goes into the build.

| Name | License | Credit | In use |
|---|---|---|---|
| Astropy 8 | BSD-3-Clause | Astropy Collaboration 2013, 2018, 2022 | Yes (API) |
| NumPy 2 | BSD-3-Clause | Harris et al. 2020 | Yes (API) |
| FastAPI, Starlette, Uvicorn | MIT, BSD-3-Clause | | Yes (API) |
| HTTPX | BSD-3-Clause | | Yes (API) |
| pytest, pytest-asyncio | MIT, Apache-2.0 | | Yes (tests) |
| uv | MIT or Apache-2.0 | Astral | Yes (tooling) |
| React 19, React DOM | MIT | | Yes (web) |
| Zustand 5 | MIT | | Yes (web) |
| Vite 8, @vitejs/plugin-react | MIT | | Yes (build) |
| TypeScript 7 | Apache-2.0 | | Yes (build) |
| Vitest 5 | MIT | | Yes (tests) |
| astroquery | BSD-3-Clause | Ginsburg et al. 2019 | Not yet |
| Aladin Lite v3 (CDS) | LGPL-3.0-or-later | Boch and Fernique 2014. Keep the Aladin logo and link in the view | Not yet |
| WiseView | Public domain | Caselden et al. 2018, ASCL 1806.004 | Reference only |
| satellite.js | MIT | | Not yet |
| gifenc | MIT | | Not yet |
| Mediabunny | MPL-2.0 | | Not yet |
| sampjs | CC0 | | Not yet |
| NEOSSat tutorial (CSA) | MIT, Crown copyright 2023 | | Reference only |
| IRSA SIA, TAP, cutout service, AWS S3 bucket `nasa-irsa-spherex` | Public | IRSA acknowledgment | Not yet |
| MAST (Gaia DR3) | Public | MAST | Not yet |
| IMCCE SkyBoT | Public | Berthier et al. 2006 | Not yet |
| JPL Horizons and SBDB | Public | JPL Solar System Dynamics | Not yet |
| CelesTrak | Public, rate limited | CelesTrak | Not yet |
| CADC (NEOSSat) | Public | CADC | Not yet |
