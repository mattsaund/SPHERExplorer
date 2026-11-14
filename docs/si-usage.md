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
| 2026-11-14 | Matt | Added halo measurement for stars too bright for the detector, so Barnard's Star and R Draconis show a spectrum and a light curve. Added the About tab. | Matt asked for the work to continue |
| 2026-11-14 | Matt | Rebuilt the UI as a full-screen layout (top bar, stage, tools panel, chart tray, bottom bar) with every tool carried over, for desktop and phone. | Matt set the layout direction and asked Claude to continue the UI work after Austin's computer failed |
| 2026-11-14 | Matt | Wrote the spectral feature finder (close and wide comparison against the feature library) and checked it on brown dwarfs, a comet, and plain stars. Made engine edits reload the dev page. | The concept asks for tools that make it easier to find water, hydrogen, and other substances in a spectrum |
| 2026-11-14 | Matt | Wrote the search box dropdown: a checked list of 116 well-known objects, matching, recent searches, and a server route that adds asteroids and comets from JPL. | Matt asked for a search bar dropdown |
| 2026-11-14 | Matt | Wrote the change finder (relative astrometry and photometry over the whole field, halo photometry for saturated stars) and checked it on NASA's five test targets. Wrote the server's frame memory and the cache folder ceiling. | The concept asks for changes over time to be highlighted, and for tools that find motion and dimming |
| 2026-11-14 | Matt | Wrote the embed mode (compact layout, embed snippet, link options) and its guide, and fixed a first-draw bug in the image renderer found while testing it. | Matt asked for NASA's embed consideration to be covered |
| 2026-11-14 | Matt | Wrote the sky map, full-color rendering and color sky tiles, shareable links, object labels, image subtraction, Gaia, 2MASS, and WISE overlays, the brightness-over-time tool, export, deployment files, and solar system tracking with JPL Horizons. | Matt asked for full color, J2000 search, and a LAN preview during the build |
