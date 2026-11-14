# Methods

How SPHERExplorer turns the public SPHEREx archive into pictures, spectra, and measurements. Each step names the code that does it and how it was checked.

## 1. Finding the images of a place

- SPHEREx has taken about 273,000 exposures, each on six detectors. `server/spherex_api/index_build.py` lists the public S3 bucket and reads one FITS header per exposure. It stores the time and the pointing as a 3x3 frame matrix.
- The six detectors sit at fixed angles from each other. Those angles, the pixel scale matrix, and the lens distortion (SIP) polynomial of each detector are measured once from 200 exposures and stored with the index.
- A search projects the target onto all six detectors of every exposure. It is a few matrix products and takes about 20 ms. See `exposures.py`.
- Checked: the predicted pixel agrees with the file's own header to a median of 0.4 pixels. Image counts match the IRSA search for the five NASA test targets.
- IRSA's SIA service is the fallback when no index is loaded.

## 2. Reading pixels

- Level 2 files are 65 to 72 MB. `layout.py` maps a file with two or three small Range reads, then remembers the layout.
- `cutout.py` reads only the rows it needs from IMAGE, FLAGS, and VARIANCE, and crops them. FLAGS is RICE-compressed with one tile per row, so single rows can be decompressed.
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

## 5. Following things that move

- Stars: positions are carried to each exposure's date with proper motion and parallax (`astro.ts`, with parallax factors from the API). Barnard's Star moves 1.7 pixels across the public data.
- Catalog positions from SIMBAD are at J2000. They are carried forward along the proper motion SIMBAD lists. The five NASA targets use vetted positions.
- Solar system bodies: `solarsystem.py` takes the geocentric path from JPL Horizons and corrects each frame for where the spacecraft was, using the position in the image header. Checked against Horizons run with SPHEREx as the observer: 0.001 arcsec for comet 3I/ATLAS.

## 6. Summing and subtracting

- `stack.ts` puts frames on a north-up grid with half-size pixels and averages them, weighted by each frame's noise. Each frame's median background is removed first.
- Outliers are rejected per pixel: against the median and its spread for up to 48 frames, and by repeated clipping around the mean beyond that.
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

## 9. Color

- Frame viewer: three sums from three wavelength ranges become red, green, and blue. Brightness is stretched while the ratio between colors is kept. Saturated pixels show white.
- Sky map: `colorhips.py` merges three channels of the IRSA all-sky cube into color tiles.

## 10. Distance

- `distance.py` uses a parallax when it is at least five times its error, then a published distance from SIMBAD, then the redshift with Planck 2018 cosmology.

## Known limits

- SPHEREx pixels are 6.15 arcsec and the PSF is about as wide, so images are undersampled. Subtraction leaves residuals around bright stars.
- The PSF fit assumes a point source. Extended objects such as comet comas and galaxies are underestimated.
- Sources within about 2 pixels of each other are not separated. WISE 0855 has a faint star nearby that dominates below 3.9 microns.
- A few fast-moving objects are listed in SIMBAD at the date they were observed, not at J2000. Their carried-forward position can be off.
- Sky tiles for the map come from IRSA. If IRSA is down, the map is blank, but search and the frame viewer still work.
