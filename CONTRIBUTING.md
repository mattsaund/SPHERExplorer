# Contributing to SPHERExplorer

**SPHERExplorer is not open to contributions right now.**

It is team Turing Complete's entry in the NASA Space Apps Challenge 2026, and it is being judged. An entry is the team's own work. From the submission on Nov 15, 2026, the repo stays as submitted until the winners are announced on Jan 26, 2027. So we are not taking pull requests.

You are welcome to read the code, run it, and fork it under its license. If the repo opens to contributions after judging, this file will say so.

The rest of this page is how the team works in this repo: the setup, where things live, the checks, and our rules. They are our own rules. We wrote them for ourselves, and we hold every change to them.

## Set up

You need Python 3.12 or newer with [uv](https://docs.astral.sh/uv/), and Node.js 22 with npm. The README's "Run it locally" section starts the API and the web app.

To work on the interface without Python, point the web dev server at the live API instead of a local one:

```sh
cd web
npm install
API_TARGET=https://spherexplorer.earth npm run dev
```

## Where things live

| Folder | What it holds |
|---|---|
| `server/` | The Python API. It searches the exposure index, reads SPHEREx pixels from the public S3 bucket, and relays services that browsers can't call. |
| `server/spherex_api/` | The package. Its top holds the routes (`main.py`), the settings, the shared network and cache code, and the exposure index. |
| `server/spherex_api/images/` | Reading SPHEREx files: layouts, calibration, cutouts, brightness, and FITS output. |
| `server/spherex_api/objects/` | Name lookup, catalogs, distances, and solar system bodies. |
| `server/spherex_api/telescopes/` | Partner images, nearby catalog sources, and where SPHEREx is now. |
| `server/spherex_api/skymap/` | The coverage maps and color tiles that the sky map draws. |
| `server/tests/` | The API tests. |
| `web/src/core/` | The engine in the browser: state, image math, the WebGL renderer, the sky map wrapper, and plots. Everything it offers goes through `web/src/core/index.ts`. |
| `web/src/core/state/` | The store, the link in the address bar, and the selected field. |
| `web/src/core/search/` | The search box's suggestions and its lists of well-known objects. |
| `web/src/core/net/` | Calls to the SPHERExplorer server. |
| `web/src/core/sky/` | Positions, motions, orbits, and the sky map's layers. |
| `web/src/core/images/` | Frames, sums, color, and the WebGL renderer. |
| `web/src/core/science/` | Brightness, spectra, features, motion, and the change finder. |
| `web/src/core/export/` | Saved pictures, animations, and FITS files. |
| `web/src/core/views/` | The React components that draw the map, the images, and the plots. |
| `web/src/ui/` | The interface. It imports only from `../core`. |
| `scripts/` | Checks and maintenance scripts. |
| `media/` | What the team shows people: `videos/`, `slides/`, and `pictures/`. `media/code/` builds the demo video from captures of the live site. |
| `docs/` | Documentation. `docs/README.md` says where each document is. `docs/architecture.md`, `docs/interface.md`, and `docs/methods.md` are the places to start. `docs/glossary.md` explains the terms. |

## Checks

`scripts/check_all.sh` runs everything CI runs. We run it before every commit. The pieces:

```sh
cd server && uv run pytest
cd web && npm run typecheck && npm test && npm run build
python3 scripts/check_text.py
python3 scripts/check_ui_coverage.py
```

- `check_text.py` holds the writing to the rules below.
- `check_ui_coverage.py` fails when the interface stops using a tool listed in `docs/ui-checklist.md`. We can move, rename, or restyle any tool, and we never drop one.

## Our rules

These are the standards we set for the project. The checks above keep most of them for us, and we keep the rest by review.

### Design

- We use one highly readable sans-serif, with no glow, bloom, neon, or gradients for effect.
- A child or an older adult can use the tool. That means large targets, plain words, visible labels, and keyboard access.
- It stays fast. Nothing shifts on the page while images load, and no spinner blocks the whole page.
- We build for desktop screens and projectors. Phones work, and they are not what we tune for.

### Writing

- We write American English in short, plain sentences.
- We use no em dashes and no middle dots. `check_text.py` rejects them.
- Text in the app uses the proper terms, such as bands, objects, and wavelengths. `docs/team/language-refining.md` has the notes.
- We call tools such as Claude Code SI (Super Intelligence), the term NASA Space Apps uses.

### Sources and credit

- Every dataset, library, service, image, and font is in `docs/references.md` with its license and its credit. It goes in with the same commit that starts using it.
- We use no NASA logos or branding, and nothing here suggests that NASA endorses the project.

### SI tools

The idea and the features are the team's, recorded in `docs/concept.md` and `docs/decisions.md`. We use SI tools to build them, and we label that work wherever it appears:

- A `Co-Authored-By` trailer on each commit an SI tool wrote or helped write.
- A header comment on each source file it created, ending "Written with Claude Code (Anthropic) assistance."
- A row in `docs/si-usage.md` for notable use.
- A visible watermark on any image or video it generated.

### The engine and the interface

- `web/src/core/index.ts` is the contract between the two. A change to a name or type it exports gets a pull request title that starts with `contract:`.
- Every engine tool has a row in `docs/ui-checklist.md`, so the coverage check knows about it.

## How a change lands

1. Work starts on a branch from `dev`, and its pull request goes to `dev`.
2. CI passes. The team reviews the change and merges it.
3. `main` changes only through a pull request from `dev`. Once CI passes on `main`, the site deploys automatically (`docs/deploy.md`, "Continuous deployment").

For the submission, deploys freeze at 11:00 pm Eastern on Nov 15, 2026, and the repo at 11:30 pm, so the site and the code stay as submitted through judging. Removing the freeze in `.github/workflows/deploy.yml` turns automatic deploys back on.

## Reporting a problem

Issues are open. Say what you did, what you expected, and what happened, and include the link from "Copy link" under Save and share, which reopens your exact view. We read every one. A fix waits until judging ends, because the repo stays as submitted until then.

## License

SPHERExplorer is released under the [Apache License 2.0](LICENSE).
