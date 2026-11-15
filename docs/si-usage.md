# SI usage log

Space Apps 2026 uses the term "Super Intelligence (SI)" for tools such as Claude Code. We use SI tools and label their output. This log feeds the README and the submission's SI answer.

## Tools

| Tool | Provider | Models |
|---|---|---|
| Claude Code | Anthropic | Claude Opus 5.5, Claude Fable 5.2 |

## How SI output is labeled

- Commits written or co-written by Claude end with a `Co-Authored-By` trailer.
- Source files written with Claude start with a header comment saying so.
- SI-generated images or video carry a visible watermark.
- Notable uses are logged below.

## Background research

Claude gathered the notes in `docs/research/`: SPHEREx data access, test target facts, libraries and services, and Space Apps rules and resources. Matt chose the questions and reviewed the findings. The research came before kickoff, under the Space Apps rule that lets teams research the topic. No project code was written before the event started.

## Log

| Date | Who | What Claude did | Human role |
|---|---|---|---|
| 2026-11-14 | Matt | Set up this repo: CLAUDE.md, README, docs, license, .gitignore, and the writing-rule hook. Moved the research into `docs/research/`. | Matt requested the setup and the public repo |
| 2026-11-14 | Matt | Wrote the architecture, the project skeleton (API, web app, CI, text check), and merged Austin's first pull request. | Matt and Austin set the concept and feature list. Matt named Claude the build lead |
| 2026-11-14 | Matt | Wrote the API data layer (S3 range reader, WCS, wavelength, PSF photometry, cutout stream, exposure index, name lookup) and the browser engine (frame decoder, state, sums, WebGL renderer, spectrum tools). Checked results against Astropy and against 2MASS and WISE fluxes. | Matt and Austin own the concept. Matt directs the work |
| 2026-11-14 | Matt | Reworked the page as Matt asked, one request at a time: searches that keep the view, a coordinates box with Copy, a split settings drawer, one draggable yellow selected area with its card, a Studies tab, a status line with a progress ring, and one list of every object in the field. Added the sky map's coverage overlays (IRSA's own maps), tile grid, and measure tool. | Matt asked for each change. The overlays and tools are the ones on the IRSA site he named |
| 2026-11-14 | Matt | Wrote the walkthrough tour, the Blink tool (an older survey's picture under the image, kept aligned), the FITS and table exports, and the solar system marks on the sky map (orbits from JPL Horizons, placed in the browser). Checked Blink on RW Aurigae and WISE 0855, the FITS files with Astropy, and the positions against Horizons. | Matt asked for each of the four. Blink was his choice from a list of options |
| 2026-11-14 | Matt | Sped up the cold start and the first load (seeded index, parallel reads from the archive, precompressed files). Made a security pass before going live (response headers, a non-root container, CI permissions, ignore files). Commented the code. Reviewed and merged Austin's deployment docs. | Matt asked for the optimization pass, the security check, and the comments |
| 2026-11-14 | Matt | Made links carry the whole view. Gave every study its view box and name on the sky map, moving bodies included. Fixed two selections showing at once, and put the player away with the images. Drew the Sun and the Moon at their true size, checked against JPL Horizons, and made a label click load the object at once. Then built the three items Matt chose next: NASA's test targets in the tour (first all five on its first card, then Barnard's Star alone when Matt asked for that), an image budget that follows the computer, and a reload that comes back to the image on screen. | Matt asked for each. He reported the missing label and the double selection |
| 2026-11-14 | Matt | Wrote the check for known asteroids and comets at a clicked spot (IMCCE SkyBoT), and verified it on Vesta. | The concept asks for every known object to be identified, and for the solar system to be mapped |
| 2026-11-14 | Matt | Regrouped the layout as Matt asked: one settings drawer, a details card in the corner, one tab for graphs, one for telescopes. Wrote the live map of every telescope behind the tool. | Matt asked for each change |
| 2026-11-14 | Matt | Reviewed and merged Austin's full-page layout, and wired the tools it predates into it: search suggestions, the change finder, the feature finder, the halo measure, and the About text. | Matt asked for the review. Austin directed the layout |
| 2026-11-14 | Matt | Added halo measurement for stars too bright for the detector, so Barnard's Star and R Draconis show a spectrum and a light curve. Added the About tab. | Matt asked for the work to continue |
| 2026-11-14 | Matt | Rebuilt the UI as a full-screen layout (top bar, stage, tools panel, chart tray, bottom bar) with every tool carried over, for desktop and phone. | Matt set the layout direction and asked Claude to continue the UI work after Austin's computer failed |
| 2026-11-14 | Matt | Wrote the spectral feature finder (close and wide comparison against the feature library) and checked it on brown dwarfs, a comet, and plain stars. Made engine edits reload the dev page. | The concept asks for tools that make it easier to find water, hydrogen, and other substances in a spectrum |
| 2026-11-14 | Matt | Wrote the search box dropdown: a checked list of 116 well-known objects, matching, recent searches, and a server route that adds asteroids and comets from JPL. | Matt asked for a search bar dropdown |
| 2026-11-14 | Matt | Wrote the change finder (relative astrometry and photometry over the whole field, halo photometry for saturated stars) and checked it on NASA's five test targets. Wrote the server's frame memory and the cache folder ceiling. | The concept asks for changes over time to be highlighted, and for tools that find motion and dimming |
| 2026-11-14 | Matt | Wrote the embed mode (compact layout, embed snippet, link options) and its guide, and fixed a first-draw bug in the image renderer found while testing it. | Matt asked for NASA's embed consideration to be covered |
| 2026-11-14 | Matt | Wrote the sky map, full-color rendering and color sky tiles, shareable links, object labels, image subtraction, Gaia, 2MASS, and WISE overlays, the brightness-over-time tool, export, deployment files, and solar system tracking with JPL Horizons. | Matt asked for full color, J2000 search, and a LAN preview during the build |
| 2026-11-14 | Austin | Rebuilt the UI as a full-page viewer: a top bar with drawers for test targets and image settings, and a bottom bar with the status line, the player or map controls, and a dock of tools. Checked that every control of the old layout still exists, and checked the layout in a headless browser at phone, tablet, laptop, projector, and embed sizes. | Austin asked for the full-page layout with expanding top and bottom bars, no cards, and no lost tools |
| 2026-11-14 | Austin | Researched the Space Apps hosting offers and the Google Cloud setup, wrote the deploy guide (Cloud Shell, the trial's organization limits, Porkbun DNS, Cloud Run domain mapping), and checked the first deploy end to end: name lookup, image search, and one frame read from S3. | Austin chose Google Cloud and the free domain, created the accounts, and ran the deploy |
| 2026-11-14 | Austin | Rewrote the nine tour steps from Austin's notes in `docs/language-refining.md`, and checked each claim against the code (view mode hints, Blink, the Telescopes tab). | Austin wrote the notes and the wording rules, and approved every step before it was applied |
| 2026-11-14 | Austin | Wrote the continuous deployment workflow (deploys `main` only after CI passes on that exact commit) and its keyless Google Cloud setup with Workload Identity Federation, limited to this repository's `main` branch. | Austin asked for deploys that wait on CI, and runs the Google Cloud setup |
| 2026-11-14 | Austin | Drafted the project page summary and project details from the repository docs, checked each claim against `docs/methods.md`, the README, and the live site, and recorded the text and its sources in `docs/submission-text.md`. | Austin asked for each field, reviewed the text, and removed a line about phones |
| 2026-11-14 | Austin | Reworded the README's feature list and examples to the rules in `docs/language-refining.md`: technical terms, no commands, no sales wording. Checked each term against the code and `docs/methods.md`. | Austin wrote the rules and asked for the pass |
| 2026-11-14 | Matt | Measured where a first load spends its time on the live site, priced three instance sizes from Google's list prices, and set the chosen size in the deploy workflow. | Matt chose the size from the options and their cost |
