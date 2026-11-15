# SPHERExplorer

This file instructs the Claude Code agents that work in this repository. People new to the project should start with `README.md`.

Team repo for the NASA Space Apps Challenge 2026, challenge "Planet X and SPHEREx".
Team: Turing Complete (Matt and Austin). Two Claude Code accounts work in this repo at the same time.

Read this file first. Details live in `docs/`.

## Hackathon window

- Started Sat Nov 14, 2026, 9:00 am local time (Eastern for Matt).
- Our Local Event (Bethesda, MD) needs the demo video uploaded and the project submitted by Sun Nov 15, 4:20 pm Eastern.
- The global form closes Sun Nov 15, 11:59 pm Eastern. Automatic deploys freeze at 11:00 pm.
- Results: Global Nominees Dec 3, Global Finalists Dec 17, Global Winners Jan 26, 2027. The public site must stay up through judging.

## Rule 1: the idea belongs to the humans

Space Apps says "SI should not be used to (come up with your idea of how to solve the challenge)."

- Matt and Austin decide the concept and the feature list. They record it in `docs/concept.md` and log decisions in `docs/decisions.md`.
- Claude implements, researches, tests, and explains technical tradeoffs and constraints.
- Claude does not invent the core concept or new headline features. When a product decision is needed, ask Matt or Austin.

## Rule 2: label all SI work

Space Apps requires SI-generated code and data to be acknowledged "in descriptive text and metadata". Matt's global no-attribution rule does not apply to this repo.

- Commits that Claude writes or co-writes end with a `Co-Authored-By: Claude <model name> <noreply@anthropic.com>` trailer.
- PR descriptions say they were generated with Claude Code.
- Every source file Claude creates starts with a short header comment: what the file does, plus "Written with Claude Code (Anthropic) assistance."
- SI-generated images or video carry a visible watermark. SI-generated audio is acknowledged in text and metadata.
- Log notable SI use in `docs/si-usage.md`.
- Say SI (Super Intelligence), the Space Apps term. Don't use other names for it in docs, UI copy, comments, or commit messages.

## Rule 3: reference everything

Every dataset, library, service, paper, image, and font goes in `docs/references.md` with its license, DOI, and required acknowledgment text. Add it in the same commit that starts using it. The README credits and the submission References field come from that file.

## Rule 4: writing style

Applies to all text: docs, code comments, UI copy, commit messages.

- American English spelling.
- Never use the em dash or the middle dot word separator. Use commas, periods, colons, parentheses, or separate sentences.
- Use colons and semicolons sparingly.
- Short sentences. No large text blocks, long comment blocks, run-on sentences, or filler. Technical and to the point.
- Comment code so a human can follow it.
- A PreToolUse hook (`.claude/settings.json`) blocks edits that contain an em dash or a middle dot.

## Rule 5: design

- This is a professional, educational, robust science tool. No "new age tech" styling. No glow, bloom, neon, or similar effects on buttons or anywhere else.
- Use a highly readable sans-serif font.
- Easy enough for a kid or an older adult to use.
- Efficiency and optimization come first: fast loads, responsive interaction, small payloads.
- Study the IRSA SPHEREx Data Explorer and do better: https://irsa.ipac.caltech.edu/applications/spherex/

## Rule 6: compliance

- No NASA insignia, logos, or branding elements in the app or the demo. Never imply NASA endorsement.
- License is Apache-2.0 (OSI approved, the Space Apps default).
- No images, video, or audio of anyone under 18.
- All submitted text is in English.
- Demo is a video of 30 seconds or less, or at most 7 slides. Over the limit means no global judging.
- Don't read other teams' code. Compare against prior art by name and description only.

## What NASA asks for

From the challenge page: https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/

- A public-facing web tool that displays SPHEREx images of the sky.
- Users enter RA and Dec. The tool shows a series of images of that patch like a little video, so moving objects are easy to spot.
- Test targets: Barnard's Star, Epsilon Indi B, WISE 0855 (RA 08h55m10.831s, Dec -7d14m42.53s), RW Aurigae, R Draconis.
- Optional considerations:
  - Easy to update with new data releases.
  - Creative display of the 102 bands, for example summing each of the six detector arrays for signal-to-noise. Extra kudos for spectra on the fly.
  - Adding or subtracting images taken at different times.
  - User-chosen field of view. Larger fields cost transfer time.
  - Overlays from other telescopes such as Gaia and WISE.
  - Coordinates in the URL so the tool can be embedded elsewhere.
  - Metadata such as contamination flags.
  - Public tools such as Astropy and Aladin (CDS).

Judges score Impact, Creativity, Validity, Relevance, and Presentation from 1 to 5. See `docs/research/challenge-and-rules.md`.

## Data facts that bite

Details in `docs/research/`.

- Query `spherex_dr1`, `spherex_dr1_deep`, `spherex_qr3`, and `spherex_qr3_deep`. QR2 no longer returns results from search. DR1 and QR3 form one uniformly processed set.
- Each exposure of a fixed sky position lands at a different wavelength (linear variable filters). Compare like wavelengths when looking for change.
- High proper motion targets have moved. Barnard's Star is 270" from its J2000 position, Eps Ind B 122", and WISE 0855 is 127" west of NASA's coordinate. Propagate positions to each observation epoch.
- WISE 0855 is only visible above about 3.9 microns (detectors D5 and D6), at S/N 1.4 to 6.6 per frame.
- Barnard's Star, R Dra, and Eps Ind A saturate. Saturated cores are NaN.
- IRSA SIA, TAP, and cutouts send no CORS headers, so browsers can't call them directly. The S3 bucket `nasa-irsa-spherex` and IRSA HiPS allow browser access.
- The cutout service throttles (HTTP 503, Retry-After 5). Each cutout is 4 to 5 MB because the PSF extension is copied whole.
- CDS (SIMBAD, VizieR, Aladin CDN, alasky HiPS) is degraded. Use the CfA and IDIA mirrors, and load Aladin Lite from npm or jsDelivr.

## Two Claudes, one repo

- Matt's Claude: data access, backend, science logic, heavy lifting.
- Austin's Claude: hosting and deployment (since the evening of Nov 14). Before that: UI, styling, fonts, buttons, polish.
- Matt's Claude leads the build. It reviews and merges every pull request, checks every push, and checks that the work follows the Space Apps rules. It also carries the UI work now.
- Directory ownership. Each side edits only its own directories.
  - Matt: `server/`, `web/src/core/`, `scripts/`, `.github/`.
  - Austin: `web/src/ui/`.
  - Shared: `web/src/main.tsx`, `web/index.html`, `web/package.json`, `web/vite.config.ts`, `docs/`. Say so in the pull request before changing them.
- The shared contract is `web/src/core/index.ts`. UI code imports from `../core` only. Title a pull request that changes an exported name or type with the prefix `contract:`.
- Read `docs/architecture.md` before starting. Pull `main` often, because the contract grows as features land.
- No tool may be lost in a UI change. `docs/ui-checklist.md` lists every tool and the engine pieces behind it. `scripts/check_ui_coverage.py` fails a pull request whose UI stops using one. Run `scripts/check_all.sh` before opening a pull request.
- Both sides may edit `web/src/ui/`. Austin's side owns layout and style. Matt's side adds the wiring a new engine tool needs, in small commits, and adds its row to the checklist.
- `main` is the live site. A push to it deploys once CI passes, so nothing is committed to `main` directly (Matt's decision, Nov 14).
- Work lands on `dev` first: small commits there, or pull requests from `matt/<topic>` and `austin/<topic>` branches. `main` changes only by a pull request from `dev`, after its checks pass.
- Small commits. `git pull --rebase` before pushing. Never force-push `main` or `dev`.
- Personal settings go in `.claude/settings.local.json` and `CLAUDE.local.md`. Both are gitignored.
- More in `docs/team/workflow.md`.

## Key files

| File | Purpose |
|---|---|
| `docs/concept.md` | The team's concept and Matt's original notes (human-written) |
| `docs/architecture.md` | Technical plan, stack, ownership, the frontend contract, and how to run it |
| `docs/deploy.md` | How to put the site online (one container on Google Cloud Run) |
| `docs/methods.md` | How each result is computed and how it was checked |
| `docs/ui-checklist.md` | Every tool the UI must offer, checked in CI |
| `scripts/update_solar.py` | Renews the orbits behind the solar system marks on the sky map. Run every few months |
| `docs/embedding.md` | Link options and how to embed the viewer in another page |
| `docs/video.md` | Scope, storyboard, and pipeline for the 30-second demo video |
| `docs/decisions.md` | Human decision log |
| `docs/si-usage.md` | SI usage log |
| `docs/references.md` | Every source, license, DOI, and acknowledgment |
| `docs/submission-checklist.md` | Everything the Space Apps submission needs |
| `docs/submission-text.md` | The text for each project page field, and the claims to recheck before submitting |
| `docs/research/` | Research on the challenge, data, targets, services, and partner data |
| `docs/team/workflow.md` | Collaboration and Claude Code workflow |
