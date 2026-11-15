# Decision log

Matt and Austin record project decisions here, newest first. The log shows which choices came from the team. That supports the "originality, intent" part of judging.

| Date | Decision | Decided by | Notes |
|---|---|---|---|
| 2026-11-14 | The player bar is on the page only while the image study is up | Matt | It goes away with the images on the map-only screen. Space and the arrow keys still work |
| 2026-11-14 | Only one thing is selected at a time | Matt reported two selections at once as a glitch | A new study lets go of the object chosen before it |
| 2026-11-14 | A directly selected object still gets the view box, so its zoom and framing can be changed | Matt | Every study has the yellow square with the target's name on it. A planet or comet moves, so its square is where the image on screen was taken, and the map follows it |
| 2026-11-14 | Links carry the whole view | Matt | The screen, the open tool, the image on screen with its zoom and brightness, the spectrum settings, and where the map looks. `docs/embedding.md` lists every option |
| 2026-11-14 | A major optimization pass, to bring the cold start and the load time down | Matt | Measured before and after. See "Speed" in `docs/deploy.md` |
| 2026-11-14 | Domain name `spherexplorer.earth`, with `www.spherexplorer.earth` too | Austin | The free domain from the Space Apps offer. It matches the project name and keeps NASA out of it |
| 2026-11-14 | The site goes live on Cloud Run in `us-east4`, paid by the Google Cloud Free Trial. The free domain is registered at Porkbun and will point at the site through Cloud Run domain mapping | Austin | Claude recommended domain mapping over Firebase Hosting (60 second request limit) and a load balancer (monthly fee). Details in `docs/deploy.md` |
| 2026-11-14 | Add the planets and dwarf planets to the sky map, everything | Matt | From the concept ("fully map our solar system"). The Sun, the Moon, 7 planets, Pluto, 9 more dwarf planets and likely ones, 13 asteroids, 6 comets, and the 3 known interstellar visitors, where they are right now |
| 2026-11-14 | Implement exports of the scans | Matt | From his own notes ("export scans"). FITS for the image on screen and for every loaded image, plus the brightness table and the change report |
| 2026-11-14 | A Blink button in the image study, to compare with an older picture of the same sky | Matt | Claude listed it as an option after NASA named WiseView as a model. Matt chose it. Partners: WISE (2010), 2MASS (1997 to 2001), and the Digitized Sky Survey |
| 2026-11-14 | A popup walkthrough tutorial | Matt | Opens on a first visit and from Help. It loads a real example so every step has something to show |
| 2026-11-14 | The blue circle of an object stays in the image study when that object is selected as the target | Matt | It used to be dropped under the yellow target marker. Names that would print over each other now show once |
| 2026-11-14 | The selected area box on the sky map has the same color as the other boxes | Matt | Every box over the map and the images now shares one color |
| 2026-11-14 | The objects box always starts collapsed | Matt | It opens by itself only when an object's label is clicked in the image |
| 2026-11-14 | The Both screen comes up when there is a selected area | Matt | On a wide screen, from the map view. This replaces the earlier choice that a search never changes the view |
| 2026-11-14 | The details box moves to the upper right of the image study and takes the look of the pointer and center box on the sky map | Matt | Rows of label, value, and button. It gained a Center row with Copy |
| 2026-11-14 | A selected area loads at once, with no Select button. Its card keeps Copy Coordinates and Close. Close also closes the image study and removes the square | Matt | A click on the map, or dropping the square, starts the load |
| 2026-11-14 | In the objects card, all the objects can be hidden, and so can the facts of each one. The orange "fast mover" pill goes | Matt | The heading folds the whole list. A checkbox takes the marks off the image. What is hidden stays hidden when the view changes. A fast mover is said in plain words beside its kind |
| 2026-11-14 | Austin's Claude moves to the hosting side. Matt's Claude stays the lead, checks every push, and checks compliance with the hackathon rules | Matt | Roles updated in `CLAUDE.md` |
| 2026-11-14 | One card on the image side lists every object in the field. Each row opens and closes. It replaces the "Known asteroid or comet?" button and the fast-mover pop-ups | Matt | Fast movers come first. The last row asks which asteroids, comets, and planets were in the image on screen |
| 2026-11-14 | The selected area card says "Selected area", then the coordinates and size, then three buttons: Select, Copy Coordinates, Close. Everything is one yellow square. It appears with a search and goes away on Close | Matt | "Select" loads the area without changing the view |
| 2026-11-14 | The selector mark on the map is a yellow crosshair, like the target marker in the images | Matt | Asked for green first, then yellow |
| 2026-11-14 | The Examples drop-down leaves the top bar | Matt | NASA's test targets stay in the Find dropdown and in the empty image view |
| 2026-11-14 | No loading card. The bottom bar says "Loading images x/x" beside a circular progress ring | Matt | The note about a sampled large field moved into the status line |
| 2026-11-14 | The sky map gets the overlays of the IRSA site: SPHEREx spectral images, SPHEREx deep fields, the grid, and a measure tool | Matt | The coverage maps are IRSA's own files. The grid is the HEALPix tile grid, beside the coordinate grid |
| 2026-11-14 | "What changed" and "Motion" become one tab named "Studies". Its two studies are named "Measure Changes" and "Measure Movement" | Matt | |
| 2026-11-14 | The study box moves when dragged from inside | Matt | Dragging its edge still resizes it |
| 2026-11-14 | The settings drawer gets divider lines. Sky map settings sit on the left, image study settings on the right, and the line between them sits where the line between the two views is | Matt | |
| 2026-11-14 | The current coordinates show in the lower left of the sky map, with a button that copies them | Matt | Pointer and center. Copy takes the center |
| 2026-11-14 | A search moves both the sky map and the study to the target. The image window never comes up by itself | Matt | The view buttons, the player, and "Study" buttons bring it up |
| 2026-11-14 | Every graph goes in one tab. The other telescopes and the live map go in one tab, with maps for the other satellites and telescopes | Matt | Graphs tab and Telescopes tab |
| 2026-11-14 | Map settings and image settings are one drawer, so they do not jump around | Matt | The player is always the bottom bar |
| 2026-11-14 | The target's details are a card in the corner of the image, not a tab at the bottom | Matt | The card folds to one line |
| 2026-11-14 | A selected area and the yellow study area never show on the map together | Matt | One square at a time |
| 2026-11-14 | Austin's full-page layout is the UI. Matt's Claude merged it, retired its own stand-in layout, and carried the newer tools into Austin's | Matt asked for Austin's branch to be reviewed once it reached GitHub | Kept from the stand-in: map and images side by side on a wide screen, where a search from the map then shows in both. Austin's side can change that |
| 2026-11-14 | Matt's Claude takes over the UI redesign while Austin's computer is down. Nothing from Austin's branch had reached GitHub | Matt | Full screen with a top bar and a bottom bar, as decided earlier. Austin's side reviews it when back |
| 2026-11-14 | The search box gets a dropdown of suggestions | Matt | Recent searches and NASA's targets first, then matching names, coordinates, asteroids, and comets |
| 2026-11-14 | The study area stays capped at 60 arcminutes for now | Matt asked. Claude explained the limits | Wavelength drift, geometry, and data size all grow past 1 degree. The sky map covers wider views |
| 2026-11-14 | Cover NASA's embed consideration: coordinates in the URL query the tool, so other sites and projects can embed it | Matt | `docs/embedding.md`. Compact layout with `embed=1`, and a "Copy embed code" button |
| 2026-11-14 | The UI moves from stacked cards to a full-screen layout with top and bottom bars. Austin's Claude builds it. No tool may be lost | Matt | Enforced by `docs/ui-checklist.md` and a CI check |
| 2026-11-14 | The selected area on the map is a square, resizable with the mouse | Matt | It is the true shape of the loaded field |
| 2026-11-14 | Show the distance in the details box, and link to the page with everything known about the object | Matt | Asked for during the build |
| 2026-11-14 | Search by J2000 RA and Dec in every common written form | Matt | Asked for during the build |
| 2026-11-14 | Add full color: three-band color images and a color SPHEREx sky | Matt | Asked for during the build |
| 2026-11-14 | Share a live preview on the local network for Austin's workstation | Matt | `npm run dev:lan` |
| 2026-11-14 | Concept and feature list set. See `docs/concept.md` | Matt and Austin | Full use of SPHEREx for every field of space science |
| 2026-11-14 | Matt's Claude leads the build and reviews and merges pull requests from Austin's side | Matt | |
| 2026-11-14 | Docs use the term SI only and carry no date stamps from before kickoff | Matt | Space Apps SI wording |
| 2026-11-14 | Global Offers: use Google Cloud (site hosting, IRSA relay backend, cutout cache) and the GoDaddy free domain. Skip Azure, Planetary Computer, Meteomatics, and both Copilots | Austin | Claude laid out the tradeoffs. The Google credit runs to about Feb 12, 2027, past judging. The Azure credit ends about Dec 14, before Global Finalists |
| 2026-11-14 | Team name: Turing Complete | Matt and Austin | Goes in the demo intro and on the project page |
| 2026-11-14 | Public GitHub repo with an Apache-2.0 license | Matt asked for a public repo. Claude set Apache-2.0, the Space Apps default. | Team can change the license |
| 2026-11-14 | Project name SPHERExplorer | Matt | Repo created at kickoff |
| 2026-11-14 | Label every SI use and reference every source. Matt's global no-attribution rule is off for this repo | Matt | Space Apps SI rules |
| 2026-11-14 | Roles: Matt's Claude does data, backend, and heavy lifting. Austin's Claude does UI, styling, and polish | Matt | |
