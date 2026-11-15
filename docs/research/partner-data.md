# Partner data and other resources from the challenge page

A snapshot from November 2026. Recheck anything time-sensitive against the live services.

## CSA NEOSSat (Space Agency Partner data)

- Canada's Near-Earth Object Surveillance Satellite. Launched Feb 25, 2013, into an orbit about 780 km up with a 100-minute period.
- Pointed observations of asteroids, comets, satellites, debris, and astronomical targets. Not an all-sky survey.
- Images are 1024 x 1024 FITS, per the CSA tutorial. Processed versions end in `_cor` (overscan corrected), `_cord` (dark corrected), or `_clean`. Pointing modes appear in `instrument_keywords`, for example `16-FINE_POINT`.
- License: Open Government Licence - Canada. Credit line in `docs/references.md`.
- FITS user guide: https://donnees-data.asc-csa.gc.ca/users/OpenData_DonneesOuvertes/pub/NEOSSAT/Supporting%20Documents/CSA-NEOSSAT-MAN-0002_FITS_IMAGE_UGUIDE-v4-00.pdf

### Access

- CSA archive over HTTPS, folders 2017 to 2026: https://data.asc-csa.gc.ca/users/OpenData_DonneesOuvertes/pub/NEOSSAT/ASTRO/ . Also FTP at ftp.asc-csa.gc.ca. Files are named `NEOS_SCI_<YYYY><DOY><HHMMSS>.fits`.
- CADC collection `NEOSSAT`:
  - Python: `astroquery.cadc.Cadc().query_region(coords, radius, collection='NEOSSAT')`
  - TAP: https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/argus/sync with tables `caom2.Observation` and `caom2.Plane`
- Neither source sends CORS headers.

### CSA tutorial

- https://github.com/asc-csa/NEOSSAT_Tutorial (MIT, Crown copyright 2023).
- Notebook 1 downloads and plots data from the CSA archive and CADC.
- Notebook 2 does overscan and dark correction, median stacking, streak detection, frame differencing for moving objects, and GIF animation.

### Coverage near the test targets

Images within 0.5 degrees, from CADC TAP.

| Target | Images | Dates | After SPHEREx began (May 2025) |
|---|---|---|---|
| Barnard's Star | 662 | Nov 2018 to Jan 2026 | 1 |
| Eps Ind B | 28 | Oct 2019 to Jan 2023 | 0 |
| WISE 0855 | 7 | Jan 2020 to Jan 2022 | 0 |
| RW Aur | 5 | Aug 2023 to Sep 2025 | 3 |
| R Dra | Query timed out | Not checked | Not checked |

## CADC

- Canadian Astronomy Data Centre: https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/
- NEOSSat page: https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/neossat/

## Gaia DR3 at MAST (NASA resource)

- https://archive.stsci.edu/missions-and-data/gaia. The resource tab says "Be sure to use the latest data release (Data Release 3)."
- Access: MAST Portal, astroquery.mast Catalogs, CasJobs, and VO services.
- The MAST API works. Request `https://mast.stsci.edu/api/v0/invoke?request=<url-encoded JSON>` with service `Mast.Catalogs.GaiaDR3.Cone` and params ra, dec, radius, and format json. It sends no CORS header, so it is server-side only.
- Gaia DR3 positions are at epoch 2016.0.
