# Contributing to SPHERExplorer

Thanks for your interest in the project. This guide covers how to set up a working copy, where the code lives, the checks every change must pass, and the rules the project follows.

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
| `video/` | Builds the demo video from captures of the live site. |
| `docs/` | Documentation. `docs/README.md` says where each document is. `docs/architecture.md`, `docs/interface.md`, and `docs/methods.md` are the places to start. `docs/glossary.md` explains the terms. |

## Checks

`scripts/check_all.sh` runs everything CI runs. Run it before opening a pull request. The pieces:

```sh
cd server && uv run pytest
cd web && npm run typecheck && npm test && npm run build
python3 scripts/check_text.py
python3 scripts/check_ui_coverage.py
```

- `check_text.py` enforces the writing rules below.
- `check_ui_coverage.py` fails when the interface stops using a tool listed in `docs/ui-checklist.md`. A change can move, rename, or restyle any tool, but it can't drop one.

## Rules

### Design

- One highly readable sans-serif. No glow, bloom, neon, or gradients for effect.
- A child or an older adult should be able to use it: large targets, plain words, visible labels, and keyboard access.
- Fast: no layout shift while images load, and no spinner that blocks the whole page.
- Built for desktop screens and projectors. Phones work but aren't optimized.

### Writing

- American English, in short, plain sentences.
- No em dashes and no middle dots. `check_text.py` rejects them.
- Text in the app uses technical terms: bands, objects, and wavelengths, not colors and things. `docs/team/language-refining.md` has the full rules.
- Tools such as Claude Code are called SI (Super Intelligence), the term NASA Space Apps uses.

### Sources and credit

- Every dataset, library, service, image, and font goes in `docs/references.md`, with its license and required credit, in the same commit that starts using it.
- Nothing may use NASA logos or branding, or suggest that NASA endorses the project.

### SI tools

If you use an SI tool, label its work the way the rest of the project does:

- A `Co-Authored-By` trailer on each commit it wrote or helped write.
- A header comment on each new source file, ending "Written with Claude Code (Anthropic) assistance." or naming the tool you used.
- A row in `docs/si-usage.md` for notable use.
- A visible watermark on any image or video it generated.

### The engine and the interface

- A change to an exported name or type in `web/src/core/index.ts` is a contract change. Start the pull request title with `contract:`.
- A new engine tool gets a row in `docs/ui-checklist.md`, so the coverage check knows about it.

## Pull requests

1. Branch from `dev`, and open the pull request against `dev`.
2. CI must pass. A maintainer reviews the change and merges it.
3. `main` changes only through a pull request from `dev`. Once CI passes on `main`, the site deploys automatically (`docs/deploy.md`, "Continuous deployment").

Deploys freeze at 11:00 pm Eastern on Nov 15, 2026, so the site stays as submitted through judging. Removing the freeze in `.github/workflows/deploy.yml` turns automatic deploys back on.

## Reporting a problem

Open an issue on GitHub. Say what you did, what you expected, and what happened. Include the link from "Copy link" under Save and share, which reopens your exact view.

## License

Contributions are released under the [Apache License 2.0](LICENSE), the license of the project.
