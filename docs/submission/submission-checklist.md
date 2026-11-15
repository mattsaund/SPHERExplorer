# Submission checklist

From the 2026 Project Submission Guide and the 2026 Judging and Awards Guide.
Deadline: our Local Event needs the video uploaded and "Submit for Judging" clicked by Sun Nov 15, 4:20 pm Eastern. Matt set 4:00 pm as the team's own deadline. The global form closes at 11:59 pm Eastern.

A ticked box below was checked by Claude on Nov 15 around noon, and the line says how. An open box needs Matt or Austin.

## Eligibility

- [ ] Matt and Austin are confirmed (not waitlisted) at the same Local Event and appear on the team's Members tab.
- [x] The project answers the "Planet X and SPHEREx" challenge. Every objective is met, and Measure Changes finds all five of the challenge's test targets on the live site (rechecked 11:28 am).
- [x] The project uses at least one NASA data source or resource (SPHEREx from IRSA). Every image the tool shows is SPHEREx data.

## Project page fields

The text for each field, and the claims to recheck before submitting, is in `docs/submission/submission-text.md`.

- [x] Project name. SPHERExplorer.
- [ ] High-level summary: what we built, how it addresses the challenge, why it matters. Text ready: 198 words, 1,182 characters, inside the limit of 200 and 1,500. Needs pasting again.
- [ ] Demo link (public, no login). The video built from code is the demo, and a seven-slide deck is the backup (`docs/submission/video.md`). See "Demo".
- [ ] Final project link (public, no login): the live site (https://spherexplorer.earth) and this repo. Both answer without a login, and the repo is public. Needs pasting.
- [ ] Project details: what it does, how it works, benefits, goals, tools, languages, hardware, software. Text ready, and its numbers were rechecked on the live site. Needs pasting again.
- [ ] NASA data and resources used. Draft ready, needs approval.
- [ ] Space Agency Partner and other data used. Draft ready, needs approval.
- [ ] References: every external resource, including open-source code, text, and images. Copy from `docs/references.md`. Draft ready, needs approval. A script compared it with `docs/references.md`: all 50 entries in use are in it, and all 27 packages the code depends on are in `docs/references.md`.
- [ ] SI question: how SI tools were used. Judges don't see this answer, but they do see SI labels inside the project. Draft ready, needs approval. Its statements about labels were checked by script.
- [ ] Images can be uploaded straight to the page (JPG, PNG, GIF up to 10 MB). Videos and documents must be links.

## Demo

- [ ] A video of 30 seconds or less, or at most 7 slides including the title and intro slides. Over the limit means no Global Judging. The video is 29.00 s by ffprobe, and its render refuses anything over 29.5 s. Check the length again on the host's player.
- [x] English, or English subtitles if the video is in another language. Slides must be in English. Every line of the video is English.
- [ ] Hosted on YouTube, Google Drive, GitHub, OneDrive, or Dropbox with a public link. Test it in a private window.
- [ ] Suggested video timing: 0:00 names and team (Turing Complete), 0:02 the challenge, 0:05 title and tagline, 0:10 how it works plus the NASA and partner data, 0:20 to 0:30 the future.
- [ ] Slides show the team name, member names, the challenge, an image of the project, the user experience, and how NASA and partner data make it possible.
- [x] SI-generated images or video carry a visible watermark. No NASA branding in SI-generated content. The video has the watermark on every frame, and its render stops if anything covers it. It shows no logo of any kind except Aladin Lite's own mark on its map.

## Final checks

- [ ] The live site loads from outside our network. It answers over the public internet with a valid certificate, `www` works, and `http` redirects to `https`. Still to do by hand: open it on a phone on mobile data.
- [ ] Request a FortiGuard Web Filter Classification for any new domain so judges' networks don't block it (optional): https://www.fortiguard.com/faq/wfratingsubmit
- [x] No images, video, or audio of anyone under 18. The project, the repo, and the video show no people at all, and the video is silent.
- [x] No NASA insignia or logos. No implied endorsement. The repo tracks no image file, the app ships no icon or logo, and its About tab says it is not a NASA product.
- [x] OSI license present (Apache-2.0). GitHub reads `LICENSE` as Apache-2.0.
- [ ] Tick both boxes: the Terms and Conditions, and "Confirm All Work is Original" (all external resources listed in References).
- [ ] Submit. Resubmitting is allowed until the deadline, and only the last saved version is judged.
- [ ] The site stays online through Jan 26, 2027.
- [ ] Download participant certificates from each Profile after submitting.
