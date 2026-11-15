# Submission text

The text for each field of the Space Apps project page, kept here so it can be checked against the app before the final submission. Claude drafted it from the repository docs. Austin and Matt approve it, and the project page is the copy judges see.

Status, Nov 15, noon: the summary and the project details were pasted into the form on Nov 14, and both have changed since (see the claims table), so they need pasting again. The project link is chosen. The two data fields, the References field, and the SI answer are drafted below and wait for approval. The demo video is a rendered draft that waits for approval and an upload. Matt set 4:00 pm Eastern on Sun Nov 15 as the team's deadline for all of it. The Local Event's cutoff on record is 4:20 pm.

To paste the project details with their formatting, copy them from a rendered view of this file (GitHub's file view works), not from a terminal.

## Project name

SPHERExplorer

## Summary

50 to 200 words, 1,500 characters at most. Now 198 words and 1,182 characters. Plain text.

SPHERExplorer is a free web tool that plays every SPHEREx image of any sky position in time order. NASA's SPHEREx telescope maps the entire sky in 102 infrared bands and images each position many times. Seeing what moved or changed usually means downloading and aligning large files.

Users search by object name or coordinates. SPHERExplorer finds every exposure in a fraction of a second and steps through the visits, so moving objects shift across the frame. One button checks every source in the field and reports what moved, brightened, or faded. It flags all five of NASA's test targets, WISE 0855 with its two longest-wavelength detectors selected. Any point has a spectrum across all 102 bands, with features such as water and methane marked. Fields can be compared with Gaia, 2MASS, WISE, and NEOSSat data. Every view has a link, exports to FITS, and can be embedded in other sites.

SPHEREx data is open to everyone but hard to use. SPHERExplorer opens it to students, educators, researchers, and citizen scientists. They can find nearby brown dwarfs, track asteroids and comets, and study how the sky changes. It needs no software or account, and its code is open source.

## Project demonstration

To do. A draft cut is rendered: 28.5 s, from the live site, with the SI watermark on every frame (`docs/video.md`, "Draft cut, Nov 15"). It needs the team's approval, an upload to a public host, and the full `https://` link pasted here.

## Project link

https://spherexplorer.earth

The live site, not the repository. Judges can use the tool directly, and its About tab links the source code, the methods, and the SI statement. The repository link is the last line of the project details.

## Project details

No length limit is shown. Now about 870 words.

### What it does

SPHERExplorer is a free web tool for the SPHEREx all-sky infrared survey. Enter an object name or coordinates, and it finds every public SPHEREx image of that position and plays them in time order. Moving objects step across the frame. Each exposure of a position is taken in a different one of 102 infrared bands, so the same images also give a spectrum of any point.

- Search by name, by J2000 RA and Dec in any common form, or by planet, asteroid, or comet.
- Play every exposure, one sum per visit, one per wavelength, or the deepest sum of all. Sum any of the six detectors for a cleaner picture, subtract one visit from another, or make a color image from three wavelength ranges.
- Choose the field of view, from 1 to 50 arcminutes.
- Blink against WISE, 2MASS, or the Digitized Sky Survey, taken years to decades earlier.
- Measure Changes checks every source in the field and reports what moved, brightened, or faded between visits.
- Read the spectrum of any point. Water, carbon dioxide, methane, and other features are marked, and the tool reports which actually stand out.
- See the best-known objects in the field, every known asteroid and comet that was in it when the image was taken, and a sky map with the SPHEREx all-sky survey, channel by channel.
- Overlay Gaia stars, each moved to where it was on the image's date. Compare with 2MASS and WISE brightness, and with NEOSSat images from the Canadian Space Agency where NEOSSat has observed the field.
- See the archive's quality flags on the image, pixel by pixel.
- Save FITS files with sky coordinates, flags, and variance, plus data tables, pictures, and animations. Every view has a link that carries its coordinates, and the tool can be embedded in other sites.

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

- Scientific validity. Positions carried forward in time, matching wavelengths, flagged pixels left out, and results checked against Astropy and published catalogs. `docs/methods.md` says how each was checked.
- Ease of use. A child or an older adult should be able to use it, so the wording is plain and a tour explains each part.
- Speed and cost. Small transfers, caching, and a server that scales to zero when idle.
- Rules and credit. No NASA branding, credit for every data source and library, SI work labeled, and an open license.
- Durability. The site stays up through judging and picks up new data by itself.

SPHERExplorer is an independent team project. It is not an official NASA product and is not endorsed by NASA.

Source code, methods, and every reference: [https://github.com/mattsaund/SPHERExplorer](https://github.com/mattsaund/SPHERExplorer)

## NASA data and resources

Draft for Matt and Austin to approve, written by Claude on Nov 15 from `docs/references.md`.

- SPHEREx Spectral Images, Data Release 1 and Quick Release 3 (Level 2). NASA SPHEREx, through the NASA/IPAC Infrared Science Archive (IRSA). DOI [10.26131/IRSA678](https://doi.org/10.26131/IRSA678) and [10.26131/IRSA662](https://doi.org/10.26131/IRSA662). Every SPHEREx image in the film is read from these files, in IRSA's public bucket on AWS.
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

What SI did. Before kickoff, Claude gathered background notes on the SPHEREx data, the test targets, libraries and services, and the Space Apps rules. During the event, Claude wrote and tested the code, the documentation, and the deployment setup under the team's direction, and measured the results reported here. For some features Claude listed the options or proposed a method, and the team decided. The decision log and the SI log say where, for example Blink and the measurement of stars too bright for the detector. Claude also drafted the text of this project page, including this answer, and helped write and time the script of the demo video, which the team recorded on the live site.

How it is labeled. Commits that Claude wrote carry a Co-Authored-By line. Three commits are exceptions, two early merges made with GitHub's default text and one README edit, and docs/si-usage.md names them. Every source file starts with a header that says it was written with Claude Code. Every pull request says the same, and docs/si-usage.md logs the notable uses by date. The demo video is a recording by the team, and its description names Claude's help with the script.

No picture in the tool is generated by SI. Every image comes from NASA SPHEREx and the other archives listed on this page, and the tool's code computes its sums, spectra, and measurements from them. The tool's reference lists (spectral features, well-known objects for the search box, and facts about the telescopes) were compiled by Claude from the published sources in docs/references.md.

If the fallback video is submitted instead (the cut built from code in `video/`), replace the sentence about the demo video in "What SI did" with "Claude also built the demo video from recordings of the live tool", and the last sentence of "How it is labeled" with "The demo video carries a visible SI watermark on every frame."

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
| Epsilon Indi B matches 2MASS and WISE within about 10 percent | Details | `docs/methods.md` section 4 |
| Blink partners are WISE, 2MASS, and the Digitized Sky Survey | Details | `docs/methods.md` section 13 |
| Water, carbon dioxide, and methane are marked, and the tool says which stand out | Summary, details | `docs/methods.md` section 10 |
| The tool names Measure Changes and Blink | Details | The app's Studies tab and image study |
| FITS files with coordinates, flags, and variance | Summary, details | `docs/methods.md` section 14 |
| The stack and the data sources | Details | `docs/architecture.md`, `docs/references.md` |
| Deploys run only after every test passes | Details | `.github/workflows/deploy.yml` |
| No account is needed | Details | `docs/deploy.md`, Security |
| The SI answer says the team recorded the demo video and Claude helped with its script | SI question | True for the team's recording (`docs/video.md`). If the fallback cut from `video/` is submitted, use the two replacement sentences under the answer |
| The SI answer says Claude listed options or proposed methods for some features | SI question | `docs/decisions.md` (Blink) and `docs/si-usage.md` (the halo measure) |
| The details say the tool is independent of NASA | Details | The app's About tab says the same |
| The details name the best-known objects in the field, not every object | Details | The app asks SIMBAD for the 150 most cited objects in the field (`store.ts`) |
| The SI answer says every source file and every pull request is labeled, and that three commits are not | SI question | Checked by script on Nov 15: no source file lacks the header, every pull request carries the line, and three commits on `main` carry no trailer (`ec252a2`, `80d2140`, and `e79c16e`). `docs/si-usage.md` names all three |
| The References field lists every resource in use | References | Build it again from `docs/references.md` after any change to that file |
