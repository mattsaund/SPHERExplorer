# Decision log

Matt and Austin record project decisions here. The log shows which choices came from the team, which supports the "originality, intent" part of judging.

## Major decisions

The choices that shaped the project, summarized from the full log below. Each names who made it.

### The project

- Matt and Austin set the concept and the feature list at kickoff on Nov 14. It is recorded word for word in `docs/concept.md`.
- Matt named the project SPHERExplorer, and Matt and Austin chose the team name, Turing Complete.
- Matt asked for a public repository. It uses Apache-2.0, the Space Apps default license.
- Matt set the rule that every SI use is labeled and every source is referenced.

### What the tool does

- The interface is one full screen between a top bar and a bottom bar, and no redesign may drop a tool (Matt). Austin's full-page layout became that interface.
- Search takes object names and J2000 coordinates in any common written form, with a dropdown of suggestions (Matt).
- Images can be shown in full color, from three wavelength ranges, and the sky map has a color SPHEREx layer (Matt).
- The Studies tab holds the two change tools, Measure Changes and Measure Movement, and Blink compares an image with an older survey of the same sky (Matt).
- The sky map carries the overlays of the IRSA site and the whole solar system: planets, dwarf planets, asteroids, comets, and interstellar objects at their current positions (Matt).
- Every view has a link that reopens it, and the viewer can be embedded in other sites, which covers NASA's embedding consideration (Matt).
- Pictures, animations, and data can be saved, at full quality (Matt).
- The study area is capped at 50 arcminutes (Matt, Nov 15).
- The app's wording is technical and plain, without sales language (Austin). The rules are in `docs/team/language-refining.md`.
- Speed comes first, with no compromise on what the tool does (Matt).

### Hosting and delivery

- Google Cloud hosts the site and the free domain gives it an address, both from the Space Apps Global Offers (Austin).
- The site runs as one container on Cloud Run in `us-east4`, at https://spherexplorer.earth (Austin).
- The server uses the second generation runtime with 4 processors, 4 GB, and at most 2 instances, the fastest size measured (Matt).
- A push to `main` deploys only after CI passes on that commit (Austin). Deploys freeze at 11:00 pm Eastern on Nov 15, so the judged site stays as submitted (Austin).
- Work lands on a separate branch before it reaches `main` (Matt).

## Full log

Newest first.

| Date | Decision | Decided by | Notes |
|---|---|---|---|
| 2026-11-15 | The `video/` folder is `media/`, with four folders: `code`, `pictures`, `videos`, and `slides`. The finished video is kept in the repo | Matt | The folder holds what the team shows people. The code that makes the video is in `media/code/`, and its raw captures, frames, and installed packages stay out of the repo. The video is 13 MB. The slide deck goes in `media/slides/` |
| 2026-11-15 | A full cleanup of the repo: files grouped into folders, docs grouped and indexed, merged branches deleted, and an audit for dead code | Matt | "We have a lot of stuff everywhere." The engine's 64 files are in eight folders and the server's modules in four, with nothing but paths changed. Six docs keep their paths because pages outside the repo link to them. The audit found no dead code beyond one style rule. Details in `docs/architecture.md` and `docs/README.md` |
| 2026-11-15 | The video names the team in full, Matthew Saunders and Austin Laubach, and its on-screen text is science, not a sales pitch: technical, in the proper terms, and short | Matt | "We are not selling anything, we are doing science." Matt gave the line of the second scene himself: "SPHEREx images to understand object movement in the sky". Claude drafted the other lines to that direction, and each says what its shot shows. The text is listed in `docs/submission/video.md` |
| 2026-11-15 | The repo freezes at 11:30 pm Eastern on Nov 15, half an hour before the form closes | Matt | To be safe. No commit, merge, or push after that. Sharpens the 11:59 pm line below. Deploys still freeze at 11:00 pm, which was Austin's decision, so a change to the site must be merged before then |
| 2026-11-15 | Eight demo objects for the live presentation, kept quick on the live site from 3:05 pm to 5:00 pm | Matt | Matt named Haumea, the Pillars of Creation, and Jupiter with its moons, and asked Claude to fill the list to eight from objects already checked: WISE 0855, Barnard's Star, Epsilon Indi B, 3I/ATLAS, and the Orion Nebula. Typing "Pillars of Creation" did not work, so the search now takes a name that people use for a well-known object when the catalogs do not hold it. The links are in `docs/submission/video.md` |
| 2026-11-15 | The repo and the project do not change after 11:59 pm on Nov 15. The live site's data keeps updating | Matt | His reading of the rules. Deploys freeze at 11:00 pm, and the scheduled index refresh keeps adding new exposures after that |
| 2026-11-15 | Run the index refresh once by hand, and keep the site warm during the live presentation | Matt | The refresh passed on GitHub at 12:17 pm with the index unchanged. From 3:05 pm Claude opens the demo targets on the live site and keeps an instance running until the presentation is over |
| 2026-11-15 | The automated cut of the video gets a short shot of Haumea, with the square moving on the map and the image study tracking it | Matt | Matt watched the cut and asked for it, with a GIF he saved from the tool as the model. The shot uses his settings: a 10 arcminute field, detector 2, and 55 images over a year. The cut is now 29.0 s |
| 2026-11-15 | The demo is the video that Matt's Claude built from code. A seven-slide deck is the backup | Austin | The team first planned to record the video itself, then switched to slides, then kept the finished automated video. Plan in `docs/submission/video.md` |
| 2026-11-15 | Matt and Austin record the demo video themselves, on the live site with their own voices. Claude helps write and time the script. The automated cut is the fallback | Austin | Follows the Space Apps "Visual Storytelling" beats. A team recording with an SI-assisted script is disclosed in the description and the SI question |
| 2026-11-15 | The Local Event has a live presentation at 3:30 pm, 5 minutes at most | Austin | The plan is in `docs/submission/video.md`. Submit for Judging moves before it, to 2:45 pm |
| 2026-11-15 | Saved pictures and animations must be high quality | Matt | Matt saved a couple of GIFs and found them very low quality. They were shrunk to 560 pixels on the longest side of the whole window, margins included, and kept 64 shades of gray. Now a saved picture is the field itself, drawn again at 1600 pixels (PNG) or 1080 (GIF), with every shade of gray, and color pictures are dithered. See `docs/methods.md` section 14 |
| 2026-11-15 | The site must be fast: back to 4 processors on the second generation runtime | Matt | Matt asked if the new server size was faster or slower. Claude measured it: about 15 percent slower on first loads. The first generation runtime was slower with 2 processors and with 4, and used twice the processor time. The size is again 4 processors, 4 GB, 2 instances, second generation, at the cost it had before Nov 15. See `docs/deploy.md` "Size" |
| 2026-11-15 | Set the server to the best size that costs no more | Matt | Claude measured that 4 processors bought nothing on large fields, because Google caps each instance's network at 600 Mbps. Now 2 processors, 4 GB, at most 3 instances, on the first generation runtime. Each busy second costs 45 percent less, and the worst case is $15 a day, down from $18 |
| 2026-11-15 | The study box is capped at 50 arcminutes | Matt | Down from 60. It holds for a drag of the square, the Settings list, and the `fov` of a link |
| 2026-11-15 | A click on a green marker does not move or zoom the sky map, and the marker stays inside the study box, the same as a blue marker. The square still crosses the map along the body's path when the film is played | Matt | A study of a planet, asteroid, or comet that the map marks opens with its box on the marker, where the body is today. Before, the map went to the body's first image at once and the marker was left behind. Playing or stepping the film sends the square to where each image was taken, as it did before, and the map follows it. A body the map does not mark keeps the older way throughout |
| 2026-11-15 | A full speed pass, with no compromises on what the tool does | Matt | Loads of larger areas felt slow on the live site. Server: each image packed once and read on every processor. Browser: sums three times faster with the same output bit for bit, and large sums made in the background so the page never freezes. Claude measured each step before and after. See `docs/deploy.md` "Speed" and `docs/methods.md` section 6 |
| 2026-11-14 | A click on a planet, asteroid, or comet on the sky map loads its images at once, the same as a click on a star | Matt | Replaces the card-first rule for solar system bodies in the entry below. The map goes to where the body was in its first image. The Sun and the Moon keep the card, because SPHEREx has no images of them |
| 2026-11-14 | The yellow square stays in sight while images load | Matt | A square wider than the map had all four sides off screen. The map now zooms out just enough to show it when a larger area is chosen or a corner is dragged past the edge. A planet or comet chosen on the map also keeps its square during the few seconds its images are being found |
| 2026-11-14 | Run the live site on Google's second generation runtime with 4 processors and 4 GB, and at most 2 instances | Matt | Larger fields loaded slowly on the live site. Claude measured the instance as the limit and laid out the cost of each size. Two instances keep the worst-case cost at about $18 a day, the same as before. Session affinity is left off for now, because it sets a cookie. See `docs/deploy.md`, "Size" |
| 2026-11-14 | Finish the video and the submission by 4:20 pm Eastern on Sunday, our Local Event's cutoff. Deploys still freeze at 11:00 pm | Austin | The Local Event set the earlier cutoff. The live site keeps improving after the local submission, until the freeze |
| 2026-11-14 | The tutorial uses Barnard's Star alone, not all five test targets, and its text goes back to what it was | Matt | Replaces the five-target card on the tour's first step, which was live for about half an hour. The other four targets stay in the Find dropdown |
| 2026-11-14 | The deploy freeze moves to 11:00 pm Eastern on Nov 15, an hour before the submission deadline | Austin | To be safe. It leaves an hour to check the last deploy. Replaces the 11:59 pm freeze below |
| 2026-11-14 | Next builds, in this order: a visible start for judges, a higher image cap on bigger computers, and keeping the place in the film when the field size changes. The first is done by putting all of the example objects in the tutorial | Matt | Claude listed the options. Matt chose these three and said how the first is done |
| 2026-11-14 | From here on, work lands on a separate branch before `main`, to protect `main` | Matt | The branch is `dev`. `main` is the live site and changes only by a pull request from `dev`. See `docs/team/workflow.md` |
| 2026-11-14 | Deploys freeze at the submission deadline, Nov 15, 11:59 pm Eastern. The live site stays as submitted through judging | Austin | Built into `deploy.yml`. Commits pushed before the deadline still deploy when their CI passes |
| 2026-11-14 | Continuous deployment: a push to `main` deploys to Cloud Run on its own, but only after CI passes on that commit | Austin | GitHub Actions with Workload Identity Federation, so no key is stored. Claude rejected a Cloud Build trigger because it cannot wait for the GitHub CI result |
| 2026-11-14 | A click on an object's label loads its images at once, with the view box around it, the same as a click on empty sky | Matt | Chosen over keeping the card first. Planets, asteroids, and comets keep the card first, because their images are elsewhere on the sky |
| 2026-11-14 | The Sun and the Moon are drawn at their true size on the sky map | Matt reported that there was nothing to see at their labels | Discs half a degree wide, the Moon with its lit share. They are drawings over the map. SPHEREx never images either one |
| 2026-11-14 | App wording is technical and plain: bands and objects, not colors and things. No sales wording and no calls to action in the tour | Austin | Rules and notes in `docs/team/language-refining.md`. Austin approved each tour step's new wording |
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
