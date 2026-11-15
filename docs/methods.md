# Methods

How SPHERExplorer turns the public SPHEREx archive into pictures, spectra, and measurements. Each step names the code that does it and how it was checked.

## 1. Finding the images of a place

- SPHEREx has taken about 273,000 exposures, each on six detectors. `server/spherex_api/index_build.py` lists the public S3 bucket and reads one FITS header per exposure. It stores the time and the pointing as a 3x3 frame matrix.
- The six detectors sit at fixed angles from each other. Those angles, the pixel scale matrix, and the lens distortion (SIP) polynomial of each detector are measured once from 200 exposures and stored with the index.
- A search projects the target onto all six detectors of every exposure. It is a few matrix products and takes about 20 ms on a development machine and about 0.1 s on the live site. See `exposures.py`.
- Checked: the predicted pixel agrees with the file's own header to a median of 0.4 pixels. Image counts match the IRSA search for the five NASA test targets.
- IRSA's SIA service is the fallback when no index is loaded.

## 2. Reading pixels

- Level 2 files are 65 to 72 MB. `layout.py` maps a file with one or two small Range reads, then remembers the layout. After the first file of a release and detector, the layout of the next is predicted and checked against that file's own table of rows.
- `cutout.py` reads only the rows it needs from IMAGE, FLAGS, and VARIANCE, and crops them. FLAGS is RICE-compressed with one tile per row, so single rows can be decompressed.
- For a 5 arcminute field the server reads about 1 MB of each file, because S3 serves whole rows. The frame goes to the browser as about 8 KB: the image rounded to 16-bit floats, which keeps one part in two thousand and is far finer than the noise, and the flags. Both are then packed without further loss (`cutout.pack`). The server keeps finished frames in that form, so a second look costs no reading and no computing. Checked: unpacking returns the frame byte for byte. The server's own brightness fit and the FITS downloads use the archive's full 32-bit values.
- Pixels stay in detector geometry. Each frame carries a 2x2 matrix from pixel steps to sky offsets, computed from the full TAN-SIP solution (`wcs.py`). The browser places the frame on the sky with that matrix, so pixels are resampled once, at display.
- Checked: crops equal Astropy's read of the same file, pixel for pixel. Sky positions agree with `astropy.wcs` to 1e-6 arcsec.

## 3. Wavelength

- A linear variable filter sits over each detector, so wavelength changes with position. Every exposure of a fixed target is at a different wavelength.
- Each file carries a 9x9 grid of wavelength and bandwidth (the WCS-WAVE table, a per-detector calibration). `calib.py` caches the grid and interpolates it bilinearly, as the FITS -TAB convention defines.
- Checked: equal to Astropy's -TAB evaluation to 1e-9 micron.

## 4. Brightness

- `photometry.py` fits the effective PSF (Anderson and King 2000) at the target's position in each frame. The PSF comes from the file's EPSF table for the detector zone the target falls in.
- The fit is a matched filter over good pixels within 3 pixels. Saturated and flagged pixels are left out, so they don't bias the result. The sky level is the clipped median of a ring from 5 to 9 pixels.
- The error combines the variance plane and the sky uncertainty.
- A measurement is marked suspect when under 75 percent of the PSF weight fell on good pixels, when the core holds a saturated pixel, or when a flag that spoils photometry is set.
- Checked: recovers injected fluxes without bias. For Epsilon Indi B the spectrum matches 2MASS J, H, Ks and WISE W1, W2 within about 10 percent.

- For extended things (galaxies, nebulae, comet comas) the browser can instead sum the light in a circle of chosen size and subtract the median of a ring around it (`aperture.ts`). Edge pixels count by the share inside the circle. This runs on the frames already loaded, so the spectrum of any clicked spot appears at once. A circle holding a saturated or flagged pixel is marked suspect.

### Stars too bright for the detector

- Barnard's Star, R Draconis, Mira, and other bright stars saturate. Their cores are empty or flagged, so the point fit and the circle both fail.
- `measureRing` in `aperture.ts` measures a ring 19 arcsec wide around the star instead (its halo). The ring starts at the smallest radius, from 18 arcsec up, that can be measured in nearly every frame. Bad pixels are filled from good pixels at the same distance.
- The halo rises and falls with the star, so brightness changes and spectral features carry over. The overall level is the halo's, and the halo's share of the light changes smoothly with wavelength, so the spectrum's slope is not the star's. The app says so, and hides the catalog brightness points in this mode.
- It is a rough measure. Below about 2.4 microns, where a star's image is sharpest, single measurements scatter by tens of percent, so only wide bands are judged in a halo spectrum.
- Checked on R Draconis: the monthly halo brightness traces its 245 day pulsation (section 9).

## 5. Following things that move

- Stars: positions are carried to each exposure's date with proper motion and parallax (`astro.ts`, with parallax factors from the API). Barnard's Star moves 1.7 pixels across the public data.
- Catalog positions from SIMBAD are at J2000. They are carried forward along the proper motion SIMBAD lists. The five NASA targets use vetted positions.
- Solar system bodies: `solarsystem.py` takes the geocentric path from JPL Horizons and corrects each frame for where the spacecraft was, using the position in the image header. Checked against Horizons run with SPHEREx as the observer: 0.001 arcsec for comet 3I/ATLAS.

### Is a moving dot already known?

- A dot that shows in one image and not the next may be an asteroid. The last row of the objects list asks the SkyBoT service of IMCCE (Paris Observatory) where every known solar system body was at the time of the image on screen.
- The search is a circle from the middle of that image out to its corners. Bodies outside the square image are dropped. The answer lists the rest, nearest the middle first, with kind, magnitude, and motion. Any of them can then be followed through the SPHEREx images by name.
- SkyBoT's positions are for the center of the Earth. SPHEREx is at most 7,000 km from it, which shifts a main-belt asteroid by a few arcseconds.
- Checked on Vesta: asked at the position our own JPL Horizons path gives for one exposure, SkyBoT places Vesta 0.3 arcsec away.

## 6. Summing and subtracting

- `stack.ts` puts frames on a north-up grid with half-size pixels and averages them, weighted by each frame's noise. Each frame's median background is removed first.
- Outliers are rejected per pixel: against the median and its spread for up to 48 frames, and by repeated clipping around the mean beyond that.
- The sum is worked a small tile at a time. Each frame is resampled once into the tile, and each pixel's samples are then clipped and averaged. A unit test holds this code to a plain one-pixel-at-a-time definition, to the last bit, for all three methods and on awkward input (turned, shifted, flagged, and partly off the field).
- A large sum for the picture on screen is made in the background, in slices of about 10 milliseconds, so the page keeps answering. The status line says "Adding up" with the number of images. Until the sum is there, the newest finished sum of the same step stays on screen, so the picture grows as images arrive. A picture that is being saved never uses a stand-in. Its sum is made at once.
- Measured in the page on a 15 arcminute field of 356 images: the deepest sum holds the page for at most 0.06 s, and Measure Changes for no stretch longer than 0.05 s.
- Sums can follow a moving target, which keeps it sharp while the background smears.
- Subtraction shows a step minus another step, or minus the sum of the others. A single exposure is compared only with exposures within one spectral channel, because brightness changes with wavelength.

## 7. Change over time

- `lightcurve.ts` divides each measurement by the target's average in the same spectral channel. The ratio can then be compared across exposures at different wavelengths.
- Channels seen in only one visit, and channels detected at under 5 sigma on average, are left out.

## 8. Measuring motion

- `motion.ts` sums each visit with the sky held still, finds the source near its expected spot with a Gaussian-windowed centroid, and fits a straight line through the positions over time.
- A known parallax is removed first, so the yearly wobble of a nearby object is not counted as motion.
- Saturated cores are counted at a level above the brightest measured pixel, so the core still anchors the position. Errors never go below 0.25 arcsec (1 arcsec when saturated), which reflects the coarse pixels.
- Checked on the NASA targets: Epsilon Indi B 4.57 +/- 0.24 arcsec per year toward 123 degrees (catalog 4.68, 122). Barnard's Star 9.81 +/- 1.45 toward 358 (catalog 10.39, 356). WISE 0855 6.2 +/- 0.8 toward 275 (catalog 8.15, 275). The last is low because a faint star sits beside it. RW Aurigae, which barely moves, comes out as not moving.

## 9. Finding what changed

`changes.ts` checks every source in the loaded field for motion and for brightening or fading between visits. It is the "what changed here" tool.

- **Like wavelengths only.** Each visit is summed from the spectral channels that every compared visit has. A visit with thin coverage is left out when it would cost the others most of their shared channels. In a deep field, months are joined for this until each group covers most wavelengths.
- **Sources.** Peaks above 8 sigma in the sum of all visits and in each visit's own sum. A patch of saturated pixels is one star at the middle of the patch.
- **Relative astrometry.** Each source is located in each visit's sum. The median shift of the steady sources in a visit is pointing error and is removed. Their remaining scatter is the position yardstick. A straight line is fitted through each source's positions. It counts as moved at 5 sigma and at least 1 arcsec.
- **Relative photometry.** Each source is measured in a 12 arcsec circle on every frame. A visit is compared with all other visits channel by channel, so both sides see the same wavelengths with the same weights. The median ratio of the steady sources in a visit is calibration and is removed. Their scatter beyond measurement noise is the brightness yardstick. A change counts at 5 sigma and at least 5 percent. Brightness uses every visit on its own, months included, so a star that varies within a joined span is not blurred.
- **By detector.** The comparison is repeated for each detector's wavelength range. A change confined to some wavelengths, or opposite at different wavelengths, is reported with its range.
- **Stars too bright for the detector.** When the core is saturated, or flagged in over a quarter of the frames, the star is measured in a ring around it instead (its halo), starting just outside the bad core. Bad ring pixels are filled from good pixels at the same distance. Its position gets a 1 arcsec error floor.
- **Glare.** The halo of such a star lands on its neighbors and changes when the star does. The halo's share inside each neighbor's circle is estimated from the star's ring, per wavelength range, taking the halo to fade as distance cubed. From 15 percent the neighbor needs twice the certainty. From 100 percent it is not judged.
- **Seen in some visits only.** A source at 7 sigma in some visits and under 2.5 sigma in the rest is reported as appeared or vanished.

Checked on NASA's five test targets, with a 5 arcmin field. Each is flagged once, and nothing else in its field is flagged.

| Target | Result | Catalog |
|---|---|---|
| Barnard's Star | Moved 10.9 arcsec north in a year. 11.1 +/- 1.4 arcsec per year | 10.4 north |
| Epsilon Indi B | Moved 6.3 arcsec southeast. 4.6 +/- 0.1 arcsec per year | 4.7 southeast |
| WISE 0855-0714 (detectors 5 and 6) | Moved 2.8 arcsec west in six months. 6.0 +/- 0.9 arcsec per year | 8.2 west |
| RW Aurigae | 55 percent brighter at 3.8 to 4.4 microns in Sep 2025, and 22 percent fainter at 1.1 to 1.65 microns. Measured from the halo | A young star known for dimming events in which dust hides the star while the warm dust glows brighter |
| R Draconis | Monthly halo brightness swings between 0.5 and 1.5 times its average, with maxima about eight months apart | Mira variable, period 245.6 days |

Two ordinary fields (RA 200, Dec +30 and RA 83, Dec -5) gave no changes among 16 and 22 sources. Their steady sources held position to 0.12 arcsec and brightness to about 1 percent between visits.

Limits: an asteroid crossing the field appears in single frames at different places, so the sums do not hold it. Use the name search for solar system bodies. WISE 0855 is too faint to flag with all six detectors summed, because it shows only past 3.9 microns.

## 10. Finding spectral features

`features.ts` checks the spectrum on screen against the library of features in `lines.ts` and lists the ones that stand out.

- **Close comparison.** The brightness at a feature is compared with a curve fitted through the spectrum on either side. The fit is done on logarithms, where a smooth spectrum is nearly straight. A narrow line is compared with a curve that can bend, and must stand clear of the channel on each side of it.
- **Wide comparison.** The feature must also differ, the same way, from a trend line through the spectrum within about 22 percent in wavelength. The line is a repeated median, so features on up to half the points do not bend it. This tells a real dip from the plain gap between two bright bands.
- **Thresholds.** Five times the uncertainty, which includes 1 percent for the instrument's channel-to-channel ripple. At least 5 percent for a wide band and 10 percent for a narrow line.
- **What a band can do.** A wide band counts as a bump only for the few that glow, such as carbon dioxide and water in a comet. In a spectrum shaped by deep molecular bands, narrow lines are not judged, because the peaks between bands look like lines.
- **One dip, one finding.** Overlapping library features are reported once, named by the widest that fits, with the others listed as things it could also be. SPHEREx can't separate them.
- **Changing sources.** A source whose brightness changed by half or more between visits is judged visit by visit, with a 30 percent threshold, and each finding names its visit.
- **Too bright.** When under 60 percent of the measurements are trusted, nothing is reported. A saturated source loses its brightest channels first, which carves false dips.

Checked on known objects.

| Object | Found | Known |
|---|---|---|
| Epsilon Indi B (T dwarfs) | Methane at 3.32 and 2.30 microns, water at 1.40 and 2.70, carbon monoxide at 4.67, carbon dioxide at 4.27 | The molecules that define T dwarfs |
| TRAPPIST-1 (M8 dwarf) | Water at 1.40 and 1.90 microns | Steam bands of a late M dwarf |
| Comet 3I/ATLAS, Dec 2025 | Carbon dioxide at 4.27 microns, 41 times the light beside it. Water at 2.70. Organic molecules at 3.40 | A coma rich in carbon dioxide, with water and organics |
| HD 209458 (Sun-like star) | Nothing | A smooth spectrum at this resolution |
| WISE 0855-0714 | Nothing | Too faint per channel to judge |
| NGC 7027, Mira | Not judged | Too bright for the detector |

## 11. Color

- Frame viewer: three sums from three wavelength ranges become red, green, and blue. Brightness is stretched while the ratio between colors is kept. Saturated pixels show white.
- Sky map: `colorhips.py` merges three channels of the IRSA all-sky cube into color tiles.

## 12. Distance

- `distance.py` uses a parallax when it is at least five times its error, then a published distance from SIMBAD, then the redshift with Planck 2018 cosmology.

## 13. Blinking against an older survey

- Blink swaps the SPHEREx image on screen with an older survey's picture of the same patch of sky, back and forth. A source that jumps has moved in the years between. A source in only one of the two has moved a long way, changed brightness, or shines at only one of the two wavelengths.
- The older pictures are WISE at 4.6 and 3.4 microns (taken in 2010), 2MASS (1997 to 2001), and the Digitized Sky Survey (photographic plates, mostly from the 1980s and 1990s). "Best match" takes the one nearest in wavelength to the image on screen: WISE 4.6 for detectors 5 and 6, WISE 3.4 for detector 4, and 2MASS below 2.5 microns.
- The older picture is drawn by a second Aladin Lite view from the survey's HiPS tiles at IRSA. It is given the image viewer's center and width of sky, with north up, so the two share one grid.
- Checked on RW Aurigae against 2MASS: every bright star falls on the same screen pixel in both pictures, at the first zoom and after zooming and panning. Checked on WISE 0855 with detectors 5 and 6: the brown dwarf is at the marker in the SPHEREx sum and is not there in the WISE picture from 2010, when it was 127 arcsec to the east.
- A single SPHEREx exposure is much shallower than these surveys, so many faint stars show only in the older picture. Summing by visit, or all visits, gives a fairer match.

## 14. Saving data

- A single exposure is saved as a FITS file made by the API: the archive's own pixels around the position, unchanged, in three extensions (IMAGE in MJy/sr, FLAGS, VARIANCE). The header carries the parent image's world coordinates, tangent plane with SIP distortion. Only the reference pixel is moved to the cutout's corner, which is the standard way to cut out an image.
- "Save all images" gives every loaded exposure in that form, in one zip with a note that lists anything left out.
- A sum exists only in the browser, so the browser writes its FITS file: one image on a north-up tangent-plane grid of half detector pixels, with the number of exposures and their date and wavelength ranges in the header. A sum mixes wavelengths and has each exposure's background removed, so its header says it is for finding and placing sources, not for calibrated brightness.
- Checked with Astropy on Epsilon Indi B. The server's cutout puts the target at the center pixel of a 67 by 69 pixel cutout, with pixels of 6.15 arcsec. The browser's sum passes Astropy's format check and puts the target on its brightest pixel. A unit test proves that a cutout's pixel and the same pixel of the parent image give the same sky position.
- Tables are CSV with a few comment lines that say what each column is: the spectrum, the brightness over time, and what the change finder found.
- A saved picture (PNG) and a saved animation (GIF) are for showing, not for measuring. Each is the part of the view that the field covers, with its marks, a scale bar, a compass, and a caption that credits the data. It is drawn again at its own size, not copied from the screen, so it is as sharp from a small window as from a large one: 1600 pixels on a side for a picture of a square field, and 1080 for an animation.
- A GIF frame holds at most 256 colors. A gray picture keeps its shades of gray to within one step of 255, and its colored marks share up to 64 colors. A color picture gets 256 colors fitted to each frame and is dithered by the method of Floyd and Steinberg, so smooth gradients do not break into bands. A sequence of more than 240 steps is thinned evenly, and a film that would pass 48 MB is drawn smaller to fit.
- Checked on Nov 15 in headless Chrome. WISE 0855 by visit was saved at 1080 by 1191 pixels, where the earlier code gave 560 by 151 from the same window. A 128-frame film of it came to 17.8 MB in 13 s, and a 180-frame film of comet 3I/ATLAS to 23.9 MB in 18 s. Unit tests hold the gray shades to one step, and the dithered tone of a color gradient to half a step on average.

## 15. The solar system on the sky map

- The map marks 41 bodies where they are right now, and moves them once a minute: the Sun, the Moon, the planets, Pluto and nine more dwarf planets and likely dwarf planets, thirteen asteroids, six comets, and the three known visitors from other stars.
- Each body has an orbit around the Sun from JPL Horizons, taken on the day `scripts/update_solar.py` was last run (osculating elements). The browser moves the body along that orbit with Kepler's equation, does the same for the Earth, and takes the difference, with one correction for the time light takes to arrive. Closed and open orbits are both handled, so the interstellar visitors work too. No service is called to place them.
- The Moon is different. The Sun pulls its orbit about too quickly for one fixed orbit to hold, so it comes from the low-precision series of the Astronomical Almanac.
- Checked against JPL Horizons 30 days after the orbits were taken, which the unit test repeats. Every body is within 16 arcsec: the planets and small bodies mostly within 5, Venus 15, Mercury 9. The Moon is within 0.06 degree, a tenth of its own width.
- The orbits drift from the truth over months, mostly for bodies that pass close to planets. Running the script again renews them.
- Clicking a body follows it through the images at once, with the exact path from JPL Horizons, as for any moving target (section 5). Its card says what it is and how far it is from the Earth and the Sun right now. The Sun and the Moon have no SPHEREx images, so a click only shows their card.
- The Sun and the Moon are drawn as discs of their true size, from their radius (695,700 km and 1,737.4 km) and their distance at that moment. The Moon shows its lit share and the bright edge faces the Sun (Meeus, Astronomical Algorithms, chapter 48). Checked against JPL Horizons at three moments, which the unit test repeats: the widths agree to half a percent, the lit share to one point in a hundred, and the Sun's direction to one degree. The discs are drawings over the map, not survey images.
- A study of a body the map marks opens with its yellow square on its green marker, where the body is now, and the map stays put when the marker is clicked (Matt's decisions, Nov 15). Searching the body by name sends the map to its marker.
- Once the film is played or stepped, the square goes to where the image on screen was taken, with the name and that date written on it. It then moves along the body's path as the film plays, and the map follows it when it leaves the view. Changing the way of viewing starts the film over, and the square is on the marker again.
- A body the map does not mark has no place on the map today, so its square is always where the image on screen was taken.

## 16. The sky map's overlays and measure tool

- The two coverage overlays are IRSA's own coverage maps, the ones its SPHEREx Data Explorer shows: every part of the sky with spectral images in the archive, and the deep fields. They are files in the IVOA MOC format. The API relays them, because IRSA does not let browsers read them directly, and keeps each for a day.
- The tile grid is the HEALPix grid that every all-sky map (HiPS) is cut into. Aladin Lite draws it.
- The measure tool gives the angle between two points on the sky with the Vincenty formula, which is exact at any separation. The direction is counted from north through east. The line drawn is the shortest path on the sky, in 48 pieces, so it is right in every map shape. Checked against the map library's own conversion from screen to sky, to 0.01 arcsec.
- The coordinates box shows right ascension and declination, J2000, under the pointer and at the center of the map. What it copies reads back into the Find box and into other archives.

## 17. Links that carry the whole view

- The page address is rewritten as the view changes, after a short pause, so it can be copied at any time. `docs/embedding.md` lists every option.
- The image on screen is named by its time and its wavelength, not by its number in the film. A new data release adds images, which would shift every number. Two detectors expose at the same moment, so time alone is not enough, and wavelength tells them apart. A sum per wavelength is named by wavelength alone, because its mean time changes whenever a visit is added.
- A value at its default is left out. The default brightness scale is different while only changes are shown, so the link compares against the right one.
- The sky map goes to a study by itself. Where it looks is written only when it differs from that by more than 2 percent of its width in position or 5 percent in width.
- Parts of the view need the images first: the step, the zoom, a spot's spectrum, blinking. They are put back once every image is in. Until then the address is left as it was opened, so a reload still asks for the whole view.
- Checked by opening a copied link in a new tab and comparing the two states: the same image, zoom, pan, brightness, color table, open tool, spectrum settings, map overlays, and map view (to the last digit a link carries).

## 18. How many images a wide field loads

- Every loaded image stays in memory, so that playing, summing, and measuring are instant. Each pixel costs up to 10 bytes: the image as received, a copy for measuring, and its flags.
- The budget follows the computer (`core/state/device.ts`). The smallest is 60 million pixels, about 600 MB at worst, for phones, tablets, and anything the browser says little about. A computer that reports 8 GB or more gets twice that, and three times with twelve or more processor threads. Firefox and Safari report no memory, so a wide screen with a mouse and eight threads counts as a desktop and gets twice. A viewer embedded in another page keeps the smallest.
- At the default 5 arcminute field every image fits on any device. At 50 arcminutes, the widest field, the smallest budget holds 126 images and the largest 378. Past the budget, the images are sampled evenly over time, which keeps every visit and wavelength represented, and the status line says so.
- The server accepts up to 250 million pixels in one request, so the largest budget stays inside its limit. A unit test checks that.
- A new field size, or "Try again", reloads the same target. The film then comes back to the image that was on screen, found by its time and wavelength as in a link (section 17). If the film was moved while the reload ran, it is left where the person put it.

## Known limits

- SPHEREx pixels are 6.15 arcsec and the PSF is about as wide, so images are undersampled. Subtraction leaves residuals around bright stars.
- The PSF fit assumes a point source. Extended objects such as comet comas and galaxies are underestimated.
- Sources within about 2 pixels of each other are not separated. WISE 0855 has a faint star nearby that dominates below 3.9 microns.
- A few fast-moving objects are listed in SIMBAD at the date they were observed, not at J2000. Their carried-forward position can be off.
- Sky tiles for the map come from IRSA. If IRSA is down, the map is blank, but search and the frame viewer still work.
