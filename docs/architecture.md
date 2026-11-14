# Architecture

The technical plan for the concept in `docs/concept.md`. Matt's Claude owns this file. Propose changes in a pull request.

## Shape

| Part | What it is | Owner |
|---|---|---|
| `server/` | Python API. Searches IRSA, reads SPHEREx pixels from AWS S3 with byte-range requests, measures spectra, and relays services that browsers can't call. | Matt |
| `web/src/core/` | The engine in the browser. API client, state, image math, WebGL frame renderer, sky map wrapper, plots, URL state, export. | Matt |
| `web/src/ui/` | Everything the user sees and touches. Layout, components, styles, theme, icons, copy, help. | Austin |
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
| Hosting | Google Cloud (Austin's decision). Cloud Run for the API, static files on a CDN. | Scales to zero. Credit covers judging. |

Dependencies stay few. Every new one goes in `docs/references.md` in the same commit.

## Data flow

1. The user gives a name or coordinates. `GET /api/resolve` returns a position, proper motion, and parallax.
2. `GET /api/search` looks up every SPHEREx image that covers the position in the exposure index. It returns one row per image with time, detector, and an estimated wavelength at the target.
3. `POST /api/cutouts` streams the frames. For each one the server reads the needed rows of IMAGE, FLAGS, and VARIANCE from S3, crops them, and measures the target with the cached PSF.
4. The browser shows frames as they arrive. It groups them by time and wavelength, stacks them, subtracts them, and plots the spectrum.
5. The sky map loads HiPS tiles directly from IRSA. Labels for known objects come through `/api/objects` (SIMBAD). The full-color SPHEREx layer comes from `/api/hips/spherex-color`.
6. `/api/missions` adds Gaia, 2MASS, and WISE data for the field.
7. A planet, asteroid, or comet is followed instead of a fixed position. `/api/resolve` recognizes the name, `/api/moving` matches its JPL Horizons path against the exposure index, and each frame is cut out around the body, corrected for where the spacecraft was.

## The frontend contract

`web/src/core/index.ts` is the only door into the engine. UI code imports from `../core` and nothing deeper.

- State. `useStore(selector)` reads state. The fields are documented on `AppState` in `core/store.ts`.
- Actions. `actions.*` change state. Examples: `actions.search(text)`, `actions.play()`, `actions.setDisplay({ color: true })`, `actions.setSubtract("first")`, `actions.saveAnimation()`.
- Canvas components. `FrameView`, `SkyMap`, `SpectrumPlot`, `LightCurvePlot`, and `Timeline` fill the element they are placed in. They carry no chrome. The UI wraps them with controls.
- Lists for menus. `TEST_TARGETS`, `SKY_LAYERS`, `PROJECTIONS`, `COLOR_PRESETS`, `COLOR_MAPS`, and `LINE_FAMILIES`, each with plain-language names and descriptions.
- The starter UI in `ui/App.tsx` uses every one of these. It is the working example.
- Types. Everything exported from `core/types.ts`.

Rules for both sides.

- `core` never imports from `ui`. `ui` never calls `fetch` or the server directly.
- `core` ships no visible styling beyond the canvases. Colors used inside canvases come from CSS variables that `ui` defines.
- A change to an exported name or type is a contract change. Announce it in the pull request title with the prefix `contract:`.
- UI-only state (open panels, theme, tips) lives in `ui`.

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
