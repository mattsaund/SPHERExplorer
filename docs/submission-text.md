# Submission text

The text for each field of the Space Apps project page, kept here so it can be checked against the app before the final submission. Claude drafted it from the repository docs. Austin and Matt approve it, and the project page is the copy judges see.

Status, Nov 15: the summary and the project details were pasted into the form on Nov 14, and both have changed since (see the claims table), so they need pasting again. The project link is chosen. The two data fields, the References field, and the SI answer are drafted below and wait for approval. The demo link is still to do. Our Local Event needs the project submitted by Sun Nov 15, 4:20 pm Eastern.

To paste the project details with their formatting, copy them from a rendered view of this file (GitHub's file view works), not from a terminal.

## Project name

SPHERExplorer

## Summary

50 to 200 words, 1,500 characters at most. Now 195 words and 1,149 characters. Plain text.

SPHERExplorer is a free public web tool that plays every SPHEREx image of any position in the sky in time order. NASA's SPHEREx telescope maps the entire sky in 102 infrared bands and images each position many times. Seeing what moved or changed usually means downloading and aligning many large files.

Users search by object name or coordinates. SPHERExplorer finds every exposure in a fraction of a second and steps through the visits, so moving objects shift across the frame. One button checks every source in the field and reports what moved, brightened, or faded. It flags all five of NASA's test targets. Any point has a spectrum across all 102 bands, with features such as water and methane marked. Fields can be compared with Gaia, 2MASS, WISE, and NEOSSat data. Every view has a shareable link, exports to FITS, and can be embedded in other sites.

SPHEREx data is open to everyone but hard to use. SPHERExplorer opens it to students, educators, researchers, and citizen scientists. They can find nearby brown dwarfs, track asteroids and comets, and study how the sky changes. It needs no software or account, and its code is open source.

## Project demonstration

To do. The demo video, uploaded by 3:00 pm Sunday. See `docs/video.md`.

## Project link

https://spherexplorer.earth

The live site, not the repository. Judges can use the tool directly, and its About tab links the source code, the methods, and the SI statement. The repository link is the last line of the project details.

## Project details

No length limit is shown. Now about 870 words.

### What it does

SPHERExplorer is a free web tool for the SPHEREx all-sky infrared survey. Enter an object name or coordinates, and it finds every public SPHEREx image of that position and plays them in time order. Moving objects step across the frame. Each exposure of a position is taken in a different one of 102 infrared bands, so the same images also give a spectrum of any point.

- Search by name, by J2000 RA and Dec in any common form, or by planet, asteroid, or comet.
- Play every exposure, one sum per visit, one per wavelength, or the deepest sum of all.
- Blink against WISE, 2MASS, or the Digitized Sky Survey, taken years to decades earlier.
- Measure Changes checks every source in the field and reports what moved, brightened, or faded between visits.
- Read the spectrum of any point. Water, carbon dioxide, methane, and other features are marked, and the tool reports which actually stand out.
- See every known object in the field, including asteroids and comets, and a sky map with the SPHEREx all-sky survey, channel by channel.
- Compare with Gaia positions, 2MASS and WISE brightness, and NEOSSat images from the Canadian Space Agency where NEOSSat has observed the field.
- Save FITS files with sky coordinates, flags, and variance, plus data tables, pictures, and animations. Every view has a link and can be embedded in other sites.

### How it works

- A Python API reads only the rows it needs from each SPHEREx Level 2 file, straight from the public AWS bucket: about 1 MB of a 65 MB file for a 5 arcmin field. The frame then travels to the browser as about 8 KB.
- Search runs on our own index of all 273,000 exposures and answers in about a tenth of a second. A scheduled job adds new exposures twice a week, so new data releases need no code change.
- Star positions are carried to each image's date with proper motion and parallax. Asteroids and comets follow JPL Horizons paths, corrected for where the spacecraft was.
- Brightness comes from a fit of the point spread function in every frame. For Epsilon Indi B it matches 2MASS and WISE within about 10 percent.
- The browser does the rest with a WebGL2 viewer, sums, spectra, and plots.

### Results we checked

Measure Changes flags each of the five test targets and nothing else in their fields. WISE 0855 needs detectors 5 and 6 selected, the only ones that see it. Barnard's Star moved 10.9 arcsec north in a year (catalog 10.4). Epsilon Indi B moves 4.6 arcsec per year (catalog 4.7). WISE 0855 moved west between visits. RW Aurigae brightened 55 percent at 3.8 to 4.4 microns. R Draconis shows its 245-day pulsation. Each method and its known limits are documented in [docs/methods.md](https://github.com/mattsaund/SPHERExplorer/blob/main/docs/methods.md).

### Benefits

- No download, no software, and no account.
- Images of a target load in seconds, and a target opened recently reloads in about a second.
- Researchers get science-grade files. Students and the public get plain words and a guided tour.
- The code is open source under Apache-2.0.

### Intended impact

SPHEREx data is public but hard to use. SPHERExplorer opens it to classrooms, citizen scientists, and researchers. They can search for nearby brown dwarfs and other moving objects, follow asteroids and comets, find variable stars, and learn what objects are made of. It picks up each new data release on its own, and other sites can embed it.

### Tools and technology

- API in Python 3.13 with FastAPI, Uvicorn, Pydantic, HTTPX, NumPy, Astropy, and Pillow. Web app in TypeScript with React 19, Vite, Zustand, WebGL2, satellite.js, gifenc, and topojson-client. Sky map by Aladin Lite v3 (CDS).
- Data from SPHEREx (IRSA), Gaia (ESA), NEOSSat (CSA), 2MASS, WISE, SIMBAD, JPL, and IMCCE. The full list is in the data fields of this form and in the repository.
- One container on Google Cloud Run, deployed by GitHub Actions only after every test passes. The domain and the cloud credit come from the Space Apps Global Offers.
- No special hardware. We built it on our own computers.
- Built with Claude Code (Anthropic), a Super Intelligence (SI) tool. The team set the idea and the features. The code, tests, and documentation were written with Claude and are labeled in commits, file headers, and [docs/si-usage.md](https://github.com/mattsaund/SPHERExplorer/blob/main/docs/si-usage.md).

### How it is creative

- It uses the way SPHEREx works. Every exposure lands at a different wavelength, so the tool turns a series of images into a spectrum and compares change only at matching wavelengths.
- It measures stars too bright for the detector from the halo around them. Saturated targets such as Barnard's Star still get a rough spectrum and a brightness curve.
- It checks the whole field for change with one button, not only the target.
- Blink brings back the classic blink comparator, against surveys taken decades earlier.

### Factors we considered

- Scientific validity. Positions carried forward in time, matching wavelengths, flagged pixels left out, and every method checked against Astropy and published catalogs.
- Ease of use. A child or an older adult should be able to use it, so the wording is plain and a tour explains each part.
- Speed and cost. Small transfers, caching, and a server that scales to zero when idle.
- Rules and credit. No NASA branding, credit for every data source and library, all SI work labeled, and an open license.
- Durability. The site stays up through judging and picks up new data by itself.

Source code, methods, and every reference: [https://github.com/mattsaund/SPHERExplorer](https://github.com/mattsaund/SPHERExplorer)

## NASA data and resources

Draft for Matt and Austin to approve, written by Claude on Nov 15 from `docs/references.md`.

- SPHEREx Spectral Images, Data Release 1 and Quick Release 3 (Level 2). NASA SPHEREx, through the NASA/IPAC Infrared Science Archive (IRSA). DOI [10.26131/IRSA678](https://doi.org/10.26131/IRSA678) and [10.26131/IRSA662](https://doi.org/10.26131/IRSA662). Every image the tool shows is read from these files, in IRSA's public bucket on AWS.
- SPHEREx Spectral All-Sky Cube, Data Release 1. DOI [10.26131/IRSA679](https://doi.org/10.26131/IRSA679). The base layer of the sky map, channel by channel and in color.
- IRSA services. Image search as a fallback, the SPHEREx coverage maps, and the sky survey tiles from 2MASS, WISE, Spitzer, and other missions that the map layers and Blink use.
- The SPHEREx Explanatory Supplement and the SPHEREx Archive User Guide. The file layout, the flags, and the calibration that the tool relies on.
- JPL Horizons and the JPL Small-Body Database. The paths of planets, asteroids, and comets through the SPHEREx images, and the orbits behind the solar system markers on the sky map.
- The 2MASS and AllWISE source catalogs, from two NASA-funded surveys. The brightness of the same sources, for comparison with SPHEREx.
- The MAST catalog service at STScI. It serves the Gaia DR3 catalog that the tool uses for star positions and motions.

## Space Agency Partner and other data

Draft for Matt and Austin to approve, written by Claude on Nov 15 from `docs/references.md`.

- Canadian Space Agency (CSA). NEOSSat astronomy images, through the Canadian Astronomy Data Centre. Visible-light images of the same field, shown with the SPHEREx images where NEOSSat has observed it. Contains information licensed under the Open Government Licence - Canada.
- European Space Agency (ESA). Gaia DR3: positions, proper motions, and parallaxes of the stars in each field.
- CDS, Strasbourg. SIMBAD for object names and facts, VizieR for the 2MASS and AllWISE catalogs, and Aladin Lite for the sky map.
- IMCCE, Paris Observatory. SkyBoT, which lists the known asteroids, comets, and planets in the field of an image.
- CelesTrak. Orbital elements for the live positions of SPHEREx and the other telescopes.
- Sky survey tiles from DSS2, SDSS, GALEX, IRAS, Herschel, and Planck, served by IRSA.
- NIST Atomic Spectra Database. The wavelengths of the atomic lines marked on spectra.
- Natural Earth. The land outlines on the map of telescope positions.

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
- Claude Code (Anthropic), with the model Claude Fable 5.2. Anthropic terms of service. Labeled in every commit, pull request, and file header. Logged in `docs/si-usage.md`.
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

What the team did. Matt and Austin chose the challenge and set the concept and the feature list, which are recorded as they wrote them in docs/concept.md. They made every product decision (docs/decisions.md), tried each change on the live site, and approved the text of this page.

What SI did. Before kickoff, Claude gathered background notes on the SPHEREx data, the test targets, and the Space Apps rules. During the event, Claude wrote and tested the code, the documentation, and the deployment setup under the team's direction, and measured the results reported here. Claude also drafted the text of this project page, including this answer, and built the demo video from recordings of the live tool.

How it is labeled. Every commit that Claude wrote carries a Co-Authored-By line. Every source file starts with a header that says it was written with Claude Code. Every pull request says the same, and docs/si-usage.md logs each use by date. The demo video carries a visible SI watermark on every frame.

No image or data in the tool is generated by SI. Every picture comes from NASA SPHEREx and the other archives listed on this page, and the tool's code computes its sums, spectra, and measurements from them.

## Claims to recheck before the final submission

Every factual line above, and where to check it. Recheck after the last change to the app.

| Claim | Where it appears | Check against |
|---|---|---|
| 102 infrared bands | Summary, details | `docs/research/spherex-data.md` |
| About 273,000 exposures indexed (273,367 on Nov 14) | Details | `/api/meta` on the live site, or the About tab |
| Search answers in a fraction of a second: about 0.1 s on the live site on Nov 15, about 20 ms on a development machine | Summary, details | Time `/api/search` on the live site |
| A 5 arcmin frame is about 8 KB, the file 65 MB, and the server reads about 1 MB of it | Details | `README.md`, `docs/methods.md` section 2, `docs/deploy.md` "Speed" |
| New exposures are added twice a week | Details | `.github/workflows/index.yml` |
| Measure Changes flags all five test targets, with the numbers given. WISE 0855 only with detectors 5 and 6 | Summary, details | `docs/methods.md` section 9. Rechecked on the live site on Nov 15 |
| Epsilon Indi B matches 2MASS and WISE within about 10 percent | Details | `docs/methods.md` section 4 |
| Blink partners are WISE, 2MASS, and the Digitized Sky Survey | Details | `docs/methods.md` section 13 |
| Water, carbon dioxide, and methane are marked, and the tool says which stand out | Summary, details | `docs/methods.md` section 10 |
| The tool names Measure Changes and Blink | Details | The app's Studies tab and image study |
| FITS files with coordinates, flags, and variance | Summary, details | `docs/methods.md` section 14 |
| The stack and the data sources | Details | `docs/architecture.md`, `docs/references.md` |
| Deploys run only after every test passes | Details | `.github/workflows/deploy.yml` |
| No account is needed | Details | `docs/deploy.md`, Security |
| The SI answer says Claude built the demo video from recordings of the live tool | SI question | True only if the submitted video is the one rendered from `video/`. Change the sentence if the demo is made another way |
| The References field lists every resource in use | References | Build it again from `docs/references.md` after any change to that file |
