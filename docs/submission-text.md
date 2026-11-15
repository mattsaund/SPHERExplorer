# Submission text

The text for each field of the Space Apps project page, kept here so it can be checked against the app before the final submission. Claude drafted it from the repository docs. Austin and Matt approve it, and the project page is the copy judges see.

Status, Nov 15, noon: the summary and the project details were pasted into the form on Nov 14, and both have changed since (see the claims table), so they need pasting again. The project link is chosen. The two data fields, the References field, and the SI answer are drafted below and wait for approval. The demo video is rendered and waits for an upload. Matt set 4:00 pm Eastern on Sun Nov 15 as the team's deadline for all of it. The Local Event's cutoff on record is 4:20 pm.

To paste the project details with their formatting, copy them from a rendered view of this file (GitHub's file view works), not from a terminal.

## Project name

SPHERExplorer

## Summary

50 to 200 words, 1,500 characters at most. Now 198 words and 1,182 characters. Plain text.

SPHERExplorer is a free web tool that plays every SPHEREx image of any sky position in time order. NASA's SPHEREx telescope maps the entire sky in 102 infrared bands and images each position many times. Seeing what moved or changed usually means downloading and aligning large files.

Users search by object name or coordinates. SPHERExplorer finds every exposure in a fraction of a second and steps through the visits, so moving objects shift across the frame. One button checks every source in the field and reports what moved, brightened, or faded. It flags all five of NASA's test targets, WISE 0855 with its two longest-wavelength detectors selected. Any point has a spectrum across all 102 bands, with features such as water and methane marked. Fields can be compared with Gaia, 2MASS, WISE, and NEOSSat data. Every view has a link, exports to FITS, and can be embedded in other sites.

SPHEREx data is open to everyone but hard to use. SPHERExplorer opens it to students, educators, researchers, and citizen scientists. They can find nearby brown dwarfs, track asteroids and comets, and study how the sky changes. It needs no software or account, and its code is open source.

## Project demonstration

To do. The video is rendered: 29.0 s, from the live site, with the SI watermark on every frame (`docs/video.md`). It needs an upload to a public host, with its description, and the full `https://` link pasted here.

## Project link

https://spherexplorer.earth

The live site, not the repository. Judges can use the tool directly, and its About tab links the source code, the methods, and the SI statement. The repository link is the last line of the project details.

## Project details

No length limit is shown. Now about 640 words, trimmed on Nov 15 from about 1,030.

### What it does

SPHERExplorer is a free web tool for NASA's SPHEREx all-sky infrared survey. Enter a name or coordinates, and it plays every public SPHEREx image of that position in time order, so moving objects step across the frame. Each image is taken in a different one of 102 infrared bands, so the same images also give a spectrum.

- Search by name, by coordinates, or by planet, asteroid, or comet.
- Play every exposure, each visit, each wavelength, or the deepest sum, over a field 1 to 50 arcminutes wide. Sum any of the six detectors, subtract one visit from another, or view three bands as color.
- Measure Changes checks every source in the field and reports what moved, brightened, or faded.
- Read the spectrum of any point, with water, methane, and other features marked.
- Compare with Gaia, 2MASS, WISE, and NEOSSat from the Canadian Space Agency, and blink against surveys decades older.
- Save FITS files with flags and variance, data tables, and animations. Every view has a link that carries its coordinates and can be shared or embedded.

### How it works

- The server reads only the rows it needs from each 65 MB SPHEREx file, about 1 MB, and sends the browser about 8 KB per image.
- Search runs on our own index of all 273,000 exposures in about a tenth of a second. New exposures are added twice a week, with no code change.
- Stars are moved to each image's date by their proper motion. Asteroids and comets follow JPL Horizons paths.
- Brightness comes from a point spread function fit in every frame.

### Results we checked

Measure Changes flags all five test targets and nothing else in their fields (WISE 0855 with detectors 5 and 6). Barnard's Star moved 10.9 arcsec north in a year (catalog 10.4), and Epsilon Indi B moves 4.6 arcsec a year (catalog 4.7). RW Aurigae brightened 55 percent in the infrared, and R Draconis shows its 245-day pulsation. Every method and its limits are in [docs/methods.md](https://github.com/mattsaund/SPHERExplorer/blob/main/docs/methods.md).

### Benefits and impact

SPHEREx data is public but hard to use. SPHERExplorer opens it to classrooms, citizen scientists, and researchers, with no download and no account. Researchers get science-grade files, and students get plain words and a guided tour. It picks up each new data release on its own, and its code is open source.

### How it is creative

- Every SPHEREx exposure lands at a different wavelength, so the tool turns a series of images into a spectrum, and compares change only at matching wavelengths.
- Stars too bright for the detector are measured from the halo around them, so Barnard's Star still gets a rough spectrum.
- One button checks the whole field for change, not only the target.

### Tools and technology

- Python (FastAPI, NumPy, Astropy) and TypeScript (React, WebGL2), with Aladin Lite for the sky map. No special hardware.
- One container on Google Cloud Run, deployed by GitHub Actions only after every test passes. The domain and the cloud credit come from the Space Apps Global Offers.
- Built with Claude Code (Anthropic), a Super Intelligence (SI) tool. The team set the idea and the features. Claude's code and docs are labeled in commits, file headers, and [docs/si-usage.md](https://github.com/mattsaund/SPHERExplorer/blob/main/docs/si-usage.md).

### Factors we considered

Scientific validity came first: positions carried forward in time, matching wavelengths, and results checked against published catalogs. Then ease of use for a child or an older adult, and speed and cost, with small transfers and a server that scales to zero.

SPHERExplorer is an independent team project. It is not an official NASA product and is not endorsed by NASA.

Source code, methods, and every reference: [https://github.com/mattsaund/SPHERExplorer](https://github.com/mattsaund/SPHERExplorer)

## NASA data and resources

Draft for Matt and Austin to approve, written by Claude on Nov 15 from `docs/references.md`. The form takes each entry as a Link Text and a Link Url. Click Add New Link once per row, and paste the first two columns. Every link opened in a browser on Nov 15. Which field: NASA data and resources are NASA missions and NASA-run or NASA-funded archives and services. Everything else goes under Space Agency Partner and other data, with the partner agency (CSA or ESA) named in the link text. Libraries, tools, papers, and books go in the References field.

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

## Space Agency Partner and other data

Draft for Matt and Austin to approve, written by Claude on Nov 15 from `docs/references.md`. The form takes each entry as a Link Text and a Link Url. Click Add New Link once per row, and paste the first two columns. Every link opened in a browser on Nov 15. Which field: NASA data and resources are NASA missions and NASA-run or NASA-funded archives and services. Everything else goes under Space Agency Partner and other data, with the partner agency (CSA or ESA) named in the link text. Libraries, tools, papers, and books go in the References field.

| Link Text | Link Url | Used for |
|---|---|---|
| NEOSSat astronomy images, Canadian Space Agency (served by CADC) | https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/neossat/ | Visible-light images of the same field. Contains information licensed under the Open Government Licence - Canada |
| NEOSSat tutorial, Canadian Space Agency | https://github.com/asc-csa/NEOSSAT_Tutorial | Reference for reading NEOSSat files |
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

## References

Draft for Matt and Austin to approve. Built by Claude on Nov 15 from every row of `docs/references.md` that is marked as in use. Build it again if that file changes.

Data

- SPHEREx DR1 Spectral Images. NASA SPHEREx (JPL, Caltech) via NASA/IPAC IRSA. Public, no restrictions. DOI 10.26131/IRSA678.
- SPHEREx DR1 Spectral All-Sky Cube. NASA SPHEREx (JPL, Caltech) via NASA/IPAC IRSA. Public, no restrictions. DOI 10.26131/IRSA679.
- SPHEREx QR3 Spectral Images. NASA SPHEREx (JPL, Caltech) via NASA/IPAC IRSA. Public, no restrictions. DOI 10.26131/IRSA662.
- Gaia DR3. ESA Gaia, DPAC, served by MAST (VizieR mirror as backup). Gaia credit required. Gaia Collaboration 2016, 2023.
- NEOSSat astronomy data. Canadian Space Agency (CSA), served by CADC. Open Government Licence - Canada. Credit line below, shown in the app with the images.
- SIMBAD. CDS, Strasbourg (or CfA and IDIA mirrors). Credit required. Wenger et al. 2000.
- VizieR. CDS, Strasbourg (CfA and IDIA mirrors). Credit required. Ochsenbein et al. 2000, DOI 10.26093/cds/vizier.
- 2MASS Point Source Catalog. UMass, IPAC/Caltech, NASA, NSF (VizieR II/246). Public. Skrutskie et al. 2006. Flux zero points from Cohen et al. 2003.
- AllWISE Source Catalog. NASA WISE, JPL, IPAC (VizieR II/328). Public. Wright et al. 2010. Cutri et al. 2013. Flux zero points from Jarrett et al. 2011.
- Sky survey tiles (HiPS) served by IRSA: 2MASS, AllWISE, DSS2, SDSS DR9, GALEX, Spitzer IRAC and GLIMPSE360, IRAS IRIS, Herschel PACS, Planck. Each survey team, HiPS built by CDS, ESA, and IPAC. Public. Layer credits in `web/src/core/skyLayers.ts`. The same tiles are the older pictures used by Blink. List at https://irsa.ipac.caltech.edu/data/hips/list.

Papers and documents

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
- Planck Collaboration 2020, A&A 641, A6. Cosmological parameters used to turn redshift into distance.
- Floyd and Steinberg 1976, Proceedings of the Society for Information Display 17, 75. The dithering of color pictures in saved animations.
- Siegel 1982, Biometrika 69, 242. The repeated median line that finds the smooth level of a spectrum.
- Vincenty 1975, Survey Review 23, 88. The formula for the angle between two points on the sky.
- HITRAN2020 (Gordon et al. 2022, JQSRT 277, 107949). The standard database for the molecular bands marked on spectra.
- Survey papers for the map layers and Blink: Lasker et al. 2008 (DSS2), Ahn et al. 2012 (SDSS DR9), Martin et al. 2005 (GALEX), Fazio et al. 2004 and Churchwell et al. 2009 (Spitzer IRAC and GLIMPSE), Miville-Deschênes and Lagache 2005 (IRAS IRIS), Poglitsch et al. 2010 (Herschel PACS), Planck Collaboration 2020 (Planck).

Software and services

- Astropy 8. BSD-3-Clause. Astropy Collaboration 2013, 2018, 2022.
- NumPy 2. BSD-3-Clause. Harris et al. 2020.
- FastAPI, Starlette, Uvicorn. MIT, BSD-3-Clause.
- Pydantic 2. MIT.
- HTTPX. BSD-3-Clause.
- Pillow 13. MIT-CMU.
- world-atlas 2 and topojson-client 3. ISC. Mike Bostock. Land outlines from Natural Earth (public domain).
- pytest, pytest-asyncio. MIT, Apache-2.0.
- uv. MIT or Apache-2.0. Astral.
- React 19, React DOM. MIT.
- Zustand 5. MIT.
- Vite 8, @vitejs/plugin-react. MIT.
- TypeScript 7. Apache-2.0.
- Type definitions for Node, React, React DOM, and topojson-client (DefinitelyTyped). MIT.
- Vitest 5. MIT.
- matplotlib colormaps (viridis, magma, inferno, plasma, cividis). CC0. van der Walt and Smith 2015. Nunez et al. 2018 (cividis).
- Aladin Lite 3.9.2-beta (CDS). LGPL-3.0-or-later. Boch and Fernique 2014. Baumann et al. 2022. The Aladin logo and link stay in the view.
- satellite.js 7.2. MIT. Shashwat Kandadai and contributors. SGP4 orbit model by Vallado et al. 2006.
- gifenc 1.0.3. MIT. Matt DesLauriers.
- For the demo video only: puppeteer-core 25 (Apache-2.0, Google), the Inter 5.3 typeface from the `@fontsource/inter` package (SIL Open Font License 1.1, Rasmus Andersson), and ffmpeg 9 (LGPL or GPL, FFmpeg developers, a system tool that is not shipped).
- IRSA SIA and the AWS S3 bucket `nasa-irsa-spherex`. Public. IRSA acknowledgment.
- Sesame name resolver (CDS), through the CfA and IDIA mirrors. Credit required. SIMBAD and VizieR acknowledgments.
- MAST catalog API (Gaia DR3). Public. MAST, STScI.
- IRSA coverage maps for SPHEREx (`spherex.obscore.moc.fits` and `spherex.deep_field.moc.fits`, in the IVOA MOC format). Public. IRSA acknowledgment.
- IMCCE SkyBoT (Paris Observatory). Public. Berthier et al. 2006, ASP Conf. Ser. 351, 367.
- JPL Horizons and Small-Body Database APIs. Public. JPL Solar System Dynamics. Giorgini et al. 1996.
- Illuminated fraction of the Moon and position angle of its bright limb. Published formulae. Jean Meeus, Astronomical Algorithms, 2nd edition, chapter 48. Radii: IAU 2015 Resolution B3 (nominal solar radius), NASA Moon fact sheet (mean radius).
- Low-precision formulae for the Moon. Public. The Astronomical Almanac, US Naval Observatory and HM Nautical Almanac Office, section D.
- CelesTrak orbital elements (NORAD 63182 SPHEREx, 39089 NEOSSat, 27783 GALEX, 13777 IRAS). Public, rate limited. CelesTrak, T.S. Kelso.
- Mission facts for the telescope list (launch and retirement dates, sites). Public. Each mission's own pages: NASA, ESA, CSA, IPAC (2MASS), SDSS, STScI (DSS).
- CADC TAP and file services (NEOSSat). Public. Canadian Astronomy Data Centre, operated by the National Research Council of Canada with the support of the Canadian Space Agency.
- Google Cloud Run, Cloud Build, Artifact Registry, and Workload Identity Federation, on the Google Cloud Free Trial from the Space Apps Global Offers. Google Cloud terms of service.
- google-github-actions/auth 3 and setup-gcloud 3. Apache-2.0. Google.
- GitHub Actions steps: actions/checkout 4, actions/setup-node 4, astral-sh/setup-uv 5. MIT. GitHub, Astral.
- Node.js 22 and Python 3.13, as the official container images `node:22-slim` and `python:3.13-slim`. MIT (Node.js), PSF-2.0 (Python). OpenJS Foundation, Python Software Foundation.
- GitHub: the repository, Actions, and Releases. GitHub terms of service.
- Claude Code (Anthropic), with the models Claude Opus 5.5 and Claude Fable 5.2. Anthropic terms of service. Labeled in commits, pull requests, and file headers. Logged in `docs/si-usage.md`.
- Tools studied, not used as code: WiseView (Caselden et al. 2018, ASCL 1806.004), which the challenge names as a model, and the IRSA SPHEREx Data Explorer (https://irsa.ipac.caltech.edu/applications/spherex/).
- Domain name from the GoDaddy Registry offer in the Space Apps Global Offers, registered through Porkbun. Porkbun terms of service.

Acknowledgments

- This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration.
- This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.
- This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.
- This publication makes use of data products from the Two Micron All Sky Survey, which is a joint project of the University of Massachusetts and the Infrared Processing and Analysis Center/California Institute of Technology, funded by the National Aeronautics and Space Administration and the National Science Foundation.
- This publication makes use of data products from the Wide-field Infrared Survey Explorer, which is a joint project of the University of California, Los Angeles, and the Jet Propulsion Laboratory/California Institute of Technology, funded by the National Aeronautics and Space Administration.
- This research has made use of the SIMBAD database, CDS, Strasbourg Astronomical Observatory, France.
- This research has made use of the VizieR catalogue access tool, CDS, Strasbourg Astronomical Observatory, France.
- Contains information licensed under the Open Government Licence - Canada.

## The SI question

Draft for Matt and Austin to approve, written by Claude on Nov 15 from `docs/si-usage.md`. Judges do not see this answer. They do see the SI labels inside the project.

Yes. We used Claude Code (Anthropic), with the models Claude Opus 5.5 and Claude Fable 5.2.

What the team did. Matt and Austin chose the challenge and set the concept and the feature list, which are recorded as they wrote them in docs/concept.md. They made the product decisions (docs/decisions.md), tried the changes on the live site, and approved the text of this page.

What SI did. Before kickoff, Claude gathered background notes on the SPHEREx data, the test targets, libraries and services, and the Space Apps rules. During the event, Claude wrote and tested the code, the documentation, and the deployment setup under the team's direction, and measured the results reported here. For some features Claude listed the options or proposed a method, and the team decided. The decision log and the SI log say where, for example Blink and the measurement of stars too bright for the detector. Claude also drafted the text of this project page, including this answer, and built the demo video from recordings of the live tool.

How it is labeled. Commits that Claude wrote carry a Co-Authored-By line. Three commits are exceptions, two early merges made with GitHub's default text and one README edit, and docs/si-usage.md names them. Every source file starts with a header that says it was written with Claude Code. Every pull request says the same, and docs/si-usage.md logs the notable uses by date. The demo video carries a visible SI watermark on every frame, and its description says it is SI-generated.

No picture in the tool is generated by SI. Every image comes from NASA SPHEREx and the other archives listed on this page, and the tool's code computes its sums, spectra, and measurements from them. The tool's reference lists (spectral features, well-known objects for the search box, and facts about the telescopes) were compiled by Claude from the published sources in docs/references.md.

If the backup slide deck is submitted in place of the video (`docs/video.md`), replace "built the demo video from recordings of the live tool" with "drafted the demo slides, with screenshots of the live tool", and the last sentence of "How it is labeled" with "Each demo slide carries an SI note in its footer."

## Claims to recheck before the final submission

Every factual line above, and where to check it. Recheck after the last change to the app.

| Claim | Where it appears | Check against |
|---|---|---|
| 102 infrared bands | Summary, details | `docs/research/spherex-data.md` |
| About 273,000 exposures indexed (273,367 on Nov 14 and on Nov 15) | Details | `/api/meta` on the live site, or the About tab. Rechecked Nov 15, noon |
| Search answers in a fraction of a second: 0.08 to 0.16 s on the live site on Nov 15 once an instance is running, about 20 ms on a development machine | Summary, details | Time `/api/search` on the live site. Rechecked Nov 15, 11:24 am |
| A 5 arcmin frame is about 8 KB, the file 65 MB, and the server reads about 1 MB of it | Details | `README.md`, `docs/methods.md` section 2, `docs/deploy.md` "Speed". Rechecked Nov 15, 11:24 am: 475 images came as 3.9 MB, from 481 MB read |
| New exposures are added twice a week | Details | `.github/workflows/index.yml`. Run by hand on GitHub on Nov 15 at 12:17 pm: it passed in 26 s and republished the same 273,367 exposures |
| Measure Changes flags all five test targets, with the numbers given. WISE 0855 only with detectors 5 and 6 | Summary, details | `docs/methods.md` section 9. Rechecked on the live site on Nov 15, 11:28 am, after the last change to the app. Every number matched |
| Blink against surveys decades older: WISE, 2MASS, and the Digitized Sky Survey | Details | `docs/methods.md` section 13 |
| Water, methane, and other features are marked on the spectrum | Summary, details | `docs/methods.md` section 10 |
| The tool names Measure Changes and Blink | Details | The app's Studies tab and image study |
| FITS files with flags and variance can be saved | Summary, details | `docs/methods.md` section 14 |
| The main stack: Python with FastAPI, NumPy, and Astropy, TypeScript with React and WebGL2, and Aladin Lite | Details | `docs/architecture.md`, `docs/references.md` |
| Deploys run only after every test passes | Details | `.github/workflows/deploy.yml` |
| No account is needed | Details | `docs/deploy.md`, Security |
| The SI answer says Claude built the demo video from recordings of the live tool, with a watermark on every frame | SI question | True for the video rendered from `video/`, which is the demo (`docs/video.md`). If the backup slides are submitted, use the two replacement sentences under the answer |
| The SI answer says Claude listed options or proposed methods for some features | SI question | `docs/decisions.md` (Blink) and `docs/si-usage.md` (the halo measure) |
| The details say the tool is independent of NASA | Details | The app's About tab says the same |
| The SI answer says every source file and every pull request is labeled, and that three commits are not | SI question | Checked by script on Nov 15: no source file lacks the header, every pull request carries the line, and three commits on `main` carry no trailer (`ec252a2`, `80d2140`, and `e79c16e`). `docs/si-usage.md` names all three |
| The References field lists every resource in use | References | Build it again from `docs/references.md` after any change to that file |
