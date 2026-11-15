# Architecture

The technical plan for the concept in `docs/concept.md`. Matt's Claude owns this file. Propose changes in a pull request.

## Shape

| Part | What it is | Owner |
|---|---|---|
| `server/` | Python API. Searches IRSA, reads SPHEREx pixels from AWS S3 with byte-range requests, measures spectra, and relays services that browsers can't call. | Matt |
| `web/src/core/` | The engine in the browser. API client, state, image math, WebGL frame renderer, sky map wrapper, plots, URL state, export. | Matt |
| `web/src/ui/` | Everything the user sees and touches. Layout, components, styles, theme, icons, copy, help. | Austin. Matt adds wiring for new engine tools |
| `web/src/main.tsx`, `web/index.html`, `web/package.json`, `web/vite.config.ts` | Shared entry and config. | Shared. Say so in the pull request before changing them. |
| `docs/` | Team docs. | Shared |

## Why this design

- IRSA search, TAP, and cutouts send no CORS headers, so a relay is required.
- The IRSA cutout service returns 4 to 5 MB per frame and throttles. The server reads only the needed rows from S3 and crops them. A 5 arcmin frame comes back in about 6 KB.
- The PSF and wavelength tables in every Level 2 file are per-detector calibration products. The server caches them once.
- Pixels stay in native detector geometry. The browser places each frame on the sky with its own transform, so nothing is resampled twice.
- Search does not depend on IRSA being up. The server keeps an index of every exposure (time and pointing), built from the S3 bucket alone. A search is a few matrix products and takes about 20 ms. IRSA SIA is the fallback when no index is present.
- New data needs no code change. A scheduled job extends the index twice a week and publishes it as a release asset, which servers download. The list of active releases comes from the IRSA SIA self-description.

## Stack

| Layer | Choice | Reason |
|---|---|---|
| API | Python 3.13, FastAPI, httpx, NumPy, Astropy | Astropy is the reference for FITS, WCS, and time. NASA lists it as a suggested tool. |
| Web | React 19, TypeScript, Vite | Small, fast, and familiar to both sides. |
| State | Zustand | Tiny. Components subscribe to slices, so sliders don't redraw the page. |
| Frame rendering | WebGL2 on a canvas, written in `core` | Blink at 60 fps, stretch and color on the GPU. |
| Sky map | Aladin Lite v3 (CDS), loaded from npm | HiPS, projections, catalogs. NASA lists it as a suggested tool. |
| Hosting | Google Cloud (Austin's decision). One Cloud Run container serves the API and the site. Live address and setup in `docs/deploy.md`. | Scales to zero. Credit covers judging. |

Dependencies stay few. Every new one goes in `docs/references.md` in the same commit.

## Data flow

1. The user gives a name or coordinates. `GET /api/resolve` returns a position, proper motion, and parallax.
2. `GET /api/search` looks up every SPHEREx image that covers the position in the exposure index. It returns one row per image with time, detector, and an estimated wavelength at the target.
3. `POST /api/cutouts` streams the frames. For each one the server reads the needed rows of IMAGE, FLAGS, and VARIANCE from S3, crops them, and measures the target with the cached PSF. Finished frames stay in memory (256 MB, least recently used first out), so a target that was opened before reloads without touching S3.
4. The browser shows frames as they arrive. It groups them by time and wavelength, stacks them, subtracts them, and plots the spectrum.
5. The sky map loads HiPS tiles directly from IRSA. Labels for known objects come through `/api/objects` (SIMBAD). The full-color SPHEREx layer comes from `/api/hips/spherex-color`.
6. `/api/missions` adds Gaia, 2MASS, and WISE data for the field.
7. A planet, asteroid, or comet is followed instead of a fixed position. `/api/resolve` recognizes the name, `/api/moving` matches its JPL Horizons path against the exposure index, and each frame is cut out around the body, corrected for where the spacecraft was.

## The frontend contract

`web/src/core/index.ts` is the only door into the engine. UI code imports from `../core` and nothing deeper.

- State. `useStore(selector)` reads state. The fields are documented on `AppState` in `core/store.ts`.
- Actions. `actions.*` change state. Examples: `actions.search(text)`, `actions.play()`, `actions.setDisplay({ color: true })`, `actions.setSubtract("first")`, `actions.saveAnimation()`.
- Canvas components. `FrameView`, `SkyMap`, `SpectrumPlot`, `LightCurvePlot`, `Timeline`, and `OrbitView` fill the element they are placed in. They carry no chrome. The UI wraps them with controls.
- Lists for menus. `TEST_TARGETS`, `SKY_LAYERS`, `PROJECTIONS`, `COLOR_PRESETS`, `COLOR_MAPS`, and `LINE_FAMILIES`, each with plain-language names and descriptions.
- The UI uses every one of these and is the working example. `ui/App.tsx` holds the page and its bars, `ui/settings.tsx` the top drawer, and `ui/tools.tsx` the tools in the bottom dock.
- Types. Everything exported from `core/types.ts`.

## The page layout

One full screen between a top bar and a bottom bar. Both bars expand. Austin's side designed it.

| Part | File | Holds |
|---|---|---|
| Top bar | `ui/App.tsx`, `ui/SearchBox.tsx` | Name, search box with suggestions, the switch between sky map, images, and both, and the settings drawer |
| Settings drawer | `ui/settings.tsx` | Every setting in two halves: the sky map's on the left, the image study's on the right. The line between them sits where the line between the two views is, and nothing changes place when the view changes |
| Stage | `ui/App.tsx` | The sky map, the image viewer, or both side by side on a wide screen. Both stay mounted while hidden. A details card sits in the corner of the images: name, kind, distance, the link to everything known about the target, and the image on screen. Boxes for clicked objects, spots, and messages lie over the stage |
| Status line | `ui/App.tsx` | Progress on the left, the pointer readout or map help on the right. Fixed height |
| Player | `ui/App.tsx` | Play, step, scrub, speed, and what to play. In the bottom bar while the images are on screen, and put away with them |
| Tool dock | `ui/tools.tsx` | Tabs that open upward: graphs (spectrum, brightness over time, timeline), studies (measure changes, measure movement), telescopes (live map, facts, other telescopes' images of the field), save and share, about. Only the open tool is on the page |

- A new tool usually needs one component and one entry in `TOOLS` in `ui/tools.tsx`.
- `ui/ChangesPanel.tsx`, `ui/FeaturesList.tsx`, and `ui/SearchBox.tsx` are self-contained pieces with their own style files.
- `ui/Embed.tsx` is the compact layout used when the address holds `embed=1`.
- A new study, from a search or a click on the map, brings the images up beside the map on a wide screen (the Both view). The sky map centers on the target and shows its yellow square. A narrow screen keeps its view, and the status line says where the images are.
- `ui/cards.tsx` holds the cards laid over the stage. On the map: the selected area (Copy Coordinates, Close) or an object chosen on the map. A click on the map selects an area and loads it at once. Close ends the study, removes the square, and puts the image study away. Along the top of the images: one list of every object in the field on the left, folded at first, and the details box on the right. A spot clicked in the images gets its own card.
- The lower left of the map shows the coordinates under the pointer and at the center, with a Copy button, and the measured angle while the measure tool is on.
- NASA's test targets are in the Find dropdown and in the image view before a target is chosen.
- Space plays and pauses. The left and right arrows step.

Rules for both sides.

- `core` never imports from `ui`. `ui` never calls `fetch` or the server directly.
- `core` ships no visible styling beyond the canvases. Colors used inside canvases come from CSS variables that `ui` defines.
- A change to an exported name or type is a contract change. Announce it in the pull request title with the prefix `contract:`.
- UI-only state (open panels, theme, tips) lives in `ui`. The exception is which screen is up and which tool is open: the UI owns them but keeps them in the engine (`layout`, `actions.setLayout`), so that a link can carry them.
- A redesign must keep every tool. `docs/ui-checklist.md` is the list, and CI enforces it.

## UI rules (from the team concept)

- Sans-serif, highly readable. No glow, bloom, neon, or gradients for effect.
- A child or an older adult can use it. Large targets, plain words, visible labels, keyboard access.
- Fast. No layout shift while frames load. No blocking spinners over the whole page.
- Works on a phone and on a projector.

## Build order

NASA's stated objectives come first. Each step lands on `main` working.

1. Search, cutout stream, and the frame player with the five test targets.
2. The 102 bands: detector sums, epoch stacks, and the spectrum plot.
3. Change tools: wavelength-matched blink, differences, motion and brightness tracking.
4. The sky map: SPHEREx all-sky channels, other missions, clickable annotations, projections.
5. Solar system objects and the spacecraft view.
6. Links that carry the full view, export, help, and deployment.

## Run it

```sh
# API on port 8000. On first start it downloads the exposure index (12 MB).
cd server && uv sync && uv run uvicorn spherex_api.main:app --reload --port 8000

# Web on port 5173. It proxies /api to port 8000.
cd web && npm install && npm run dev
```

Checks before a pull request.

```sh
cd server && uv run pytest
cd web && npm run typecheck && npm test && npm run build
python3 scripts/check_text.py
```
