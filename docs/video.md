# Demo video and live presentation

Status, Nov 15 at noon: Matt and Austin record the 30-second video themselves. Claude helps write and time the script. The automated cut that Matt's Claude built from code stays ready as the fallback.

Two deliverables are due today, Sunday, Nov 15, Eastern time.

| What | When | Limit |
|---|---|---|
| Live presentation at our Local Event | 3:30 pm | 5 minutes at most |
| Video link in the form, and Submit for Judging | before 4:20 pm | 30 seconds at most |

## What Space Apps asks for

From the Project Submission Guide, "Visual Storytelling":

> Your goal should be to quickly communicate the importance and relevance of your project to someone who has no context, technical background, or previous knowledge of your subject. Regardless of your demo's format, be sure to use strong visuals and ensure readability.

> The video pitch must be 30 seconds or less.
> - [0:00] Introduce yourself: What is your name and your team's name?
> - [0:02] Lead us in: What challenge does your project address? What inspired you to choose this challenge?
> - [0:05] Name your project: Share your project's title and tagline to catch your audience's attention.
> - [0:10] Describe your idea: How does it work? Display images or a prototype, describe a user's experience, and share how using NASA's free and open data and Space Agency Partner data made your proposed solution possible.
> - [0:20-0:30] Look into the future: Paint a picture! Captivate your audience with what it could be; What can your proposed solution do for people, the world, and beyond?

The audience has no background, so the pitch uses everyday words. The technical-word rule in `docs/language-refining.md` is for the app and the docs, not for this pitch.

## Hard requirements

- 30 seconds or less, or the project loses Global Judging. Aim for 27 to 28 seconds.
- A public link with no password, permission, or registration. YouTube, Google Drive, GitHub, OneDrive, or Dropbox. The full `https://` URL goes in the form. Test it in a private window.
- English. Captions help readability.
- No NASA logos, flags, or mission patches anywhere in the frame. That includes other browser tabs, bookmarks, and the desktop.
- No copyrighted music. The plan has none.
- Nobody under 18 seen or heard.
- SI disclosure. A screen recording of the app with our own voices is not SI-generated video, so it needs no watermark. Claude's help with the script goes in the video description and in the form's SI question. Any frame that SI did make, such as the fallback cut, keeps its watermark.

## Script

A draft of about 85 words. A natural pitch runs 2.5 to 3 words a second, so 30 seconds holds 75 to 85 words. The words in brackets are for Matt and Austin to fill in, because the reason for choosing the challenge is theirs. Keep it to three or four words.

The guide's times are approximate. The first two beats are the most crowded, so let them run to about 0:06. The title beat has room to absorb it. Read the script aloud with a stopwatch. If a take runs over 28 seconds, cut words rather than talk faster. "like this brown dwarf" is the first cut.

| Time | Beat | Words | On screen |
|---|---|---|---|
| 0:00 to 0:02 | Who we are | "We're Matt and Austin, team Turing Complete." | Shot 1 |
| 0:02 to 0:05 | The challenge and why | "We chose Planet X and SPHEREx because [your reason, three or four words]." | Shot 1 |
| 0:05 to 0:10 | Name and tagline | "This is SPHERExplorer. Explore the sky, and how it changes over time." | Shot 2 |
| 0:10 to 0:20 | How it works, and the data | "Search any object, like this brown dwarf, and watch it move. One click finds what changed. It's built on NASA's open SPHEREx data, with ESA's Gaia and Canada's NEOSSat." | Shots 3 and 4 |
| 0:20 to 0:30 | The future | "Next, any classroom or scientist can hunt for hidden worlds, map our solar system, and watch the universe change. Try it at spherexplorer dot earth." | Shot 5 |

The tagline is the README's first line, shortened. The future line comes from `docs/concept.md`: research of every kind, a fully mapped solar system, and a map that keeps updating. Change any word that doesn't sound like you.

## Shots

Every shot is the live site. Open each link in its own tab before recording and let the images finish loading, so nothing is loading mid-take.

| Shot | Link | What to do |
|---|---|---|
| 1 | https://spherexplorer.earth/?view=map&layer=spherex-color | The SPHEREx all-sky map in color. A slow drag, or hold still |
| 2 | https://spherexplorer.earth/?target=WISE%200855-0714&mode=visits&det=56 | The whole app, with its name in the top bar |
| 3 | https://spherexplorer.earth/?target=WISE%200855-0714&mode=visits&det=56&follow=0&zoom=3&smooth=1&play=1 | The brown dwarf steps west while the stars hold still. Matt's draft found this the clearest motion shot |
| 4 | https://spherexplorer.earth/?target=Barnard%27s%20Star&blink=wise-w1 | Blink against WISE from 2010. The star jumps more than 2.5 arcminutes. Or click Measure Changes in the Studies tab, to match "one click finds what changed" |
| 5 | https://spherexplorer.earth/?view=map | The sky map with the solar system on it. End with the address bar visible |

## Recording

QuickTime Player is on Austin's Mac, so nothing needs installing.

1. Set up the screen. One browser window, maximized, with the bookmarks bar hidden. Browser zoom at about 125 percent so text reads on a phone. Do Not Disturb on.
2. Record. Press Cmd+Shift+5, choose Record Selected Portion around the browser window, and set Options to the microphone. A headset in a quiet room sounds best. One narrator, or take turns by beat.
3. Record a few full takes. If one take won't fit, record by beat and join the clips with Edit, then Add Clip to End.
4. Trim the dead air with Edit, then Trim. Check the length in Window, then Show Movie Inspector. It must read 30 seconds or less.
5. Export with File, Export As, 1080p.

## Upload

1. Upload to YouTube as Public or Unlisted. Both open without a login. Not made for kids.
2. Title: "SPHERExplorer, NASA Space Apps 2026, Planet X and SPHEREx".
3. Paste the description below.
4. Add captions. Claude can turn the final script and the take's timings into a caption file to upload.
5. Open the link in a private window. Check the length the player shows.
6. Paste the full `https://` link into Project Demonstration and Save Progress.

Description:

```text
SPHERExplorer: explore SPHEREx images of the sky and how they change over time.
Try it: https://spherexplorer.earth
Code, Apache-2.0: https://github.com/mattsaund/SPHERExplorer

Team Turing Complete (Matt and Austin). NASA Space Apps Challenge 2026, challenge "Planet X and SPHEREx".

Recorded by the team on the live site. The script was written with help from Claude Code (Anthropic), a Super Intelligence (SI) tool.

This is an independent team project. It is not an official NASA product and is not endorsed by NASA.

Data: NASA SPHEREx through the NASA/IPAC Infrared Science Archive (IRSA). ESA Gaia. NEOSSat, Canadian Space Agency, which contains information licensed under the Open Government Licence - Canada. 2MASS and WISE. SIMBAD and VizieR (CDS). Every source, acknowledgment, and license is in docs/references.md in the repository.
```

## Fallback: the automated cut

If the recording isn't uploaded by 2:15 pm, upload the cut that Matt's Claude built from code instead. It is in `video/`, made with `node capture.mjs` and then `node render.mjs` on Matt's machine. It is 29.0 seconds, silent, and carries the SI watermark on every frame. Matt watched it on Nov 15 and asked for one more shot, which is in: Haumea through a year of images, with the square moving on the map and the image study tracking it. That cut is SI-generated, so it uses the longer description in the git history of this file (commit 9c1438d), which says so.

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
- Matt's Claude also keeps the site warm from 3:05 pm, which Matt approved on Nov 15. It opens the demo targets on the live site, asks the site for its health every few minutes so the instance stays up, and opens the targets again if the instance was replaced.
- Don't merge to `main` between 3:10 and 3:40 pm. A merge deploys about four minutes later, and a new deploy starts with empty memory.
- If the venue network blocks the new domain, use https://spherexplorer-112779026983.us-east4.run.app instead.
- If the network fails, play the video file and show screenshots from the laptop.
- Agree who says which part, and run it once with a timer.

## Who does what

| Who | Work |
|---|---|
| Matt and Austin | Fill in the bracketed line, approve the script, record, upload, and present |
| Austin's Claude | Edit and time the script, write the captions, keep this plan current, and check the final file against the requirements. Talking points for the presentation on request |
| Matt's Claude | Keep the automated cut ready as the fallback |

## Schedule

Sunday, Nov 15, Eastern time.

| Time | Milestone |
|---|---|
| 12:15 pm | Script approved, with the bracketed line filled in |
| 12:30 pm | Browser set up, the five links loaded, notifications off |
| 1:00 pm | Takes recorded |
| 1:30 pm | Trimmed and exported, 30 seconds or less |
| 2:00 pm | Uploaded with the description and captions, tested in a private window |
| 2:15 pm | Decide: the recording, or the fallback cut |
| 2:45 pm | Link in the form, every field done, Submit for Judging |
| 3:10 pm | Presentation setup. No merges to `main` until 3:40 pm |
| 3:30 pm | Live presentation |
| 4:20 pm | Local Event cutoff. Resubmit only if something must change |
| 11:00 pm | Deploys freeze |
| 11:59 pm | The global form closes |

## Final checks

- [ ] 30 seconds or less on the file and on the host's player.
- [ ] Every beat is there: names, challenge, title and tagline, how it works with NASA and partner data, the future.
- [ ] Text on screen reads clearly at phone size.
- [ ] No NASA logos, flags, or mission patches in the frame, and no "according to NASA".
- [ ] No music, and no one under 18.
- [ ] The description names Claude's help with the script, and the SI question in the form says so too.
- [ ] The link works in a private window, and the form has the full `https://` URL.
