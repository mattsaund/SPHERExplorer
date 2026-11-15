# Submission text

The text for each field of the Space Apps project page, kept here so it can be checked against the app before the final submission. Claude drafted it from the repository docs. Austin and Matt approve it, and the project page is the copy judges see.

Status, Nov 14: the summary and the project details are pasted into the form. The project link is chosen. The demo link, the two data fields, and the SI question are still to do. Our Local Event needs the project submitted by Sun Nov 15, 4:20 pm Eastern.

To paste the project details with their formatting, copy them from a rendered view of this file (GitHub's file view works), not from a terminal.

## Project name

SPHERExplorer

## Summary

50 to 200 words, 1,500 characters at most. Now 195 words and 1,154 characters. Plain text.

SPHERExplorer is a free public web tool that plays every SPHEREx image of any position in the sky in time order. NASA's SPHEREx telescope maps the entire sky in 102 infrared bands and images each position many times. Seeing what moved or changed usually means downloading and aligning many large files.

Users search by object name or coordinates. SPHERExplorer finds every exposure in milliseconds and steps through the visits, so moving objects shift across the frame. One button checks every source in the field and reports what moved, brightened, or faded. It finds all five of NASA's test targets on its own. Any point has a spectrum across all 102 bands, with features such as water and methane marked. Each field can be compared with Gaia, 2MASS, WISE, and NEOSSat data. Every view has a shareable link, exports to FITS, and can be embedded in other sites.

SPHEREx data is open to everyone but hard to use. SPHERExplorer opens it to students, educators, researchers, and citizen scientists. They can find nearby brown dwarfs, track asteroids and comets, and study how the sky changes. It needs no software or account, and its code is open source.

## Project demonstration

To do. The demo video, uploaded by 3:00 pm Sunday. See `docs/video.md`.

## Project link

https://spherexplorer.earth

The live site, not the repository. Judges can use the tool directly, and its About tab links the source code, the methods, and the SI statement. The repository link is the last line of the project details.

## Project details

No length limit is shown. Now about 870 words.

### What it does

SPHERExplorer is a free web tool for the SPHEREx all-sky infrared survey. Enter an object name or coordinates, and it finds every public SPHEREx image of that position and plays them in time order. Moving objects step across the frame. Each exposure of a position is taken in a different one of 102 infrared bands, so the same images also give a spectrum of any point.

- Search by name, by J2000 RA and Dec in any common form, or by planet, asteroid, or comet.
- Play every exposure, one sum per visit, one per wavelength, or the deepest sum of all.
- Blink against WISE, 2MASS, or the Digitized Sky Survey, taken years to decades earlier.
- Measure Changes checks every source in the field and reports what moved, brightened, or faded between visits.
- Read the spectrum of any point. Water, carbon dioxide, methane, and other features are marked, and the tool reports which actually stand out.
- See every known object in the field, including asteroids and comets, and a sky map with the SPHEREx all-sky survey in every channel.
- Compare with Gaia positions, 2MASS and WISE brightness, and NEOSSat images from the Canadian Space Agency.
- Save FITS files with sky coordinates, flags, and variance, plus data tables, pictures, and animations. Every view has a link and can be embedded in other sites.

### How it works

- A Python API reads SPHEREx Level 2 files straight from the public AWS bucket, a few kilobytes at a time. A 5 arcmin frame travels as about 8 KB instead of the 65 MB file.
- Search runs on our own index of all 273,000 exposures and answers in about 20 ms. A scheduled job adds new exposures twice a week, so new data releases need no code change.
- Star positions are carried to each image's date with proper motion and parallax. Asteroids and comets follow JPL Horizons paths, corrected for where the spacecraft was.
- Brightness comes from a fit of the point spread function in every frame. For Epsilon Indi B it matches 2MASS and WISE within about 10 percent.
- The browser does the rest with a WebGL2 viewer, sums, spectra, and plots.

### Results we checked

Measure Changes flags each of the five test targets and nothing else in their fields. Barnard's Star moved 10.9 arcsec north in a year (catalog 10.4). Epsilon Indi B moves 4.6 arcsec per year (catalog 4.7). WISE 0855 moved west between visits. RW Aurigae brightened 55 percent at 3.8 to 4.4 microns. R Draconis shows its 245-day pulsation. Each method and its known limits are documented in [docs/methods.md](https://github.com/mattsaund/SPHERExplorer/blob/main/docs/methods.md).

### Benefits

- No download, no software, and no account.
- Images of a target load in seconds, and a target opened before reloads at once.
- Researchers get science-grade files. Students and the public get plain words and a guided tour.
- The code is open source under Apache-2.0.

### Intended impact

SPHEREx data is public but hard to use. SPHERExplorer opens it to classrooms, citizen scientists, and researchers. They can search for nearby brown dwarfs and other moving objects, follow asteroids and comets, find variable stars, and learn what objects are made of. It picks up each new data release on its own, and other sites can embed it.

### Tools and technology

- API in Python 3.13 with FastAPI, NumPy, Astropy, and aiohttp. Web app in TypeScript with React 19, Vite, Zustand, and WebGL2. Sky map by Aladin Lite v3 (CDS).
- Data from SPHEREx (IRSA), Gaia (ESA), NEOSSat (CSA), 2MASS, WISE, SIMBAD, JPL, and IMCCE. The full list is in the data fields of this form and in the repository.
- One container on Google Cloud Run, deployed by GitHub Actions only after every test passes. The domain and the cloud credit come from the Space Apps Global Offers.
- No special hardware. We built it on our own computers.
- Built with Claude Code (Anthropic), a Super Intelligence (SI) tool. The team set the idea and the features. The code, tests, and documentation were written with Claude and are labeled in commits, file headers, and [docs/si-usage.md](https://github.com/mattsaund/SPHERExplorer/blob/main/docs/si-usage.md).

### How it is creative

- It uses the way SPHEREx works. Every exposure lands at a different wavelength, so the tool turns a series of images into a spectrum and compares change only at matching wavelengths.
- It measures stars too bright for the detector from the halo around them. Saturated targets such as Barnard's Star still get a rough spectrum and a brightness curve.
- It checks the whole field for change with one button, not only the target.
- Blink brings back the classic blink comparator, against surveys taken decades earlier.

### Factors we considered

- Scientific validity. Positions carried forward in time, matching wavelengths, flagged pixels left out, and every method checked against Astropy and published catalogs.
- Ease of use. A child or an older adult should be able to use it, so the wording is plain and a tour explains each part.
- Speed and cost. Small transfers, caching, and a server that scales to zero when idle.
- Rules and credit. No NASA branding, credit for every data source and library, all SI work labeled, and an open license.
- Durability. The site stays up through judging and picks up new data by itself.

Source code, methods, and every reference: [https://github.com/mattsaund/SPHERExplorer](https://github.com/mattsaund/SPHERExplorer)

## NASA data, Space Agency Partner and other data, and the SI question

To do. The data fields come from `docs/references.md`. The SI question must say that Claude drafted this text too.

## Claims to recheck before the final submission

Every factual line above, and where to check it. Recheck after the last change to the app.

| Claim | Where it appears | Check against |
|---|---|---|
| 102 infrared bands | Summary, details | `docs/research/spherex-data.md` |
| About 273,000 exposures indexed (273,367 on Nov 14) | Details | `/api/meta` on the live site, or the About tab |
| Search answers in milliseconds, about 20 ms | Summary, details | `docs/architecture.md` |
| A 5 arcmin frame is about 8 KB, the file 65 MB | Details | `README.md`, `docs/methods.md` section 2 |
| New exposures are added twice a week | Details | `.github/workflows/index.yml` |
| Measure Changes flags all five test targets, with the numbers given | Summary, details | `docs/methods.md` section 9 |
| Epsilon Indi B matches 2MASS and WISE within about 10 percent | Details | `docs/methods.md` section 4 |
| Blink partners are WISE, 2MASS, and the Digitized Sky Survey | Details | `docs/methods.md` section 13 |
| Water, carbon dioxide, and methane are marked, and the tool says which stand out | Summary, details | `docs/methods.md` section 10 |
| The tool names Measure Changes and Blink | Details | The app's Studies tab and image study |
| FITS files with coordinates, flags, and variance | Summary, details | `docs/methods.md` section 14 |
| The stack and the data sources | Details | `docs/architecture.md`, `docs/references.md` |
| Deploys run only after every test passes | Details | `.github/workflows/deploy.yml` |
| No account is needed | Details | `docs/deploy.md`, Security |
