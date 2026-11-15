# Architecture

How SPHERExplorer is built and why: its parts, the data flow, and the contract between the engine and the interface. The concept it serves is in `docs/concept.md`.

## Shape

| Part | What it is |
|---|---|
| `server/` | Python API. Searches IRSA, reads SPHEREx pixels from AWS S3 with byte-range requests, measures spectra, and relays services that browsers can't call. |
| `web/src/core/` | The engine in the browser. API client, state, image math, WebGL frame renderer, sky map wrapper, plots, URL state, export. |
| `web/src/ui/` | Everything the user sees and touches. Layout, components, styles, theme, icons, copy, help. |
| `web/src/main.tsx`, `web/index.html`, `web/package.json`, `web/vite.config.ts` | Shared entry and config. |
| `docs/` | Documentation for users and developers, and the hackathon record. |

## The engine's folders

`web/src/core/index.ts` and `web/src/core/types.ts` sit at the top. Everything else is in a folder named for what it does. A test sits beside the file it tests.

| Folder | What it holds |
|---|---|
| `state/` | The store, the link in the address bar, and the selected field |
| `search/` | The search box's suggestions and its lists of well-known objects |
| `net/` | Calls to the SPHERExplorer server |
| `sky/` | Positions, motions, orbits, and the sky map's layers |
| `images/` | Frames, sums, color, and the WebGL renderer |
| `science/` | Brightness, spectra, features, motion, and the change finder |
| `export/` | Saved pictures, animations, and FITS files |
| `views/` | The React components that draw the map, the images, and the plots |

## The server's folders

`server/spherex_api/` is one Python package. Its top holds the routes (`main.py`), the settings (`config.py`), the shared network and cache code, and the exposure index (`index_build.py` and `exposures.py`).

| Folder | What it holds |
|---|---|
| `images/` | Reading SPHEREx files from the archive: layouts, calibration, cutouts, brightness, and FITS output |
| `objects/` | What a name means and what is at a place: name lookup, catalogs, distances, and solar system bodies |
| `telescopes/` | The other telescopes: partner images, nearby catalog sources, and where SPHEREx is now |
| `skymap/` | What the sky map draws from SPHEREx: coverage maps and color tiles |

## Why this design

- IRSA search, TAP, and cutouts send no CORS headers, so a relay is required.
- The IRSA cutout service returns 4 to 5 MB per frame and throttles. The server reads only the needed rows from S3 and crops them. A 5 arcmin frame comes back in about 8 KB.
- The PSF and wavelength tables in every Level 2 file are per-detector calibration products. The server caches them once.
- Pixels stay in native detector geometry. The browser places each frame on the sky with its own transform, so nothing is resampled twice.
- Search does not depend on IRSA being up. The server keeps an index of every exposure (time and pointing), built from the S3 bucket alone. A search is a few matrix products and takes about 20 ms on a development machine and about 0.1 s on the live site. IRSA SIA is the fallback when no index is present.
- New data needs no code change. A scheduled job extends the index twice a week and publishes it as a release asset, which servers download. The list of active releases comes from the IRSA SIA self-description.

## Stack

| Layer | Choice | Reason |
|---|---|---|
| API | Python 3.13, FastAPI, httpx, NumPy, Astropy | Astropy is the reference for FITS, WCS, and time. NASA lists it as a suggested tool. |
| Web | React 19, TypeScript, Vite | Small, fast, and familiar to both sides. |
| State | Zustand | Tiny. Components subscribe to slices, so sliders don't redraw the page. |
| Frame rendering | WebGL2 on a canvas, written in `core` | Blink at 60 fps, stretch and color on the GPU. |
| Sky map | Aladin Lite v3 (CDS), loaded from npm | HiPS, projections, catalogs. NASA lists it as a suggested tool. |
| Hosting | Google Cloud. One Cloud Run container serves the API and the site. Live address and setup in `docs/deploy.md`. | Scales to zero. Credit covers judging. |

Dependencies stay few. Every new one goes in `docs/references.md` in the same commit.

## Data flow

1. The user gives a name or coordinates. `GET /api/resolve` returns a position, proper motion, and parallax.
2. `GET /api/search` looks up every SPHEREx image that covers the position in the exposure index. It returns one row per image with time, detector, and an estimated wavelength at the target.
3. `POST /api/cutouts` streams the frames. For each one the server reads the needed rows of IMAGE, FLAGS, and VARIANCE from S3, crops them, and measures the target with the cached PSF. The reads are blocking requests on worker threads, and the computing runs on worker threads too, so every processor works on one target and the event loop only hands the work out. Each finished frame is packed once (`cutout.pack`), kept in memory in that form (256 MB by default and 1024 MB on the live site, least recently used first out), and sent in that form. A target that was opened before reloads without touching S3 or the processor.
4. The browser shows frames as they arrive. It groups them by time and wavelength, stacks them, subtracts them, and plots the spectrum.
5. The sky map loads HiPS tiles directly from IRSA. Labels for known objects come through `/api/objects` (SIMBAD). The full-color SPHEREx layer comes from `/api/hips/spherex-color`.
6. `/api/missions` adds Gaia, 2MASS, and WISE data for the field.
7. A planet, asteroid, or comet is followed instead of a fixed position. `/api/resolve` recognizes the name, `/api/moving` matches its JPL Horizons path against the exposure index, and each frame is cut out around the body, corrected for where the spacecraft was.

## The frontend contract

`web/src/core/index.ts` is the only door into the engine. UI code imports from `../core` and nothing deeper.

- State. `useStore(selector)` reads state. The fields are documented on `AppState` in `core/state/store.ts`.
- Actions. `actions.*` change state. Examples: `actions.search(text)`, `actions.play()`, `actions.setDisplay({ color: true })`, `actions.setSubtract("first")`, `actions.saveAnimation()`.
- Helpers that read the state. `fieldCenter(state)` is where the studied field is on the sky (it moves with the film for a planet or comet), `fieldDate(state)` the date of the image on screen, and `isStudied(state, object)` whether an object from the map is the study's target.
- Canvas components. `FrameView`, `SkyMap`, `SpectrumPlot`, `LightCurvePlot`, `Timeline`, and `OrbitView` fill the element they are placed in. They carry no chrome. The UI wraps them with controls.
- Long work stays off the page's back. `core/images/layers.ts` makes a large sum in the background, a slice at a time, and `summing` in the state holds how many images are being added up, for the status line. `FrameView` keeps its picture until the sum is there.
- Lists for menus. `TEST_TARGETS`, `SKY_LAYERS`, `PROJECTIONS`, `COLOR_PRESETS`, `COLOR_MAPS`, and `LINE_FAMILIES`, each with plain-language names and descriptions.
- The UI uses every one of these and is the working example. `ui/App.tsx` holds the page and its bars, `ui/settings.tsx` the top drawer, and `ui/tools.tsx` the tools in the bottom dock.
- Types. Everything exported from `core/types.ts`.

Rules for both sides.

- `core` never imports from `ui`. `ui` never calls `fetch` or the server directly.
- `core` ships no visible styling beyond the canvases. Colors used inside canvases come from CSS variables that `ui` defines.
- A change to an exported name or type is a contract change. Announce it in the pull request title with the prefix `contract:`.
- UI-only state (open panels, theme, tips) lives in `ui`. The exception is which screen is up and which tool is open: the UI owns them but keeps them in the engine (`layout`, `actions.setLayout`), so that a link can carry them.
- A redesign must keep every tool. `docs/ui-checklist.md` is the list, and CI enforces it.

## The page layout

The layout, the cards, and how the page behaves are described in `docs/interface.md`.
