# SPHEREx data

Includes live checks against IRSA. "Unverified" marks items not confirmed in a primary source.

## Mission and instrument

- Launched 2025-03-12 03:10 UTC. Science operations from 2025-05-01. The archive starts 2025-04-24.
- Maps the whole sky every six months. The first all-sky map finished in December 2025. Year 1 (two passes) ended mid-May 2026. The prime mission is 25 months of science operations, ending around mid-2027.
- Six detector arrays of 2040 x 2040 active pixels, 6.15 arcsec per pixel. Each array covers 3.485 degrees.
- A dichroic splits the light, so D1 and D4, D2 and D5, and D3 and D6 see the same sky at the same moment. The focal plane covers 3.5 x 11.3 degrees.
- Exposure time (XPOSURE) is 113.58 s. About 3,600 images a day.

| Detector | Wavelength (µm) | Resolving power R |
|---|---|---|
| D1 | 0.744 to 1.116 | 39 |
| D2 | 1.099 to 1.651 | 41 |
| D3 | 1.636 to 2.421 | 41 |
| D4 | 2.423 to 3.822 | 35 |
| D5 | 3.809 to 4.420 | 112 |
| D6 | 4.412 to 5.002 | 128 |

### Linear variable filters

- Each detector's filter wavelength changes along the detector y axis. 17 channels per detector, 102 in total. One channel is about 120 px (11.8 arcmin).
- A fixed sky position lands at a different wavelength in every exposure. A time-ordered sequence of one position is also a wavelength sweep. Most brightness changes between consecutive frames are the spectrum, not variability.
- A survey steps a target through all 17 channel positions with 11.8 arcmin slews. A full spectrum needs at least 51 exposures. About 64 per pass were measured at ecliptic latitude -24 degrees.
- Each position is observable twice a year, about six months apart. All channels are covered within about two weeks.
- Surveys 3 and 4 are shifted half a channel (6 arcmin) from surveys 1 and 2.

### Deep fields

- About 100 square degrees each. North is centered on the north ecliptic pole. South is centered at ecliptic longitude -44.8, latitude -82.
- Observed nearly every 98-minute orbit. Over 400 observations per channel at the center by mission end.

### Image quality

- PSF FWHM is about 5 to 9 arcsec (median 5.3 in D1, 7.5 in D2, 8.7 in D4). Images are undersampled.
- Meisner et al. 2026: "The undersampling of SPHEREx images makes such attempts at coaddition and image differencing particularly challenging."
- Orientation flips 180 degrees between half-orbits. Long-wave detectors (D4 to D6) are mirrored in x. Cutouts follow the parent image axes and are not north-up.

### Depth and saturation

- 5-sigma point-source depth per channel after four surveys: 19.5 to 19.9 AB at 0.75 to 3.8 µm, 17.8 to 18.8 AB at 3.8 to 5 µm. In-flight median 19.7 AB.
- A single pass is roughly 0.75 mag shallower (unverified estimate).
- Deep fields reach about 21.6 to 21.9 AB and 20.1 to 21.0 AB (2021 forecast, ignores confusion).
- Saturation onset in AB mag (Explanatory Supplement Table 25): B1 11.50, B2 11.50, B3 11.30, B4 11.71, B5 10.19, B6 9.75.
- 50-sigma thresholds in AB mag: 14.74, 14.79, 14.61, 14.85, 13.46, 13.17.

## Releases and collections

| Collection | Contents | Status |
|---|---|---|
| `spherex_dr1` | Data Release 1: Year 1 images reprocessed with pipeline 7 | Live |
| `spherex_dr1_deep` | DR1 deep-field images | Live |
| `spherex_qr3` | Quick Release 3, pipeline 7, data from 2026-07-20 on | Live, weekly batches |
| `spherex_qr3_deep` | QR3 deep-field images | Live |
| `spherex_qr2`, `spherex_qr2_deep` | Older quick release, pipeline 6 | 0 rows from SIA |
| `spherex_qr` | QR1 | Retired Feb 2026 |

- IRSA: "The DR1 spectral images are intended to be used together with the QR3 spectral images as a uniformly processed set."
- DR1 also includes a Spectral All-Sky Cube in the 102 channels.
- A wrong collection name returns 0 rows with no error. The SIA self-description (`MAXREC=0`) lists the current names.
- Quick Release batches come weekly, each covering 7 days of observations, 24 to 57 days after observation. IRSA promises within 60 days. SIA lags TAP by about a day.
- DOIs: DR1 images 10.26131/IRSA678, all-sky cube 10.26131/IRSA679, QR3 10.26131/IRSA662, QR2 10.26131/IRSA652.
- File directories look like `l2b-v27-2026-197`. v27 is pipeline 7.0.5. One position can mix processing versions.
- Planned: High Reliability Source Catalog (Aug 2027 and Jan 2028). Deep-field mosaics, redshift, and ice catalogs (May 2028). The SPLICES ice target list is TAP table `splices`.

## Level 2 file format

File names follow `level2_<OBSID>D<det>_spx_l2b-v<NN>-<YYYY>-<DOY>.fits`. Files are 65 to 72 MB.

| HDU | Name | Content |
|---|---|---|
| 0 | PRIMARY | No data. Holds VERSION. |
| 1 | IMAGE | float32, 2040 x 2040, MJy/sr. Zodiacal light not subtracted. |
| 2 | FLAGS | int32 bitmask. Pipeline 7 (DR1 and QR3) stores it as a RICE_1 tile-compressed table, one tile per row. |
| 3 | VARIANCE | float32, MJy^2/sr^2. |
| 4 | ZODI | float32 zodiacal light model, MJy/sr. |
| 5 | EPSF (pipeline 7) or PSF (older) | Pipeline 7: table of 441 rows (21 x 21 zones, D3 has 451) with 33 x 33 stamps, 5x oversampled, columns XCENTER, YCENTER, CWAVE, CBAND, EPSF. Older: 101 x 101 x 121 cube, 10x oversampled. |
| 6 | WCS-WAVE | One-row table of control points with wavelength and bandwidth in µm. Grid size varies by file. |

### WCS and wavelength

- The sky WCS is RA---TAN-SIP, SIP order 3. It is on IMAGE, FLAGS, VARIANCE, and ZODI.
- Alternate WCS "W" (WAVE-TAB) gives wavelength and bandwidth by bilinear interpolation, accurate to about 1 nm. Alternate WCS "A" gives 0-based parent-image pixels.
- Astropy: `WCS(header, fobj=hdul, key='W')`, set `.sip = None`, then `pixel_to_world(x, y)` returns wavelength and bandwidth.
- For science-grade wavelengths, the `spectral_wcs` calibration files hold per-pixel CWAVE and CBAND maps.
- Header lengths differ between versions. Parse headers instead of hard-coding byte offsets.

### Header keywords

- Time (UTC): DATE-OBS and MJD-OBS (start), DATE-BEG and MJD-BEG, DATE-AVG and MJD-AVG (midpoint), DATE-END and MJD-END.
- Exposure: XPOSURE 113.5826 s, TELAPSE 118.1873 s.
- Identity: DETECTOR (1 to 6), OBSID, EXPIDN, VERSION (primary HDU).
- Pointing: CRVAL1 and CRVAL2, SPS_ELON, SPS_ELAT, SPS_EPA (0 or 180 identifies the survey), SPS_FLAGS (`all_sky`, `deep_north`, and so on).
- Spacecraft geocentric position and velocity: X_SC, VX_SC, and related keys.
- Quality: PSF_FWHM, L2DQAFLG, per-flag counts, HE_AG_* (helium airglow), AURORA_CORR, SHUTTLE_GLOW_CORR.

### FLAGS bits

| Bit | Name | Meaning |
|---|---|---|
| 0 | TRANSIENT | Cosmic ray or bloom onset |
| 1 | OVERFLOW | About half of full well reached during the ramp |
| 2 | SUR_ERROR | Onboard error. With bit 0 or 1 it means early transient or early overflow |
| 6 | NONFUNC | Dead pixel |
| 7 | DICHROIC | Band 3 and 4 corners with under 50% throughput |
| 9 | MISSING_DATA | Data lost before ingest |
| 10 | HOT | Hot in this exposure |
| 11 | COLD | Anomalously low in this exposure |
| 12 | FULLSAMPLE | Informational |
| 14 | PHANMISS | Phantom correction not applied |
| 15 | NONLINEAR | Nonlinearity correction unreliable |
| 17 | PERSIST | Persistent charge above threshold |
| 19 | OUTLIER | Flagged by outlier detection |
| 20 | CROSSTALK | Pipeline 7 only |
| 21 | SOURCE | Known-source mask (nominal) |
| 22 | GHOST | Ghost from a bright source in the frame |
| 24 | GHOST_EXT | Ghost from a source outside the field |
| 25 | STREAK | Satellite streak, pipeline 7 only |
| 26 | BLOOM | Bloom artifact |
| 27 | SNOWBALL | Snowball artifact |
| 28 | HALO | Transient halo |
| 29 | SATELLITE_HALO | Listed in the Supplement |

- Bits 4 and 5 (PHANTOM, REFERENCE) are header-only. Bits 3, 8, 13, 16, 18, 30, 31 are unused.
- Nominal values are 0 or 2097152 (SOURCE only).
- Photometry masks SUR_ERROR, NONFUNC, MISSING_DATA, HOT, COLD, NONLINEAR, PERSIST, BLOOM, SNOWBALL, HALO, and SATELLITE_HALO.
- The Mosaic Tool also drops TRANSIENT, DICHROIC, PHANMISS, CROSSTALK, the GHOST bits, and STREAK.
- Bit names are self-described in headers. Pipeline 7 uses MSKN (name), MSKM (mask), and MSKD (description) keywords. QR2 used `MP_<NAME>`.

### Artifacts and contamination

- Saturated pixels with early overflow are stored as NaN. Bloom rings are flagged. Persistence is predicted and flagged in later frames.
- Electrical crosstalk makes a negative image 32 rows away that repeats every 64 columns.
- Ghosts: a beam-splitter ghost (about a 10 arcmin disk) from very bright sources, frame-edge and linear ghosts, and Moon stray light at detector edges.
- He I 1.083 µm airglow affects bands 1 and 2. Aurora and shuttle glow appear near 2.9 and 4.5 µm. Satellites, snowballs, and diffuse optical transients (about 1% of frames) also occur.
- A flagged pixel produced a false 61-sigma "detection" at WISE 0855's position.

## Access

| Service | Endpoint | Browser CORS | Notes |
|---|---|---|---|
| SIA v2 | https://irsa.ipac.caltech.edu/SIA | No | About 1 s. Always pass COLLECTION. |
| TAP | https://irsa.ipac.caltech.edu/TAP/sync | No | Tables `spherex.obscore`, `spherex.plane`, `spherex.artifact`, `spherex.observation`. Spatial joins take about 15 s. |
| Cutouts | `<access_url>?center=<ra>,<dec>&size=<size>` | No | 4 to 5 MB each. HTTP 503 with Retry-After 5 under load. |
| AWS S3 | https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/<key> | Yes, Range allowed | Anonymous. Prefixes `dr1/`, `qr2/`, `qr3/`. |
| HiPS cube | https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube | Yes | Static Year 1 coadd. |
| MOST | astroquery `Most` with `catalog="spherex"` | Server-side | Known solar system objects in SPHEREx images, since June 2026. |

### SIA v2

- Parameters: COLLECTION, `POS=CIRCLE <ra> <dec> <radius_deg>` (RANGE and POLYGON also work), `TIME=<mjd1> <mjd2>`, `BAND=<m1> <m2>` in meters, MAXREC, RESPONSEFORMAT (csv, votable, fits, json).
- BAND filters by detector, not by the wavelength at your target, because em_min and em_max cover the whole detector.
- Example: `https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1&POS=CIRCLE+133.76+-7.242+0.01&RESPONSEFORMAT=csv`
- Useful columns: access_url, cloud_access (S3 bucket and key as JSON), t_min, t_max, energy_bandpassname, em_min, em_max, obs_id, s_region, access_estsize, obs_collection, obs_release_date.
- Response sizes for 256 rows: CSV 234 KB, VOTable 561 KB, JSON 771 KB.

### Cutouts

- Append `?center=<ra>,<dec>&size=<w>[,<h>]` to an on-prem `/ibe/data/` access URL. Units default to degrees. arcmin, arcsec, and px also work.
- IMAGE, FLAGS, VARIANCE, and ZODI are cropped. FLAGS come back decompressed. PSF or EPSF is copied whole. WCS-WAVE is copied, with CRPIX offsets in the headers.
- Partial overlap is NaN-filled. No overlap returns HTTP 500. HEAD returns 405.
- PSF zone for a cutout pixel: `x_orig = 1 + x_cutout - CRPIX1A` (same for y), then the nearest zone center.
- A 0.05 degree cutout (29 x 29 px) was 4 to 5 MB and took 1 to 2.5 s.
- Parallel cutout requests fail often. An IRSA tutorial saw 37 of 84 fail with 10 workers.

### AWS S3

- Bucket `nasa-irsa-spherex`, region us-east-1, anonymous access. Keys match the path after `/ibe/data/spherex/`.
- CORS: Access-Control-Allow-Origin `*`, GET and HEAD, Range allowed in preflight. JavaScript can read Content-Length but not Content-Range.
- Data is uncompressed float32 except pipeline 7 FLAGS. A cutout can be read as contiguous row ranges, about 8 KB per row. A 29-row range read was 237 KB in about 0.2 s.
- A full-file download measured about 65 MB/s from S3 versus 4.5 MB/s from IRSA (host dependent).
- No egress charges today. IRSA warns limits may come later.

### HiPS all-sky cube

- "SPHEREx DR1 all-sky data cube": HiPS order 5, 512 px tiles, 12.9 arcsec pixels, 102 frames. Frame index = 17 x (band - 1) + (channel - 1). Frames 50 and 51 are blank.
- PNG tiles: `Norder{k}/Dir{d}/Npix{n}.png` for frame 0 and `Npix{n}_{f}.png` for frames 1 to 101.
- FITS cube tiles `Npix{n}_cube.fits` (about 321 MB each) hold IMAGE (float32, 512 x 512 x 102, MJy/sr), NHITS, FLAGS, SPECTRAL_CHANNELS, and WCS-WAVE. Range reads work.
- Covers 2025-04-24 to 2026-05-14. A static coadd, so it has no time series.
- IRSA's HiPS list (CORS allowed): https://irsa.ipac.caltech.edu/data/hips/list

### IRSA tools and notebooks

- SPHEREx Data Explorer (Firefly-based): https://irsa.ipac.caltech.edu/applications/spherex/
  - Has: position and target-list search, time and wavelength filters, results table, coverage view, grid view, 3-color images, cursor wavelength readout, flag overlays, catalog overlays, quick-look extraction.
  - Limits: no animation ("Currently, there is no automatic 'play' or animation through the planes"). Lock-by-WCS resets zoom. Cutouts aren't north-up and carry the full PSF. Wavelength filtering is per detector. Deep links cover the search only. Not usable on iPhone. Parts of the help are stale.
  - URL API: `?api=spectral-images&ra=..&dec=..&sr=..&execute=true` (search only).
- Spectrophotometry Tool: Tractor forced photometry, point or Sérsic models, 20 sources per job, 2 jobs at a time, about 1.67 s per image plus 50 s. No public API found.
- Mosaic Tool: GUI only. 102-plane cubes up to 5 x 5 degrees. Excludes deep-field frames.
- Tutorial notebooks: https://caltech-ipac.github.io/irsa-tutorials/spherex/ (intro, cutouts, PSF, source discovery tool, mosaic cubes, HiPS cubes). The source discovery notebook is the only one that extracts a spectrum from Level 2 images. It masks flags, subtracts background with sep, and does aperture photometry on 0.1 degree cutouts.
- Known issues: https://irsa.ipac.caltech.edu/docs/known_issues/spherexbugslist.html

### Usage policy

- No published rate limits for SIA, TAP, or downloads (unverified). The cutout service throttles.
- IRSA has had DDoS-related outages and has biweekly Tuesday maintenance windows.
- Data are public with no restrictions: https://irsa.ipac.caltech.edu/data_use_terms.html
- Acknowledgment text and DOIs are in `docs/references.md`.

## Key documents

- Explanatory Supplement: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf
- Archive User Guide: https://caltech-ipac.github.io/spherex-archive-documentation/
- DR1 overview: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html
- Quick Release overview: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html
- Cutout service: https://irsa.ipac.caltech.edu/ibe/cutouts.html
- Cloud access: https://irsa.ipac.caltech.edu/cloud_access/
- Comet 3I/ATLAS in SPHEREx: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/comet3iatlas/index.html
