# Test targets

A snapshot from November 2026. Recheck anything time-sensitive against the live services.

NASA asks teams to test on these five targets. Positions are propagated to epoch 2026.0 with full space motion. Pixel motions use 6.15 arcsec per pixel.

## Summary

| Target | Position at 2026.0 (ICRS) | Offset from usual coordinates | Motion in public SPHEREx data | Visibility |
|---|---|---|---|---|
| Barnard's Star | 17h57m47.104s +04d46m05.60s (269.446267, +4.768222) | 270" (44 px) north of J2000 | About 1.7 px over 3 seasons | Saturated, NaN core |
| Eps Ind B | 22h04m23.197s -56d48m02.39s (331.096656, -56.800664) | 122" (20 px) from J2000 | About 1.1 px over 4 seasons | S/N 35 to 129 per frame in D2 to D6 |
| WISE 0855 | 08h55m02.344s -07d14m31.86s (133.759765, -7.242182) | 127" (21 px) west of NASA's coordinate, 212" from J2000 | About 1.3 px, May 2025 to May 2026 | Only above 3.9 µm |
| RW Aur | 05h07m49.46s +30d24m04.1s (west star) | Under 1" | None | Partly saturated |
| R Dra | 16h32m40.136s +66d45m18.09s (248.167233, +66.755024) | Under 1" | None | Heavily saturated |

## SPHEREx images per collection

SIA, radius 0.01 degrees, with DR1 live.

| Target | dr1 | dr1_deep | qr3 | qr3_deep |
|---|---|---|---|---|
| WISE 0855 | 258 | 0 | 0 | 0 |
| Barnard's Star | 240 | 0 | 124 | 0 |
| Eps Ind B | 347 | 0 | 120 | 0 |
| RW Aur | 226 | 0 | 110 | 0 |
| R Dra | 422 | 1,233 | 126 | 733 |

Season dates below were measured on QR2. DR1 covers the same observations.

## Barnard's Star

- Gaia DR3 4472832130942575872. M4V. Parallax 546.976 mas. Proper motion -801.551, +10362.394 mas/yr (10.39"/yr toward PA 355.6). RV -110.47 km/s.
- V 9.511, G 8.194, J 5.244, H 4.83, Ks 4.524, W1 4.36, W2 3.66 (saturated in WISE).
- Four sub-Earth planets (periods 2.34 to 6.74 days). BY Dra variable with an amplitude of 0.02 mag in V.
- Seasons: Aug 15 to Sep 5, 2025, Mar 11 to Apr 10, 2026, and Aug 16 to Sep 2, 2026, plus a few extra visits. No May to Jul 2025 data. Ecliptic latitude +28.2.
- Expected: a saturated blob moving north about 0.95 px from Aug 2025 to Mar 2026, then 0.74 px to Aug 2026. Parallax adds about 0.5" east-west per season. Motion within a season is under 0.2 px.
- Pitfalls:
  - A small field at the J2000 position misses the star entirely.
  - NaN cores look like holes unless drawn as saturated.
  - Crosstalk and persistence ghosts can look like moving objects.
  - Neighbors at 17 to 44" stay fixed.

## Epsilon Indi B (Ba and Bb)

- SIMBAD "* eps Ind B", Gaia DR3 6412596012146801152. A T1 + T6 brown dwarf binary with an 11.02-year orbit. The separation never exceeds about 1". Masses 66.9 and 53.3 Jupiter masses.
- Proper motion +3981.977, -2466.832 mas/yr (4.68"/yr toward PA 121.8). System parallax 274.843 mas (3.64 pc, from A).
- J 11.908, H 11.306, Ks 11.208, W1 10.718, W2 9.492.
- Eps Ind A at 2026.0: 22h03m34.208s -56d48m15.48s, 402.6" (65.5 px) west of B. Saturated, with 31 NaN and 44 OVERFLOW pixels in one D2 cutout. It shares B's motion.
- Seasons: Apr 24 to Jun 10, 2025, Sep 28 to Nov 12, 2025, Apr 18 to May 4, 2026, and Sep 22 to Oct 2, 2026. The last season has only D2, D3, D5, and D6. Ecliptic latitude -41.5.
- Expected: 0.3 to 0.4 px per half-year toward the east-southeast, 6.6" (1.07 px) from Apr 2025 to Sep 2026. Peak brightness swings from 0.03 to 29 MJy/sr across wavelengths. That is the spectrum, not variability. Not detected at 0.76 to 0.78 µm.
- Pitfalls:
  - Ba and Bb are unresolved and have no separate SIMBAD entries.
  - Crosstalk copies of A fall about 3' from B.

## WISE 0855-0714

- SIMBAD main ID WISEA J085510.74-071442.5. Type Y2 (SIMBAD) or later than Y4 (Rustamkulov et al. 2026). Parallax 439.0 mas (2.28 pc). Proper motion -8123.7, +673.2 mas/yr (8.15"/yr toward PA 274.7).
- J 25.0, H 23.83, W1 16.23, W2 13.70, Spitzer [3.6] 17.44, [4.5] 13.89.
- NASA's coordinate (133.795129, -7.245147) is the position at about epoch 2010.45.
- All public images are DR1. QR3 has none. Seasons: May 5 to 6, 2025 (15 exposures), Oct 31 to Nov 14, 2025 (55) plus Dec 11 to 13 (9), and Apr 21 to May 14, 2026 (50). The Oct to Nov 2026 season is not public yet.
- Visible only above about 3.9 µm (D5 above about 4 µm, and D6). Single frames reach S/N 1.4 to 6.6, best at 4.2 to 4.7 µm. Season stacks of D5 and D6 should reach S/N 10 to 20 (unverified estimate).
- Expected: a faint source stepping west about 0.68 px per half-year, 1.3 px over the year. Parallax changes each step by about 20%.
- Pitfalls:
  - A stationary star (Gaia DR3 5756956644387831296, G 16.3, W1 15.04) gets closer each season, 11.9" in 2025 to 3.2" by late 2026. It shows at short wavelengths, where WISE 0855 is invisible. A blink across all detectors makes a "source" seem to jump between the two.
  - A flagged pixel produced a false 61-sigma detection.
  - Rustamkulov et al. 2026 published a stacked SPHEREx image of it.

## RW Aurigae

- Two T Tauri stars (K1/5e and K5e) 1.45" apart, unresolved by SPHEREx. Gaia DR3 156430822114424576 (west) and 156430817820015232 (east). Proper motion about 27 mas/yr.
- Combined J 8.378, H 7.621, Ks 7.020, W1 6.246, W2 5.228. V 9.2 to 13.6.
- A dimming began Dec 2024 to Feb 2025. On 2025-03-17, A's 0.7 to 1.3 µm flux was about 10% of earlier levels (CBET 5530).
- Seasons: Sep 1 to 20, 2025, Feb 20 to Mar 12, 2026, and Sep 2 to 16, 2026. Ecliptic latitude +7.5.
- Measured at matched wavelengths in D1: about 2.2x brighter at 0.75 to 0.81 µm and 1.25x brighter near 1.0 to 1.08 µm from Sep 2025 to Sep 2026.
- Pitfalls:
  - Compare only matched wavelengths.
  - He I airglow at 1.083 µm.
  - 2 to 3 mag past saturation in B1 to B4. Photometry is somewhat nonlinear at long wavelengths.

## R Draconis

- Mira variable, period 245.6 days (GCVS), V 6.7 to 13.2, spectral type M5e to M9e III. Gaia DR3 1648328016354496384. Proper motion about 21 mas/yr.
- J 3.71 to 3.86, H 3.13, K 2.23 to 2.44. W1 and W2 saturated.
- 8.6 degrees from the north ecliptic pole, on the edge of the north deep field. About 5x the cadence of the other targets, covering about 2 pulsation cycles. Main gaps: late Jul to late Aug 2025 and mid Jan to early Feb 2026.
- 6.5 to 8.5 mag past saturation. Cutouts of 21 x 21 px had 7 to 37 NaN and 15 to 53 OVERFLOW pixels. The halo fills a 2' box.
- Measured at 0.89 to 0.95 µm (D1 annulus): 12 to 19 MJy/sr in Aug to Sep 2025, 20 to 30 MJy/sr in Aug 2026.
- Pitfalls:
  - Peak pixels are useless. Track halo size or an annulus at matched wavelengths.
  - Query the deep collections separately.
  - Thousands of cutouts need paging and caching.

## NEOSSat coverage (CSA partner data)

Images within 0.5 degrees, from CADC. See `partner-data.md`.

| Target | Images | Dates |
|---|---|---|
| Barnard's Star | 662 | Nov 2018 to Jan 2026 |
| Eps Ind B | 28 | Oct 2019 to Jan 2023 |
| WISE 0855 | 7 | Jan 2020 to Jan 2022 |
| RW Aur | 5 | Aug 2023 to Sep 2025 |
| R Dra | Query timed out | Not checked |

## Sources

- SIMBAD (CfA mirror), Gaia DR3 (ESA TAP), IRSA SIA and TAP, VizieR CfA mirror (GCVS, VSX).
- Rustamkulov et al. 2026 (arXiv 2607.00543). Gagné et al. 2026 (arXiv 2604.22012). Chen et al. 2022 (arXiv 2205.08077). CBET 5530.
