# Submission text

The text of each field of the Space Apps project page, kept here so it can be checked against the app. Claude drafted the first version from the repository docs. Matt and Austin then edited the summary and the details in the form, and the text below is what the public page shows. The project page is the copy judges see: https://www.spaceappschallenge.org/2026/find-a-team/turing-complete/?tab=project

Status, Nov 15, 10:16 pm Eastern: the project is submitted and public. The page's record gives 10:15 pm for the submission and 10:15 pm for the last save. The name, the summary, both links, the details, and both link lists below were read from the public page at 10:16 pm. The SI answer does not show on the public page, so only Matt and Austin can check it, in the form.

## Project name

SPHERExplorer

## Summary

The form suggests 50 to 200 words, and its box takes 1,500 characters (Matt, Nov 15). The text on the page is 193 words and 1,177 characters. Plain text.

SPHERExplorer is a free web tool that allows for easy interaction with SPHEREx data by playing every SPHEREx image of any sky position in time order. Seeing what moved or changed usually means downloading and aligning large files manually.

Users can search by object name or coordinates. SPHERExplorer finds every exposure and steps through the visits, so moving objects shift across the frame. One button checks every source in the field and reports what moved, brightened, or faded. It flags all five of NASA's test targets, WISE 0855 with its two longest-wavelength detectors selected. Any point has a spectrum across all 102 bands, with features such as water and methane marked. Fields can be compared with Gaia, 2MASS, WISE, and NEOSSat data. Every view has a link, exports to FITS, and can be embedded in other sites.

SPHEREx data is open to everyone but hard to use for those without technical backgrounds. Our tool, SPHERExplorer, makes it easier to use and review SPHEREx data in one application, opening it to students, educators, researchers, and citizen scientists. They can find nearby stars, track asteroids and comets, and study how the sky changes over time.

## Project demonstration

https://www.youtube.com/watch?v=EtcNxZPPJSA

The demo video on YouTube, uploaded by Matt on Nov 15 at 2:27 pm Eastern. Checked at 2:28 pm with no login: it is public, YouTube's player shows 29 seconds, and its description carries the SI statement and the acknowledgments. Paste the full link into the form.

## Project link

https://www.spherexplorer.earth

The live site, not the repository. `https://spherexplorer.earth` serves the same site. Judges can use the tool directly, and its About tab links the source code, the methods, and the SI statement. The repository link is the first and the last line of the project details.

## Project details

No length limit is shown. About 650 words. This is the text on the page, as Matt and Austin edited it in the form.

### GitHub:

[https://github.com/mattsaund/SPHERExplorer](https://github.com/mattsaund/SPHERExplorer)

### What it does

SPHERExplorer is a free web tool for interacting with data from NASA's SPHEREx all-sky infrared survey. It allows you to enter a name or coordinates, and then it plays every public SPHEREx image of that position in time order, so moving objects step across the frame. Each image is taken in a different one of 102 infrared bands, so the same images also give a spectrum.

- Search by name, by coordinates, or by planet, asteroid, or comet.
- Play every exposure, each visit, each wavelength, or the deepest sum, over a field 1 to 50 arcminutes wide.
- Measure Changes checks every source in the field and reports what moved, brightened, or faded.
- Read the spectrum of any point, with water, methane, and other features marked.
- Compare with Gaia, 2MASS, WISE, and NEOSSat from the Canadian Space Agency, and blink against surveys decades older.
- Save FITS files, data tables, and animations. Every view has a link that can be shared or embedded.

### How it works

- The server reads only the rows it needs from each 65 MB SPHEREx file, about 1 MB, and sends the browser about 8 KB per image.
- Search runs on our own index of all 273,000 exposures in about a tenth of a second. New exposures are added twice a week, with no code change.
- Stars are moved to each image's date by their proper motion. Asteroids and comets follow JPL Horizons paths.
- Brightness comes from a point spread function fit in every frame.

### Results we checked

"Measure Changes" checks every source in a 5 arcmin field around each test target and flags only the target, with no false alarms (WISE 0855 with detectors 5 and 6). Barnard's Star moved 10.9 arcsec north in a year (catalog 10.4), and Epsilon Indi B moves 4.6 arcsec a year (catalog 4.7). RW Aurigae brightened 55 percent in the infrared, and R Draconis shows its 245-day pulsation. Every method and its limits are in [docs/methods.md](https://github.com/mattsaund/SPHERExplorer/blob/main/docs/methods.md).

### Benefits and impact

SPHEREx data is public but it's hard to use without a technical background. SPHERExplorer opens it to classrooms, citizen scientists, and researchers, with no download and no account. Researchers get science-grade files, and students get plain words and a guided tour. It picks up each new data release on its own, and its code is open source.

### How it is creative

- Every SPHEREx exposure lands at a different wavelength, so the tool turns a series of images into a spectrum, and compares change only at matching wavelengths.
- Stars too bright for the detector are measured from the halo around them, so Barnard's Star still gets a rough spectrum.
- One button checks the whole field for change in objects, not just the selected target.

### Tools and technology

- Python (FastAPI, NumPy, Astropy) and TypeScript (React, WebGL2), with Aladin Lite for the sky map.
- A container on Google Cloud Run serves the site. GitHub Actions used for deploying after all tests pass. Both the domain and the cloud credit come from the Space Apps Global Offers.
- Built using Claude Code (Anthropic), a Super Intelligence (SI) tool. The team set and owned the idea, features, and direction. Claude's code and docs are labeled in commits, file headers, and [docs/si-usage.md](https://github.com/mattsaund/SPHERExplorer/blob/main/docs/si-usage.md).

### Factors we considered

We considered many factors, but in rough order of importance, we considered: scientific validity (positions are carried forward to each image's date, matching wavelengths, and checking all results against published catalogs), ease of use (a child or a non-technical older adult can use it), and speed and cost optimization (small transfers, keeping hosting and usage costs low).

SPHERExplorer is an independent team project. It is not an official NASA product and is not endorsed by NASA.

Source code, methods, and all references in our [GitHub](https://github.com/mattsaund/SPHERExplorer).

## NASA data, and Space Agency Partner and other data

The page has 14 links under NASA Data and 25 under Space Agency Partner & Other Data (10:16 pm). They are the data sources, the services, the code libraries, and the tools. `docs/submission/submissionreferences.md` has every row as a Link Text and a Link Url, with what each is used for. The form has no References field.

## The SI question

Draft for Matt and Austin to approve, written by Claude on Nov 15 from `docs/si-usage.md`. Judges do not see this answer. They do see the SI labels inside the project. The written answer does not show on the public page, so this is the draft and not a copy of the form.

The public page's record does list the kinds of SI use ticked in the form (read at 6:32 pm):

- Coding, Debugging, or Troubleshooting
- Writing, Editing, or Translation
- Visual Design or Image Creation
- Presentation, Video, or Audio
- Data Analysis and Interpretation
- Research or Information Gathering
- Other Project-Related SI Use

The draft answer:

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
| About 273,000 exposures indexed (273,367 on Nov 14 and on Nov 15) | Details | `/api/meta` on the live site, or the About tab. Rechecked Nov 15, 6:30 pm |
| Search answers in about a tenth of a second | Details | Time `/api/search` on the live site once an instance is running. Rechecked Nov 15, 6:35 pm, from request to first byte: 0.08 to 0.19 s for four of the test targets, and 0.40 s for R Draconis, which has 2,486 images. About 20 ms on a development machine |
| A 5 arcmin frame is about 8 KB, the file 65 MB, and the server reads about 1 MB of it | Details | `README.md`, `docs/methods.md` section 2, `docs/deploy.md` "Speed". Rechecked Nov 15, 11:24 am: 475 images came as 3.9 MB, from 481 MB read |
| New exposures are added twice a week | Details | `.github/workflows/index.yml`. Run by hand on GitHub on Nov 15 at 12:17 pm: it passed in 26 s and republished the same 273,367 exposures |
| Measure Changes checks every source in a 5 arcmin field around each test target and flags only the target, with no false alarms, and with the numbers given. WISE 0855 only with detectors 5 and 6 | Summary, details | `docs/methods.md` section 9. Rechecked on the live site on Nov 15 at 6:32 pm, after the last deploy. Each field gave one change, the target: among 10 sources for Barnard's Star, 8 for Epsilon Indi B, 16 for WISE 0855 with detectors 5 and 6, 29 for RW Aurigae, and 2 for R Draconis. Every number matched. With all six detectors WISE 0855 is not flagged, as the text says |
| Blink against surveys decades older: WISE, 2MASS, and the Digitized Sky Survey | Details | `docs/methods.md` section 13 |
| Water, methane, and other features are marked on the spectrum | Summary, details | `docs/methods.md` section 10 |
| The tool names Measure Changes and Blink | Details | The app's Studies tab and image study |
| FITS files, data tables, and animations can be saved, and every view has a link that can be shared or embedded | Summary, details | `docs/methods.md` sections 14 and 17, `docs/embedding.md` |
| Results were checked against published catalogs | Details | `docs/methods.md` section 9 has each test target beside its catalog value. Sections 5 and 15 compare solar system positions with JPL Horizons |
| The main stack: Python with FastAPI, NumPy, and Astropy, TypeScript with React and WebGL2, and Aladin Lite | Details | `docs/architecture.md`, `docs/references.md` |
| Deploys run only after every test passes | Details | `.github/workflows/deploy.yml` |
| No account is needed | Details | `docs/deploy.md`, Security |
| The SI answer says Claude built the demo video from recordings of the live tool, with a watermark on every frame | SI question | True for the video rendered from `media/code/`, which is the demo (`docs/submission/video.md`). If the backup slides are submitted, use the two replacement sentences under the answer |
| The SI answer says Claude listed options or proposed methods for some features | SI question | `docs/decisions.md` (Blink) and `docs/si-usage.md` (the halo measure) |
| The details say the tool is independent of NASA | Details | The app's About tab says the same |
| The summary on the page is 193 words and 1,177 characters | Summary | Counted on Nov 15 at 10:16 pm from the public page. The form suggests 50 to 200 words, and its box takes 1,500 characters |
| The SI answer says every source file and every pull request is labeled, and that four commits are not | SI question | Checked by script on Nov 15: no source file lacks the header, every pull request carries the line, and four commits on `main` carry no trailer (`ec252a2`, `80d2140`, `e79c16e`, and `9bffc8c`). `docs/si-usage.md` names all four. The commits were counted again at 2:46 pm |
| The demo is 30 seconds or less and opens with no login | Demo | YouTube's player shows 29 seconds. Opened with no login on Nov 15 at 2:28 pm |
| The two link lists name the data sources, the services, the code libraries, and the tools in use | NASA data, partner and other data | Read from the public page on Nov 15 at 10:16 pm: 14 links and 25 links, each one in `docs/submission/submissionreferences.md`, where each was checked against the code. All 43 links on the page answered at 6:45 pm. Papers and formulas are in `docs/references.md`, which one row links |
