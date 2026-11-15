# Demo video and backup slides

Status, Nov 15 at 2:50 pm: the demo is the video that Matt's Claude built from code in `media/code/`. It is public on YouTube. A seven-slide deck that Claude drafted is the backup.

The demo link goes in the form, and Submit for Judging is clicked, before our Local Event's cutoff on Sunday, Nov 15, at 4:20 pm Eastern. The limit is 30 seconds of video, or 7 slides.

The 5-minute live presentation at 3:30 pm has its own file, `docs/submission/livepresentation.md`, with the notes, the talking points, and the eight demo objects. The day's times and what is left to do are in `docs/submission/submission-checklist.md`.

## What Space Apps asks for

From the Project Submission Guide, "Visual Storytelling":

> Your goal should be to quickly communicate the importance and relevance of your project to someone who has no context, technical background, or previous knowledge of your subject. Regardless of your demo's format, be sure to use strong visuals and ensure readability.

> The video pitch must be 30 seconds or less.
> - [0:00] Introduce yourself: What is your name and your team's name?
> - [0:02] Lead us in: What challenge does your project address? What inspired you to choose this challenge?
> - [0:05] Name your project: Share your project's title and tagline to catch your audience's attention.
> - [0:10] Describe your idea: How does it work? Display images or a prototype, describe a user's experience, and share how using NASA's free and open data and Space Agency Partner data made your proposed solution possible.
> - [0:20-0:30] Look into the future: Paint a picture! Captivate your audience with what it could be; What can your proposed solution do for people, the world, and beyond?

The audience has no background, so the pitch uses everyday words. The technical-word rule in `docs/team/language-refining.md` is for the app and the docs, not for this pitch.

For slides, the guide asks for at most seven slides, including the title and intro. They must show the team name, the members' names, and the challenge, an image of the project, the user experience, and how NASA and partner data make it possible, with a readable font and few words.

## Hard requirements

- 30 seconds or less, or 7 slides or fewer. Over the limit, the project loses Global Judging.
- A public link with no password, permission, or registration. YouTube, Google Drive, GitHub, OneDrive, or Dropbox. The full `https://` URL goes in the form. Test it in a private window.
- English.
- No NASA logos, flags, or mission patches anywhere in the frame, and nothing that suggests NASA endorsement.
- No copyrighted music. The video is silent.
- Nobody under 18 seen or heard.
- SI disclosure. The video is SI-generated, so it carries a visible SI watermark on every frame, and its description says so. The slides carry an SI note in their footer.

## The video

- `media/code/` builds it from the live site. `node capture.mjs` takes the captures, and `node render.mjs` lays out and renders every frame.
- 29.0 seconds, 1920 by 1080, silent, with the SI watermark on every frame. The render refuses anything over 29.5 seconds.
- Ten scenes. Matt watched the cut on Nov 15 and asked for one more shot, which is in: Haumea through a year of images, with the yellow square moving on the map and the image study keeping it under its marker.
- The finished file is `media/videos/spherexplorer-demo.mp4`, and it is kept in the repo. The captures and frames it is made from are not.
- The file's title, comment, and description metadata carry the SI statement.
- If the site changes before the upload, capture and render again.

The on-screen text follows Matt's direction of Nov 15: science, not a sales pitch. It is technical, in the proper terms, and short, and each line says what its shot shows. The line of the second scene is his own words. The names are in full, as he asked.

| Seconds | Shot | On-screen text |
|---|---|---|
| 0 to 2.25 | Team card | Turing Complete. Matthew Saunders and Austin Laubach. NASA Space Apps Challenge 2026 |
| 2.25 to 5.25 | The sky map in SPHEREx color | Planet X and SPHEREx. "SPHEREx images to understand object movement in the sky" |
| 5.25 to 8.5 | The whole app | SPHERExplorer. "Time-domain viewer for SPHEREx Level 2 spectral images" |
| 8.5 to 11.25 | A name typed into Find | "Query by name, or by RA and Dec (J2000)" |
| 11.25 to 14 | WISE 0855 by visit | "Proper motion of WISE 0855, a brown dwarf 2.3 parsecs away" |
| 14 to 16.5 | Haumea through a year | "Dwarf planet Haumea, tracked on its JPL Horizons ephemeris" |
| 16.5 to 19.25 | The spectrum of Epsilon Indi B | "Water and methane absorption in Epsilon Indi B, 0.75 to 5 µm" |
| 19.25 to 22 | Blink on Barnard's Star | "Compared with WISE (2010), 2MASS, Gaia DR3, and NEOSSat" |
| 22 to 26.5 | Four fields in a grid | "Brown dwarfs, high proper motion stars, comets, and nebulae", then "New SPHEREx exposures are indexed twice a week" |
| 26.5 to 29 | End card | spherexplorer.earth. Open source, Apache-2.0. Credits. "Independent project. Not endorsed by NASA." |

## The backup: a slide deck

Seven slides, drafted with Claude as a slide artifact, with real screenshots of the live site taken on Nov 15. The deck goes in `media/slides/`.

| Slide | Content |
|---|---|
| 1 | Title, tagline, Team Turing Complete, the members' names, the challenge, the address |
| 2 | The challenge: what SPHEREx is and what was hard, beside the color sky map |
| 3 | The project: a large screenshot of a study of WISE 0855 |
| 4 | The user experience: search, spot change, read the spectrum |
| 5 | The data: NASA SPHEREx, ESA Gaia, CSA NEOSSat, WISE and 2MASS, JPL Horizons |
| 6 | Proof: the five test targets against their catalog values |
| 7 | What comes next, the address, open source, and the disclaimer |

- Every slide has an SI note in its footer.
- The PDF is `media/slides/spherexplorer-slides.pdf`. GitHub shows the PDF in the browser, so its link works in the form without a login.
- The deck for the live presentation is a different file, `media/slides/spherexplorer-live-presentation.pdf`. It is not the demo.

## Upload

Done. Matt uploaded the video on Nov 15 at 2:27 pm Eastern: https://www.youtube.com/watch?v=EtcNxZPPJSA. It is public, YouTube's player shows 29 seconds, and it has the title and the description below. Only step 5 is left.

1. Upload the video to YouTube as Public or Unlisted. Both open without a login. Not made for kids.
2. Title: "SPHERExplorer, NASA Space Apps 2026, Planet X and SPHEREx".
3. Paste the description below.
4. Open the link in a private window, and check the length the player shows.
5. Paste the full `https://` link into Project Demonstration, then Save Progress.

The description carries the SI statement and the full acknowledgments, which the frames have no room for. The quoted lines are each archive's own required text from `docs/references.md`.

```text
SPHERExplorer: explore SPHEREx images of the sky and how they change over time.
Try it: https://spherexplorer.earth
Code, Apache-2.0: https://github.com/mattsaund/SPHERExplorer

Team Turing Complete (Matthew Saunders and Austin Laubach). NASA Space Apps Challenge 2026, challenge "Planet X and SPHEREx".

This video is SI-generated. It was built from code with Claude Code (Anthropic), from real captures of the SPHERExplorer web tool. Every picture of the sky in it is real data, shown the way the tool shows it. The video has no sound.

This is an independent team project. It is not an official NASA product and is not endorsed by NASA.

Acknowledgments

This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration.

This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.

This publication makes use of data products from the Wide-field Infrared Survey Explorer, which is a joint project of the University of California, Los Angeles, and the Jet Propulsion Laboratory/California Institute of Technology, funded by the National Aeronautics and Space Administration.

This publication makes use of data products from the Two Micron All Sky Survey, which is a joint project of the University of Massachusetts and the Infrared Processing and Analysis Center/California Institute of Technology, funded by the National Aeronautics and Space Administration and the National Science Foundation.

This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.

NEOSSat, Canadian Space Agency: Contains information licensed under the Open Government Licence - Canada.

This research has made use of the SIMBAD database, CDS, Strasbourg Astronomical Observatory, France.

This research has made use of the VizieR catalogue access tool, CDS, Strasbourg Astronomical Observatory, France.

The sky map is drawn with Aladin Lite (CDS, Strasbourg Astronomical Observatory). Typeface: Inter by Rasmus Andersson, SIL Open Font License 1.1. Every source and license is listed in docs/references.md in the repository.
```

## Who does what

| Who | Work |
|---|---|
| Matt and Austin | Approve the video, upload it, choose the video or the slides, submit, and present |
| Matt's Claude | Build and render the video |
| Austin's Claude | The backup slides, this plan, and a check of the final file against the requirements |

## Final checks

- [x] 30 seconds or less on the file and on the host's player, or 7 slides or fewer. 29.00 s on the file, 29 seconds on YouTube.
- [ ] The guide's beats are there: names, the challenge, the title and tagline, how it works with NASA and partner data, and the future.
- [x] The SI watermark is visible on every frame, and the description says the video is SI-generated. The render checks the watermark, and the description on YouTube was read.
- [ ] Text reads clearly at phone size.
- [x] No NASA logos, flags, or mission patches, and no "according to NASA".
- [x] No music, and no one under 18. The video is silent and shows no people.
- [ ] The link works in a private window, and the form has the full `https://` URL. The link opened with no login. The form is still to do.
