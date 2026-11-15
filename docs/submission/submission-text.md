# Submission text

The text for each field of the Space Apps project page, kept here so it can be checked against the app before the final submission. Claude drafted it from the repository docs. Austin and Matt approve it, and the project page is the copy judges see.

Status, Nov 15, 2:50 pm: the summary and the project details were pasted into the form on Nov 14, and both have changed since (see the claims table), so they need pasting again. The project link is chosen. The two link lists and the SI answer are below and wait for approval. The form has no References field. The demo video is on YouTube, and its link is under "Project demonstration". Matt set 4:00 pm Eastern on Sun Nov 15 as the team's deadline for all of it. The Local Event's cutoff on record is 4:20 pm. Since 1:22 pm only two things in the text for the form have changed: the demo link (2:30 pm) and one sentence of the SI answer, which now says four commits (2:50 pm).

To paste the project details with their formatting, copy them from a rendered view of this file (GitHub's file view works), not from a terminal.

## Project name

SPHERExplorer

## Summary

50 to 200 words, 1,500 characters at most. Now 199 words and 1,202 characters. Plain text. This is the text on the project page at 2:56 pm on Nov 15, with the two edits made in the form.

SPHERExplorer is a free web tool that plays every SPHEREx image of any sky position in time order. NASA's SPHEREx telescope maps the entire sky in 102 infrared bands and images each position many times. Seeing what moved or changed usually means downloading and aligning large files manually.

Users search by object name or coordinates. SPHERExplorer finds every exposure in a fraction of a second and steps through the visits, so moving objects shift across the frame. One button checks every source in the field and reports what moved, brightened, or faded. It flags all five of NASA's test targets, WISE 0855 with its two longest-wavelength detectors selected. Any point has a spectrum across all 102 bands, with features such as water and methane marked. Fields can be compared with Gaia, 2MASS, WISE, and NEOSSat data. Every view has a link, exports to FITS, and can be embedded in other sites.

SPHEREx data is open to everyone but hard to use. SPHERExplorer opens it to students, educators, researchers, and citizen scientists. They can find nearby brown dwarfs, track asteroids and comets, and study how the sky changes. SPHERExplorer needs no software or account, and its code is open source.

## Project demonstration

https://www.youtube.com/watch?v=EtcNxZPPJSA

The demo video on YouTube, uploaded by Matt on Nov 15 at 2:27 pm Eastern. Checked at 2:28 pm with no login: it is public, YouTube's player shows 29 seconds, and its description carries the SI statement and the acknowledgments. Paste the full link into the form.

## Project link

https://spherexplorer.earth

The project page has `https://www.spherexplorer.earth`, which serves the same site. The live site, not the repository. Judges can use the tool directly, and its About tab links the source code, the methods, and the SI statement. The repository link is the last line of the project details.

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

Draft for Matt and Austin to approve, written by Claude on Nov 15 from `docs/references.md`. The form takes each entry as a Link Text and a Link Url. Click Add New Link once per row, and paste the first two columns. Every link opened in a browser on Nov 15. Which field: NASA data and resources are NASA missions and NASA-run or NASA-funded archives and services. Everything else goes under Space Agency Partner and other data, with the partner agency (CSA or ESA) named in the link text. The form has no References field, so the code libraries and the tools go under Space Agency Partner and other data too, as the rows under "Code and tools".

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

Draft for Matt and Austin to approve, written by Claude on Nov 15 from `docs/references.md`. The form takes each entry as a Link Text and a Link Url. Click Add New Link once per row, and paste the first two columns. Every link opened in a browser on Nov 15. Which field: NASA data and resources are NASA missions and NASA-run or NASA-funded archives and services. Everything else goes under Space Agency Partner and other data, with the partner agency (CSA or ESA) named in the link text. The form has no References field, so the code libraries and the tools go under Space Agency Partner and other data too, as the rows under "Code and tools".

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

### Code and tools

Add these 26 rows under Space Agency Partner and other data. The form asks there for "any code, text, and images (even if they are open source or freely available)", and it has no other place for them. Every link answered on Nov 15 at 3:11 pm. If time is short, the first 14 rows and the last one matter most: they are the code inside the tool, the SI tool, and the complete list.

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

One row above can go: the NEOSSat tutorial was read, and no code or data came from it. WiseView and the IRSA SPHEREx Data Explorer were studied, not used as code or data. They stay because the challenge names WiseView as a model and the coverage overlays follow the Data Explorer.

## References

Not a form field. Screenshots of the form on Nov 15 at 3:05 pm show two link lists, NASA Data and Space Agency Partner & Other Data, and nothing after them. The complete list stays in `docs/references.md`, and the last row of "Code and tools" links it.

What an audit against the code found on Nov 15 at 3:10 pm:

- Every data and service row in the two lists is called or loaded by the code: its host or its package is in `server/`, `web/src/`, or the dependency files. The three exceptions were read or studied only: the NEOSSat tutorial, WiseView, and the IRSA SPHEREx Data Explorer.
- Not rows in the form, because the row for the resource covers them: the papers that the archives ask to be cited, the survey papers for the map layers, sub-packages, type definitions, single CI steps, and single cloud services.
- Not rows in the form, because the tool does not use them: HITRAN2020 (named in `docs/references.md` as a source to check against), the IRSA TAP and cutout services, and the papers that were background reading (Bock, Akeson, Korngut, Meisner, Gagné, Rustamkulov, and Chen).
- Formulas and published values that the code does use (the effective PSF, the repeated median, error diffusion, Vincenty's formula, Meeus and the Astronomical Almanac, ice band positions, flux zero points, and cosmological parameters) are in `docs/references.md` with their papers.

## The SI question

Draft for Matt and Austin to approve, written by Claude on Nov 15 from `docs/si-usage.md`. Judges do not see this answer. They do see the SI labels inside the project.

Yes. We used Claude Code (Anthropic), with the models Claude Opus 5.5 and Claude Fable 5.2.

What the team did. Matt and Austin chose the challenge and set the concept and the feature list, which are recorded as they wrote them in docs/concept.md. They made the product decisions (docs/decisions.md), tried the changes on the live site, and approved the text of this page.

What SI did. Before kickoff, Claude gathered background notes on the SPHEREx data, the test targets, libraries and services, and the Space Apps rules. During the event, Claude wrote and tested the code, the documentation, and the deployment setup under the team's direction, and measured the results reported here. For some features Claude listed the options or proposed a method, and the team decided. The decision log and the SI log say where, for example Blink and the measurement of stars too bright for the detector. Claude also drafted the text of this project page, including this answer, and built the demo video from recordings of the live tool.

How it is labeled. Commits that Claude wrote carry a Co-Authored-By line. Four commits are exceptions, three merges made with default text and one README edit, and docs/si-usage.md names them. Every source file starts with a header that says it was written with Claude Code. Every pull request says the same, and docs/si-usage.md logs the notable uses by date. The demo video carries a visible SI watermark on every frame, and its description says it is SI-generated.

No picture in the tool is generated by SI. Every image comes from NASA SPHEREx and the other archives listed on this page, and the tool's code computes its sums, spectra, and measurements from them. The tool's reference lists (spectral features, well-known objects for the search box, and facts about the telescopes) were compiled by Claude from the published sources in docs/references.md.

If the backup slide deck is submitted in place of the video (`docs/submission/video.md`), replace "built the demo video from recordings of the live tool" with "drafted the demo slides, with screenshots of the live tool", and the last sentence of "How it is labeled" with "Each demo slide carries an SI note in its footer."

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
| The SI answer says Claude built the demo video from recordings of the live tool, with a watermark on every frame | SI question | True for the video rendered from `media/code/`, which is the demo (`docs/submission/video.md`). If the backup slides are submitted, use the two replacement sentences under the answer |
| The SI answer says Claude listed options or proposed methods for some features | SI question | `docs/decisions.md` (Blink) and `docs/si-usage.md` (the halo measure) |
| The details say the tool is independent of NASA | Details | The app's About tab says the same |
| The summary on the page is 199 words and 1,202 characters | Summary | Counted on Nov 15 at 2:58 pm from the text above |
| The SI answer says every source file and every pull request is labeled, and that four commits are not | SI question | Checked by script on Nov 15: no source file lacks the header, every pull request carries the line, and four commits on `main` carry no trailer (`ec252a2`, `80d2140`, `e79c16e`, and `9bffc8c`). `docs/si-usage.md` names all four. The commits were counted again at 2:46 pm |
| The demo is 30 seconds or less and opens with no login | Demo | YouTube's player shows 29 seconds. Opened with no login on Nov 15 at 2:28 pm |
| The two link lists name every data source, service, code library, and tool in use | NASA data, partner and other data | Checked against the code on Nov 15 at 3:10 pm: each row's host or package is in the code or the dependency files. Papers and formulas are in `docs/references.md`, which the last row links |
