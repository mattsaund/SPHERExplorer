# Submission checklist

From the 2026 Project Submission Guide and the 2026 Judging and Awards Guide. Both were read again from the live Space Apps pages on Nov 15 at 2:45 pm Eastern. They are dated Nov 13, 2026.

A ticked box was checked by Claude on Nov 15, and the line says how and when. An open box is something only Matt or Austin can do or see. Claude cannot open the project form. It read the project page from four screenshots that Matt took at 2:56 pm.

## Times

Sunday, Nov 15, Eastern time.

| Time | What |
|---|---|
| 3:00 to 5:00 pm | No merge to `main`. The site is kept warm for the presentation |
| 3:30 pm | Live presentation, 5 minutes at most. Notes in `docs/submission/livepresentation.md` |
| 4:00 pm | The team's own deadline for the form (Matt) |
| 4:20 pm | Our Local Event's cutoff: the demo video uploaded and Submit for Judging clicked |
| 11:00 pm | Deploys freeze. A change to the site must be merged before this |
| 11:30 pm | The repo freezes. No commit, merge, or push after this |
| 11:59 pm | The global form closes. The guide: "Any projects saved or submitted past this deadline will not be eligible for judging." |

## What is left, in order

Every step here is an open box further down. All of it is for Matt or Austin, in the form.

1. Team page, Members tab: both of you are listed, and both are confirmed at the same Local Event.
2. Project tab, Edit, and switch the Lock on. One person edits at a time.
3. In the form: paste the project details again (the page has the text of 1:12 pm), fill the References (none show on the page), and check that the SI answer is in and says "Four commits". Click Save Progress after each. The summary, both links, and both link lists are already on the page.
4. Upload pictures if you want them on the page. Four are ready in `media/pictures/`.
5. Tick the two boxes and click Submit for Judging. Look for the banner and the confirmation message.
6. Open the public project page in a private window. Read every field and click every link.
7. Give the live presentation at 3:30 pm.
8. Afterwards: open the site on a phone on mobile data, send the optional FortiGuard request, and download the certificates.
9. If anything changes later, save and submit again before 11:59 pm. Don't save after that.

Claude's part: keep the site warm until 5:00 pm, merge the last docs to `main` after 5:00 pm, and check the repo and the live site once more before the freeze at 11:30 pm.

## Eligibility

From "Eligibility for Global Judging" in the Judging and Awards Guide.

- [x] The project responds to one official challenge, "Planet X and SPHEREx". Every objective is met, and Measure Changes finds all five of the challenge's test targets on the live site (rechecked at 11:28 am and at 1:52 pm).
- [ ] Matt and Austin are registered, confirmed (not waitlisted) at the same Local Event, and listed on the team's Members tab. The guide: "All teammates, including the Team Owner, must be registered for the same Local Event." Members can't be added after submission closes.
- [ ] Each of you is on this team only, and the team works on this one challenge (Participant FAQ).
- [x] The project uses at least one NASA data source or resource (SPHEREx from IRSA). Every image in the film is SPHEREx data.
- [x] English on the project page and in every linked material. The text for the form, the site, the repo, the video, and the slides are in English.
- NASA reviews every team under its China funding restriction, from what each participant gave at registration. There is nothing to send unless NASA asks.

## Project page fields

The text for each field, and the claims to recheck before submitting, is in `docs/submission/submission-text.md`. Copy it from GitHub's view of that file so the formatting carries over. A box here is ticked once the field is in the form and saved.

- [x] Project Name. SPHERExplorer. On the page (screenshots, 2:56 pm).
- [x] High-Level Project Summary. On the page (screenshots, 2:56 pm), with two edits made in the form: "large files manually" and "SPHERExplorer needs no software or account". That is 199 words and 1,202 characters, inside the limit of 200 and 1,500. `submission-text.md` now has the same words.
- [x] Link to Project Demo. https://www.youtube.com/watch?v=EtcNxZPPJSA is on the page (screenshots, 2:56 pm). YouTube answered for it with no login at 2:46 pm, and its player shows 29 seconds.
- [x] Link to Final Project. The page has https://www.spherexplorer.earth (screenshots, 2:56 pm). The `www` address serves the same site and its API (2:58 pm). The repo link is the last line of the details.
- [ ] Detailed Project Description. On the page (screenshots, 2:56 pm), but it is the text of 1:12 pm. Three later changes are missing: the sentence "Sum any of the six detectors, subtract one visit from another, or view three bands as color.", the words "with flags and variance" and "that carries its coordinates", and "results checked" in place of "every result checked". Paste the details again from `submission-text.md`.
- [ ] Use of Super Intelligence (SI). Draft ready, needs approval. Changed at 2:50 pm: it now says four commits carry no SI line, not three. Judges don't see this answer, and it does not show on the page, so check it in the form.
- [x] NASA Data. All 14 links are on the page, in order (screenshots, 2:56 pm). A screenshot does not show their addresses, so click each one once.
- [x] Space Agency Partner Data. All 14 links are on the page, in order, under "Space Agency Partner & Other Data" (screenshots, 2:56 pm). A screenshot does not show their addresses, so click each one once.
- [ ] References: every external resource, including open-source code, text, and images. No References section shows on the page (screenshots, 2:56 pm). If the form has a References field, it is still empty, and the draft in `submission-text.md` goes there. If it has none, the libraries, tools, and papers go in as links under the field the guide names "Space Agency Partner Data and Other References". The second box you tick says every external resource is listed. A script compared the draft with `docs/references.md` around noon: all 50 entries in use are in it, and all 27 packages the code depends on are in `docs/references.md`.
- [ ] Pictures, if wanted. The page has none (screenshots, 2:56 pm). It takes JPG, PNG, and GIF up to 10 MB. The four in `media/pictures/` are 0.5 to 0.6 MB each. Videos and documents must be links.

## Demo

- [x] A video of 30 seconds or less, or at most 7 slides including the title and intro slides. Over the limit means no Global Judging. The file is 29.00 s by ffprobe (2:46 pm), its render refuses anything over 29.5 s, and YouTube's player shows 29 seconds.
- [x] English, or English subtitles if the video is in another language. Every line of the video is English, and it has no sound.
- [x] Hosted on YouTube, Google Drive, GitHub, OneDrive, or Dropbox with a public link. On YouTube. It opened in a private window at 2:28 pm and answered with no login at 2:46 pm.
- [x] The guide's suggested order for a video: names and team, the challenge, the title and tagline, how it works with NASA and partner data, the future. The video has them in that order: the team card (0 s), the challenge (2.25 s), the title (5.25 s), search, motion, the spectrum, and the comparison with WISE, 2MASS, Gaia, and NEOSSat (8.5 to 22 s), then what it covers and the twice-weekly refresh (22 s). The timing is a suggestion. The text is science, not a pitch, by Matt's decision.
- [x] Slides show the team name, the members' names, the challenge, an image of the project, the user experience, and how NASA and partner data make it possible. This applies only if the backup deck is submitted. It has 7 pages, and a contact sheet of them was read at 2:50 pm: all six items are there.
- [x] SI-generated images or video carry a visible watermark. No NASA branding in SI-generated content. The video has the watermark on every frame, and its render stops if anything covers it. Every slide has an SI note in its footer. Neither shows a logo, except Aladin Lite's own mark on its map.

## Compliance

- [x] No images, video, or audio of anyone under 18. The project, the repo, the video, and the slides show no people at all, and the video is silent.
- [x] No NASA insignia or logos, and no implied endorsement. The app ships no icon or logo, and its About tab says it is not a NASA product. The pictures in `media/pictures/` are captures of the tool. The slides name NASA in text only, and the last slide and the video's end card say the project is not endorsed by NASA.
- [x] OSI license present. GitHub reads `LICENSE` as Apache-2.0 (2:47 pm), and the repo is public.
- [x] Every source is cited. `docs/references.md` lists each dataset, library, service, paper, and font with its license.
- [x] SI work is labeled. Checked by script at 2:50 pm: every source file has the SI header, all 49 pull requests carry the SI line, and every commit on `main` carries the SI trailer except four, which `docs/si-usage.md` names.
- [x] The live site answers over the public internet with a valid certificate. `www` works, and `http` redirects to `https` (2:46 pm).

## Submit

From "Submitting Your Project" in the Project Submission Guide.

- [ ] Switch the edit Lock on while editing, and save often. The guide warns that another member can remove the lock and overwrite unsaved changes.
- [ ] Every required field is filled, in English. The form does not submit with one empty.
- [ ] Tick the first box: "I have read and understand the project submission requirements as contained in the NASA Space Apps Project Submission Guide, and I agree to the Participant Terms and Conditions and Privacy Policy."
- [ ] Tick the second box: "I confirm that the submitted project represents my team's original work and that all external resources including code, text and images (even if they are open source or freely available) used in the project are listed in the References field of the project submission form. In creating our solution, my team has not used any copyrighted materials (i.e., music, images, text, etc.) that we don't have permission to use."
- [ ] Click Submit for Judging. A banner and a confirmation message show that it worked.
- [ ] Open the public project page in a private window. Read every field and click every link. The page shows your changes to others only after you submit.
- [ ] After any later edit, save and submit again before 11:59 pm. Only the last saved submission is judged, and a save after the deadline costs eligibility.

## After submitting

- [ ] Open the live site on a phone on mobile data.
- [ ] Request a FortiGuard Web Filter Classification so judges' networks don't block the new domain (optional): https://www.fortiguard.com/faq/wfratingsubmit. The guide says to pick the category that fits best (education, reference, and web-based application are among its examples) and to write "N/A" for the company name.
- [ ] Download the participant certificates. Profile, then Participant Information, then "2026 NASA Space Apps Challenge", then Download Participant Certificate. The name comes from Full Name in the Profile, and the guide suggests a laptop and Letter paper size.
- [ ] The site stays online through Jan 26, 2027. Watch the Google Cloud credit and its budget alert. About Jan 14, GitHub pauses the scheduled index refresh after 60 days without a commit. Press Enable on the workflow's page, and don't commit (`docs/deploy.md`, "Until judging ends").
- [ ] The repo is frozen from 11:30 pm. Claude checks before that: `main` and `dev` are equal, no pull request is open, the checks pass, and the live site is healthy.
