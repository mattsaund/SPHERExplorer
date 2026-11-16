# Submission checklist

From the 2026 Project Submission Guide and the 2026 Judging and Awards Guide. Both were read again from the live Space Apps pages on Nov 15 at 2:45 pm Eastern. They are dated Nov 13, 2026.

A ticked box was checked by Claude on Nov 15, and the line says how and when. An open box is something only Matt or Austin can do or see. Claude cannot open the project form. It reads the public project page, last at 7:42 pm: https://www.spaceappschallenge.org/2026/find-a-team/turing-complete/?tab=project

## Where things stand

Sunday, Nov 15, 7:42 pm Eastern.

- The project is submitted and public. It was first submitted at 3:24 pm, before our Local Event's cutoff, and submitted again at 7:16 pm with the edits of the evening.
- The team gave its live presentation and placed first at the Local Event (Matt, Nov 15). Local awards are separate from Global Judging. The Local Event's judges choose the Global Nominees, and they are announced on Dec 3.
- The form stays open until 11:59 pm. Matt and Austin have edited the summary, the details, and the link lists in it. The page's last save and its last submission are both at 7:16 pm.

## Times

Sunday, Nov 15, Eastern time.

| Time | What |
|---|---|
| 3:24 pm | Done. Submit for Judging clicked (the public page's record) |
| 7:16 pm | Done. Submitted again with the evening's edits (the public page's record) |
| 3:30 pm | Done. Live presentation. Notes in `docs/submission/livepresentation.md` |
| 4:20 pm | Passed. Our Local Event's cutoff |
| 11:30 pm | Deploys and the repo freeze. A change to the site must be merged before this. No commit, merge, or push after this |
| 11:59 pm | The global form closes. The guide: "Any projects saved or submitted past this deadline will not be eligible for judging." |

## What is left, in order

Every step here is an open box further down. All of it is for Matt or Austin, in the form.

1. Trim the summary to 200 words. It has 205, and the form asks for 50 to 200.
2. Check that the SI answer is in the form. It does not show on the public page.
3. After any further edit, click Save Progress and then Submit for Judging again, and look for the banner. The page's last save and last submission are both at 7:16 pm, so nothing is waiting now.
4. Open the public project page in a private window. Read every field and click every link.
5. Upload pictures if you want them on the page. Four small ones are ready in `media/pictures/`.
6. Afterwards: open the site on a phone on mobile data, send the optional FortiGuard request, and download the certificates.
7. Don't save the form after 11:59 pm.

Claude's part: read the public page once more after your last edit and bring `docs/submission/submission-text.md` in line with it, then check the repo and the live site before the freeze at 11:30 pm.

## Eligibility

From "Eligibility for Global Judging" in the Judging and Awards Guide.

- [x] The project responds to one official challenge, "Planet X and SPHEREx". Every objective is met, and Measure Changes finds all five of the challenge's test targets on the live site (rechecked at 6:32 pm, after the last deploy).
- [x] Matt and Austin are on the team's page, Matthew Saunders and Austin Laubach, at the Local Event Bethesda, MD (public page, 6:32 pm). The guide: "All teammates, including the Team Owner, must be registered for the same Local Event." Members can't be added after submission closes.
- [ ] Each of you is on this team only, and the team works on this one challenge (Participant FAQ).
- [x] The project uses at least one NASA data source or resource (SPHEREx from IRSA). Every image in the film is SPHEREx data.
- [x] English on the project page and in every linked material. The page, the site, the repo, the video, and the slides are in English.
- NASA reviews every team under its China funding restriction, from what each participant gave at registration. There is nothing to send unless NASA asks.

## Project page fields

`docs/submission/submission-text.md` has the text of each field as it is on the public page, and the claims to recheck. A box here is ticked from the public page, read at 7:42 pm.

- [x] Project Name. SPHERExplorer.
- [ ] High-Level Project Summary. On the page, as Matt and Austin edited it in the form. It is 205 words and 1,251 characters. The form asks for 50 to 200 words and 1,500 characters at most, so it is five words over. Three small cuts bring it to 200: "Users can search" to "Users search", "Our tool, SPHERExplorer, makes" to "SPHERExplorer makes", and "changes over time" to "changes". The words are yours to choose.
- [x] Link to Project Demo. https://www.youtube.com/watch?v=EtcNxZPPJSA. YouTube answered for it with no login at 6:35 pm, and its player shows 29 seconds.
- [x] Link to Final Project. https://www.spherexplorer.earth. It serves the site and its API, the same as the address without `www` (6:35 pm). The repo link is the first line and the last line of the details.
- [x] Detailed Project Description. On the page, as Matt and Austin edited it in the form, about 640 words. Its results were rechecked on the live site at 6:32 pm and every number matched. One sentence has no verb: "GitHub Actions used for deploying after all tests pass."
- [ ] Use of Super Intelligence (SI). The written answer does not show on the public page, so check it in the form. The draft is in `submission-text.md` and says four commits carry no SI line. The page's record does show seven kinds of SI use ticked.
- [x] NASA Data. 14 links, the same rows in the same order as `docs/submission/submissionreferences.md`. Each address answered at 6:45 pm.
- [x] Space Agency Partner Data. 12 rows of data and services at the top of "Space Agency Partner & Other Data". Herschel and Planck share one row now, and the NEOSSat tutorial row came out at 6:28 pm. Each address answered at 6:45 pm.
- [x] Code, tools, and references. The form has no References field. Its second list asks for "any code, text, and images" used, and since 6:41 pm it has 13 rows for them: the libraries inside the tool, the SI tool, the hosting and build tools, the video tools, and a link to the complete list in `docs/references.md`. Each address answered at 6:45 pm. `submissionreferences.md` has the same rows, and each library one by one.
- [ ] Pictures, if wanted. It takes JPG, PNG, and GIF up to 10 MB. Four in `media/pictures/` are 0.5 to 0.6 MB each. The two large animations there are 26 and 32 MB, over that limit. Videos and documents must be links.

## Demo

- [x] A video of 30 seconds or less, or at most 7 slides including the title and intro slides. Over the limit means no Global Judging. The file is 29.00 s by ffprobe (6:35 pm), its render refuses anything over 29.5 s, and YouTube's player shows 29 seconds.
- [x] English, or English subtitles if the video is in another language. Every line of the video is English, and it has no sound.
- [x] Hosted on YouTube, Google Drive, GitHub, OneDrive, or Dropbox with a public link. On YouTube. It answered with no login at 6:35 pm.
- [x] The guide's suggested order for a video: names and team, the challenge, the title and tagline, how it works with NASA and partner data, the future. The video has them in that order: the team card (0 s), the challenge (2.25 s), the title (5.25 s), search, motion, the spectrum, and the comparison with WISE, 2MASS, Gaia, and NEOSSat (8.5 to 22 s), then what it covers and the twice-weekly refresh (22 s). The timing is a suggestion. The text is science, not a pitch, by Matt's decision.
- [x] The demo link is the video, so the guide's rules for slides do not apply. The two decks in `media/slides/` are not the demo. The backup deck would meet them: it has 7 slides, with the team name, the members' names, the challenge, an image of the project, the user experience, and the data (read at 2:50 pm). The deck for the live presentation has 6.
- [x] SI-generated images or video carry a visible watermark. No NASA branding in SI-generated content. The video has the watermark on every frame, and its render stops if anything covers it. Every slide of both decks has an SI note in its footer. None shows a logo, except Aladin Lite's own mark on its map.

## Compliance

- [x] No images, video, or audio of anyone under 18 in the project. The site, the repo, the video, and the slides show no people at all, and the video is silent.
- [ ] The team's page has a team photo and profile pictures now. Only Matt and Austin can confirm that everyone in them is 18 or older.
- [x] No NASA insignia or logos, and no implied endorsement. The app ships no icon or logo, and its About tab says it is not a NASA product. The pictures and animations in `media/pictures/` are the tool's own output and captures of it. The slides name NASA in text only, and the project details, the last slide of each deck, and the video's end card say the project is not endorsed by NASA.
- [x] OSI license present. GitHub reads `LICENSE` as Apache-2.0 (6:35 pm), and the repo is public.
- [x] Every source is cited. `docs/references.md` lists each dataset, library, service, paper, and font with its license.
- [x] SI work is labeled. Checked by script at 6:35 pm: every source file has the SI header, every pull request carries the SI line, and every commit on `main` carries the SI trailer except four, which `docs/si-usage.md` names. The instruction files for the SI sessions left the repo at 7:34 pm at Matt's request. The labels, the SI log, and the README's SI section are unchanged.
- [x] The live site answers over the public internet with a valid certificate. `www` works, and `http` redirects to `https` (6:35 pm).

## Submit

From "Submitting Your Project" in the Project Submission Guide.

- [ ] Switch the edit Lock on while editing, and save often. The guide warns that another member can remove the lock and overwrite unsaved changes.
- [x] Every required field is filled, in English. The form does not submit with one empty, and it submitted.
- [x] Both boxes ticked and Submit for Judging clicked. The public page's record says submitted, at 3:24 pm. The second box reads: "I confirm that the submitted project represents my team's original work and that all external resources including code, text and images (even if they are open source or freely available) used in the project are listed in the References field of the project submission form. In creating our solution, my team has not used any copyrighted materials (i.e., music, images, text, etc.) that we don't have permission to use."
- [x] Submitted again after the evening's edits. The guide: "You may edit and resubmit your project as many times as you'd like until the end of the hackathon. Only your last saved submission will be reviewed by the judges." The page's record shows the last save and the last submission at the same moment, 7:16 pm. After any further edit, submit again.
- [ ] Open the public project page in a private window. Read every field and click every link.
- [ ] No save after 11:59 pm. A save after the deadline costs eligibility.

## After submitting

- [ ] Open the live site on a phone on mobile data.
- [ ] Request a FortiGuard Web Filter Classification so judges' networks don't block the new domain (optional): https://www.fortiguard.com/faq/wfratingsubmit. The guide says to pick the category that fits best (education, reference, and web-based application are among its examples) and to write "N/A" for the company name.
- [ ] Download the participant certificates. Profile, then Participant Information, then "2026 NASA Space Apps Challenge", then Download Participant Certificate. The name comes from Full Name in the Profile, and the guide suggests a laptop and Letter paper size.
- [ ] The site stays online through Jan 26, 2027. Watch the Google Cloud credit and its budget alert. About Jan 14, GitHub pauses the scheduled index refresh after 60 days without a commit. Press Enable on the workflow's page, and don't commit (`docs/deploy.md`, "Until judging ends").
- [ ] The repo is frozen from 11:30 pm. Claude checks before that: `main` and `dev` are equal, no pull request is open, the checks pass, and the live site is healthy.
