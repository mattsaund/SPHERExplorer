# Decision log

Matt and Austin record project decisions here, newest first. The log shows which choices came from the team. That supports the "originality, intent" part of judging.

| Date | Decision | Decided by | Notes |
|---|---|---|---|
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
