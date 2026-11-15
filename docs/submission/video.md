# Demo video and live presentation

Status, Nov 15 at 12:30 pm: the demo is the video that Matt's Claude built from code in `media/code/`. A seven-slide deck that Claude drafted is the backup.

Two deliverables are due today, Sunday, Nov 15, Eastern time.

| What | When | Limit |
|---|---|---|
| Live presentation at our Local Event | 3:30 pm | 5 minutes at most |
| Demo link in the form, and Submit for Judging | before 4:20 pm | 30 seconds of video, or 7 slides |

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

- Every slide has an SI note in its footer, and speaker notes of about 30 seconds.
- The PDF is `media/slides/spherexplorer-slides.pdf`, and the notes are in `media/slides/speaker-notes.md`. GitHub shows the PDF in the browser, so its link works in the form without a login.

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

## Live presentation, 3:30 pm

Five minutes at most. Aim for 4 minutes 30 seconds, and leave the rest for the room. The content and the words are Matt and Austin's. Claude can draft talking points on request.

| Time | Part |
|---|---|
| 0:00 to 0:30 | Who we are, and the challenge. Playing the 30-second video works as the opener |
| 0:30 to 3:00 | Live demo on the site: search, playback by visit, the spectrum, Measure Changes, Blink, and the sky map |
| 3:00 to 3:45 | How it works, the data from NASA, ESA, and the Canadian Space Agency, and how the results were checked (`docs/methods.md`, section 9) |
| 3:45 to 4:30 | Who it helps, and what comes next |
| 4:30 to 5:00 | Thanks, and the address on screen |

Before going on:

- Check the projector early. Set the browser zoom so the back row can read it.
- Ten minutes before, open each of the five test targets once. Their images then usually sit in the server's memory, and the demo loads at once. The site can run two instances, and each has its own memory, so this isn't guaranteed.
- Matt's Claude also keeps the site warm from 3:05 pm to 5:00 pm, which Matt asked for on Nov 15. It opens the eight demo objects below on the live site, asks the site for its health every three minutes so the instance stays up, and opens the objects again if the instance was replaced.
- Don't merge to `main` between 3:00 and 5:00 pm. A merge deploys about four minutes later, and a new deploy starts with empty memory.
- If the venue network blocks the new domain, use https://spherexplorer-112779026983.us-east4.run.app instead.
- If the network fails, play the video file and show the backup slides from the laptop.
- Agree who says which part, and run it once with a timer.

### The eight demo objects

Matt chose these on Nov 15. Each link was opened on the live site that day. An object stays quick as long as it is opened at the field size of its link, or at the 5 arcminutes that a typed name opens with.

| Object | Link | What it shows |
|---|---|---|
| Haumea | https://spherexplorer.earth/?target=Haumea&fov=600&smooth=1&det=2 | A dwarf planet followed through a year. Press Play: the square moves on the map and the image study keeps it under its marker |
| Pillars of Creation | https://spherexplorer.earth/?target=M%2016&fov=900&mode=deep&color=wide | The Eagle Nebula, M 16, in three-band color. Typing "Pillars of Creation" in Find opens the same place |
| Jupiter and its moons | https://spherexplorer.earth/?target=Jupiter&fov=1200 | Jupiter with its four large moons as points beside it. Step through the film and they change places |
| WISE 0855 | https://spherexplorer.earth/?target=WISE%200855-0714&mode=visits&det=56 | The coldest known brown dwarf stepping west between visits. Measure Changes finds it |
| Barnard's Star | https://spherexplorer.earth/?target=Barnard%27s%20Star&blink=wise-w1 | Blink against WISE from 2010. The star jumps more than 2.5 arcminutes |
| Epsilon Indi B | https://spherexplorer.earth/?target=Epsilon%20Indi%20B&tool=graphs&feat=water,methane | The spectrum of a brown dwarf, with water and methane marked |
| 3I/ATLAS | https://spherexplorer.earth/?target=3I/ATLAS&mode=visits | An interstellar comet, followed as it moves |
| Orion Nebula | https://spherexplorer.earth/?target=M%2042&fov=1200&mode=deep&color=wide | A color image from three wavelength ranges |

The moons of Jupiter have no names in the tool. Find does not know them, so open Jupiter and point at them.

## Who does what

| Who | Work |
|---|---|
| Matt and Austin | Approve the video, upload it, choose the video or the slides, submit, and present |
| Matt's Claude | Build and render the video |
| Austin's Claude | The backup slides, this plan, and a check of the final file against the requirements |

## Schedule

Sunday, Nov 15, Eastern time.

| Time | Milestone |
|---|---|
| 1:30 pm | Final video approved |
| 2:00 pm | Uploaded with the description, tested in a private window |
| 2:15 pm | Decide: the video, or the backup slides |
| 2:45 pm | Demo link in the form, every field done, Submit for Judging |
| 3:10 pm | Presentation setup. No merges to `main` until 3:40 pm |
| 3:30 pm | Live presentation |
| 4:20 pm | Local Event cutoff. Resubmit only if something must change |
| 11:00 pm | Deploys freeze. A change to the site must be merged before this |
| 11:30 pm | The repo freezes. No commit, merge, or push after this |
| 11:59 pm | The global form closes |

## Final checks

- [x] 30 seconds or less on the file and on the host's player, or 7 slides or fewer. 29.00 s on the file, 29 seconds on YouTube.
- [ ] The guide's beats are there: names, the challenge, the title and tagline, how it works with NASA and partner data, and the future.
- [x] The SI watermark is visible on every frame, and the description says the video is SI-generated. The render checks the watermark, and the description on YouTube was read.
- [ ] Text reads clearly at phone size.
- [x] No NASA logos, flags, or mission patches, and no "according to NASA".
- [x] No music, and no one under 18. The video is silent and shows no people.
- [ ] The link works in a private window, and the form has the full `https://` URL. The link opened with no login. The form is still to do.
