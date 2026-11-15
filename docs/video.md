# Demo video

Status: draft scope, Nov 14. Matt and Austin approve the on-screen text and the open decisions before the final render.

The video is made by agents from code: real captures of the live site, laid out and animated by a script, rendered frame by frame. It should make people want to use SPHERExplorer by showing plainly what it is, the mission behind it, what it solves, and who it is for. Calm, exact, and professional. Not flashy.

## Hard requirements

From the project submission form, the Project Submission Guide, and `CLAUDE.md`.

- Our Local Event (Bethesda, MD) needs the video uploaded and the project submitted by 4:20 pm Eastern on Sunday, Nov 15.
- 30 seconds or less, or the project loses Global Judging. Target 28.5 s. The render script fails anything over 29.5 s.
- A public link that needs no password, permission, or registration. YouTube, Google Drive, GitHub, OneDrive, or Dropbox. Paste the full URL, starting with `https://`. Test it in a private window.
- English.
- "Images and videos: Must include a visible watermark indicating they are SI-generated." The watermark stays on every frame.
- SI-generated audio, if any, is acknowledged in the description text and in the file metadata.
- No NASA logos, insignia, logotype, flags, or mission identifiers such as mission patches. No phrase like "according to NASA". Nothing that implies NASA endorsement.
- No copyrighted music, images, text, or fonts without permission. Every one goes in `docs/references.md` and in the form's "Space Agency Partner & Other Data" field.
- No images, video, or audio of anyone under 18. This plan shows no people at all.
- Credit on screen for SPHEREx and IRSA, and for each partner dataset shown.
- `CLAUDE.md` design rules: no glow, bloom, or neon. One highly readable sans-serif.

## What the video says

Four messages, in this order.

1. The mission. SPHEREx images the whole sky in 102 infrared bands.
2. The problem. Objects that move are hidden across thousands of separate images.
3. The product. SPHERExplorer plays every image of any spot in time order, with spectra, change finding, and partner data.
4. The use. Classrooms, researchers, and anyone curious, and it keeps up with new data.

The video builds interest through clear writing and steady pacing, not effects. One idea per shot.

## Storyboard

28.5 s at 30 fps, 1920 by 1080. The beats follow the timing the Project Submission Guide suggests. All on-screen text is a draft for approval.

| Time (s) | Beat | Picture | On-screen text |
|---|---|---|---|
| 0.0 to 2.5 | Names and team | Plain title card on the app background | "Turing Complete" / "Matt and Austin" / "NASA Space Apps Challenge 2026" |
| 2.5 to 5.5 | The challenge | The app's sky map with the SPHEREx color layer, drifting slowly | "Planet X and SPHEREx" / "Find what moves in SPHEREx's all-sky infrared images." |
| 5.5 to 9.5 | Title and tagline | Name set in type, over a still of the whole app | "SPHERExplorer" / "Explore SPHEREx images of the sky and how they change over time." (the README line) |
| 9.5 to 12.25 | How it works 1 | The search box takes "WISE 0855". The map centers and the yellow square appears | "Search any object or coordinates." |
| 12.25 to 15.0 | How it works 2 | The image study steps through visits. The brown dwarf moves between frames | "Play every visit. Moving objects step across the frame." |
| 15.0 to 17.75 | How it works 3 | The spectrum of Epsilon Indi B with water and methane marked | "102 infrared bands. A spectrum for any point." |
| 17.75 to 20.5 | How it works 4 | Blink against WISE, or the partner overlays | "Checked against Gaia, 2MASS, WISE, and NEOSSat." |
| 20.5 to 25.5 | Uses and the future | A 2 by 2 grid of real fields: WISE 0855, Barnard's Star, 3I/ATLAS, M 42 in color | "For classrooms, researchers, and anyone curious." for 2.5 s, then "Built to update with every new SPHEREx data release." for 2.5 s |
| 25.5 to 28.5 | End card | The address, large | "spherexplorer.earth" / "Open source, Apache-2.0" / short credits / "Independent project. Not endorsed by NASA." |

On every frame, lower left: "SI-generated video. Made with Claude Code (Anthropic)."

During data shots, lower right, short credits.

- SPHEREx shots: "SPHEREx data: NASA, JPL-Caltech, IPAC IRSA"
- Partner shot: "Gaia: ESA, DPAC. NEOSSat: CSA. 2MASS and WISE: NASA, IPAC"

The full acknowledgment texts from `docs/references.md` go in the video description. The NEOSSat line there is required: "Contains information licensed under the Open Government Licence - Canada."

## Style

- Type: Inter (SIL Open Font License 1.1), bundled with the video so it renders the same everywhere. Title 120 px, headings 64 px, captions 48 px, credits and watermark 24 px or larger.
- Colors: the app's own tokens. Background `#0f1215`, text `#e8ebee`, muted `#a3acb5`, accent `#4c9be8`. Callouts use the target marker yellow `#ffd24a`.
- Captions: one at a time, 10 words or fewer, on screen for at least 2.5 s. In: fade with a 12 px rise over 300 ms. Out: fade over 200 ms.
- Callouts: a 2 px yellow outline around the part of the page being described. It fades in over 200 ms. No shadow and no glow.
- Cuts, or crossfades of 300 ms. A slow push-in of at most 4 percent over one shot. Pans only to follow real action in the app.
- Only real captures of the app and real SPHEREx data. No generated pictures of space.
- Never: particles, fake starfields, lens flares, light leaks, glitch effects, whip pans, zoom blur, 3D flips, bouncing type, whooshes, or risers.

## Pipeline

Everything lives in a new `video/` folder with its own `package.json`, apart from the web app.

1. Capture, `video/capture.mjs`. Playwright drives https://spherexplorer.earth at 1920 by 1080. It waits until the status line has finished loading images, then saves stills. For playback it steps the image player and saves one screenshot per step, so the motion is frame-exact.
2. Compose, `video/scenes.html`. One page with a pure function `render(t)` that lays out every scene for time `t` in seconds, from the captures.
3. Render, `video/render.mjs`. Playwright opens the scenes page. For each frame it sets `t = frame / 30`, waits for fonts and images, and saves `frames/0000.png` onward.
4. Encode with ffmpeg: H.264, `yuv420p`, CRF 18, 30 fps, `+faststart`. The file's title and comment metadata carry the SI statement. An audio track, if any, is AAC at 160 kbps.
5. Verify. Duration is at most 29.5 s and the frame count matches. The watermark is visible on the first, middle, and last frames. Scene text passes `scripts/check_text.py`, which already reads every tracked file.
6. Publish. Upload, add the description with the SI statement and the credits, test the link in a private window, then paste the full URL into the form.

Austin's Mac has no ffmpeg, Chrome, or Playwright. Render on Matt's machine, or add a manual GitHub Actions workflow that installs both and saves the MP4 as a run artifact.

New dependencies, all in `video/` and none in the site:

| Name | License | Weight |
|---|---|---|
| Playwright | Apache-2.0 | The npm package plus a Chromium download of about 150 MB |
| ffmpeg | LGPL or GPL, a system tool, not shipped | One install on the rendering machine |
| Inter | SIL Open Font License 1.1 | One font file of a few hundred KB |
| Music, only if chosen | CC0, or CC-BY with credit | One audio file |

Rejected alternatives:

- Remotion. A strong React video framework, but its license is not OSI approved and it brings a large toolchain for 28 seconds of simple scenes.
- Generative video models. They cannot show the real product, they can invent imagery that looks like real data, and they can produce NASA-like marks.
- Real-time screen recording. Uneven frame timing, it needs the operating system's screen recording permission, and it cannot be repeated exactly.

## Who does what

| Who | Work |
|---|---|
| Matt and Austin | Approve the on-screen text and the open decisions. Watch every cut. Upload, paste the link, and test it |
| Matt's Claude (Fable 5.2) | Build `video/`: capture, scenes, render, encode. Make each cut |
| Austin's Claude | Keep this spec current. Check every render against the requirements. Add the references, the SI log rows, and the video description |

## Open decisions

1. Names on the team card: first names, or full names.
2. Tagline: the README line as drafted, or another.
3. The future line: "Built to update with every new SPHEREx data release.", or another plan from `docs/concept.md`.
4. Audio: none, a CC0 instrumental, a voiceover read by Matt or Austin, or SI-generated audio, which must be disclosed in the description and the metadata.
5. The motion shot: WISE 0855, one of NASA's test targets, or a fast asteroid or comet whose motion reads at a glance. Decide from the first captures.
6. Host: YouTube, public or unlisted, is recommended. Decide whose account.
7. Ownership of the new `video/` folder. Proposed: Matt's side, since Matt's Claude builds it.

## Schedule

Sunday, Nov 15, Eastern time.

| Time | Milestone |
|---|---|
| Saturday night | Scope and decisions 1 to 4 approved |
| 9:00 am | The pipeline runs end to end with placeholder text |
| 11:30 am | Cut 1 with real captures and the approved text |
| 1:30 pm | Recapture from the live site, cut 2 |
| 2:30 pm | Final sign-off |
| 3:00 pm | Upload, private-window test |
| 3:30 pm | Full URL in the form, every field done, Submit for Judging |
| 4:20 pm | Our Local Event's cutoff for the video and the submission |
| 11:00 pm | Deploys freeze. The live site keeps improving until then |
| 11:59 pm | The global form closes. Don't resubmit after 4:20 pm unless the Local Lead allows it |

## Final checks

- [ ] 29.5 s or less, measured on the file and on the host's player.
- [ ] The SI watermark is visible on every frame.
- [ ] No NASA logos, flags, or mission patches, and no "according to NASA".
- [ ] On-screen credit for SPHEREx, IRSA, and each partner dataset shown. Full acknowledgments in the description.
- [ ] Every font, track, and tool is in `docs/references.md` and in the form.
- [ ] The SI statement is in the description and in the file metadata.
- [ ] Every line is English and readable on a phone.
- [ ] The link works in a private window, and the form has the full `https://` URL.
