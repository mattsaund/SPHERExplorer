# Interface

How the page is laid out and how it behaves. The design reasons and the engine behind it are in `docs/architecture.md`. Every tool the page must keep is listed in `docs/ui-checklist.md`.

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
- `ui/cards.tsx` holds the cards laid over the stage. On the map: the selected area (Copy Coordinates, Close) or an object chosen on the map. A click on the map selects an area and loads it at once. A click on an object's label does the same for that object, and its card shows its facts. That holds for a planet, asteroid, or comet too. Its square starts on its marker and the map does not move. Playing the film then sends the square along the body's path. The Sun and the Moon have no images, so they only show their card. Close ends the study, removes the square, and puts the image study away. Along the top of the images: one list of every object in the field on the left, folded at first, and the details box on the right. A spot clicked in the images gets its own card.
- The lower left of the map shows the coordinates under the pointer and at the center, with a Copy button, and the measured angle while the measure tool is on.
- NASA's test targets are in the Find dropdown and in the image view before a target is chosen.
- Space plays and pauses. The left and right arrows step.

Rules for both sides.

- `core` never imports from `ui`. `ui` never calls `fetch` or the server directly.
- `core` ships no visible styling beyond the canvases. Colors used inside canvases come from CSS variables that `ui` defines.
- A change to an exported name or type is a contract change. Announce it in the pull request title with the prefix `contract:`.
- UI-only state (open panels, theme, tips) lives in `ui`. The exception is which screen is up and which tool is open: the UI owns them but keeps them in the engine (`layout`, `actions.setLayout`), so that a link can carry them.
- A redesign must keep every tool. `docs/ui-checklist.md` is the list, and CI enforces it.
