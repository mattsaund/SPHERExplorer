# Services and libraries

CORS was tested with the header `Origin: https://example.com`.

## CDS outage (check this first)

- CDS Strasbourg declared a cybersecurity incident. SIMBAD, VizieR, Aladin image surveys, and X-Match are degraded. Status page: https://cds.unistra.fr/
- Down at the last check: SIMBAD and VizieR on cds.unistra.fr (404), the Aladin Lite script on aladin.cds.unistra.fr (404), alasky HiPS properties (404).
- Working mirrors that allow browser requests:
  - SIMBAD TAP: https://simbad.cfa.harvard.edu/simbad/sim-tap/sync (data frozen 2026-10-14) and https://simbad.idia.ac.za/simbad/sim-tap/sync
  - VizieR, no TAP: https://vizier.idia.ac.za and https://vizier.cfa.harvard.edu
  - Sesame name resolver: `https://vizier.idia.ac.za/viz-bin/nph-sesame/-oxp/SNV?<name>`, also on the CfA mirror. Returns XML with jradeg, jdedeg, and oname.
  - HiPS: https://skies.esac.esa.int/ (DSSColor, 2MASSColor, AllWISEColor) and https://irsa.ipac.caltech.edu/data/hips/
- CDS posts a fallback Aladin build at https://cds.unistra.fr/aladin_3.9.0-beta.js

## Aladin Lite v3

- npm package `aladin-lite`. Stable 3.8.2 (2026-03-06). The `latest` tag is 3.9.2-beta (2026-09-15), so `npm i aladin-lite` installs a beta.
- License LGPL-3.0-or-later since 3.8.0. The README asks to keep the Aladin logo and link in the view.
- jsDelivr works: `https://cdn.jsdelivr.net/npm/aladin-lite@3.9.2-beta/dist/aladin.js` (one ES module with inlined WASM, about 2.4 to 2.6 MB).
- Needs WebGL2. `A.init` rejects without it.
- Set `log: false`, since the default sends usage to a CDS logger. Pass full HiPS URLs, because survey IDs resolve through the MocServer, which is down.
- TAN-SIP (the SPHEREx sky WCS) only renders in 3.9.0-beta or later.
- FITS: `A.image(url, {imgFormat: 'fits', ...})` or `aladin.displayFITS(...)`. Needs CORS. Reads multiple HDUs and RICE or GZIP tile compression.
  - Every image HDU with a WCS is drawn into one layer, so a raw Level 2 file draws ZODI over IMAGE. Give it a single-HDU FITS. A blob URL should work (unverified).
- PNG or JPEG with a supplied WCS: `A.image(url, {imgFormat: 'png', wcs: {...}})`, SIP terms included.
- Blinking: preload each frame as a named overlay layer and switch opacity. Textures stay on the GPU.
  - Set the same minCut, maxCut, and stretch on every layer. Otherwise each gets its own automatic cuts and the blink flickers.
  - Achievable frame rate is unverified.
- `additive` and `blending` only blend colors. Image arithmetic has to happen in JavaScript.
- `layer.readPixel(x, y)` returns pixel values.
- Stretches: linear, asinh, log, sqrt, pow. Many colormaps (grayscale, viridis, magma, cubehelix, and more).
- Catalogs: `A.catalog({...})` plus `A.source(ra, dec, data)`, with click callbacks and popups. `A.catalogFromURL` parses VOTable. The built-in VizieR, SIMBAD, and SkyBoT loaders call hosts that are down or blocked.
- Overlays: `A.graphicOverlay`, `A.polyline`, `A.circle`, and `A.vector(ra1, dec1, ra2, dec2, {arrow: true})` for proper-motion arrows. MOC through `A.MOCFromURL` and related functions.
- Projections: TAN, STG, SIN (the default, labeled "Spheric"), ZEA, MER, AIT, MOL.
- Events include objectClicked, positionChanged, zoomChanged, click, mouseMove, and projectionChanged. One handler per event name.
- Export: `getViewDataURL` and `getViewData` merge the image and catalog canvases. `getViewWCS()` returns the view's WCS.
- SAMP: `A.aladin(div, {samp: true})` connects to TOPCAT or Aladin Desktop.
- Aladin reads URL query parameters only when given no options object, so an app needs its own permalink scheme.

## Other viewers and FITS readers

| Library | Notes |
|---|---|
| JS9 (MIT) | Archived in 2022 (v3.9). Bundles CFITSIO, so it reads every compression type. Has blink, blend, image arithmetic, and reprojection plugins. Unmaintained. |
| Firefly (IRSA, BSD-style) | Server-side FITS, client-side WCS with SIP. Docker image `ipac/firefly`. Powers the SPHEREx Data Explorer. |
| Pyodide 314.0.7 | astropy 7.2, numpy, and scipy in the browser. No reproject, photutils, or astroquery. |
| fitsjs, fitsjs-ng | RICE compression only. No WCS. |
| @wwtelescope/engine (MIT) | Renders HiPS. |

## Catalog services

| Data | Browser-friendly source | Server-only source |
|---|---|---|
| Gaia DR3 | VizieR IDIA mirror `I/355/gaiadr3`, GAVO TAP `gaia.dr3lite` (https://dc.g-vo.org/tap/sync) | ESA Gaia TAP (https://gea.esac.esa.int/tap-server/tap/sync), MAST |
| AllWISE | VizieR mirrors `II/328/allwise` | IRSA `allwise_p3as_psd` |
| CatWISE2020 | None found working | IRSA `catwise_2020` |
| 2MASS | VizieR `II/246/out`, GAVO `twomass.data` | IRSA `fp_psc` |
| SIMBAD | CfA and IDIA TAP mirrors | CDS (down) |
| Variable stars | VizieR `B/vsx/vsx` | AAVSO VSX API (behind a Cloudflare challenge) |
| Brown dwarfs | UltracoolSheet on Zenodo (CC-BY-4.0, CORS allowed) | |
| Nearby census | Kirkpatrick et al. 2024, VizieR `J/ApJS/271/55` | |

- VizieR URL forms (use a mirror host):
  - Cone search: `/viz-bin/conesearch/I/355/gaiadr3?RA=<ra>&DEC=<dec>&SR=<deg>`
  - VOTable: `/viz-bin/votable?-source=<cat>&-c=<ra> <dec>&-c.rd=<deg>&-out.max=500`
  - TSV: `/viz-bin/asu-tsv?-source=<cat>&-c=...&-out=<columns>&-out.max=500`
  - Always set `-out.max`.
- SIMBAD TAP: GET with `REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=<adql>`. Stay under about 6 queries per second.
- IRSA TAP and cone search (`https://irsa.ipac.caltech.edu/SCS?table=catwise_2020&RA=..&DEC=..&SR=..&format=csv`) send no CORS headers.
- Gaia DR3 positions are at epoch 2016.0. Propagate with proper motion to each frame's epoch.
- Gaia DR4 is reportedly due 2026-12-02 (unverified). NASA's resource tab says to use DR3.
- UltracoolSheet CSV: https://zenodo.org/api/records/15802304/files/UltracoolSheet%20-%20Main.csv/content (6.6 MB, Range works). Zenodo allows 30 requests a minute.

## Solar system and spacecraft

- SkyBoT cone search: https://ssp.imcce.fr/webservices/skybot/api/conesearch.php
  - Parameters: `-ep` (JD, ISO date, or now), `-ra`, `-dec`, `-rd` (degrees, max 10), `-mime` (json, votable, text), `-output`, `-observer` (default 500, geocenter), `-filter`.
  - CORS allowed. Latency about 5.7 s at 0.1 degrees and 16 s at 1 degree.
  - No observer code for SPHEREx. Geocentric positions are off by about 9.7"/(distance in au), so 4 to 7" for main-belt objects.
  - JSON gives sexagesimal RA and Dec plus motion rates in arcsec per hour.
- JPL Horizons API: https://ssd.jpl.nasa.gov/api/horizons.api. SPHEREx is target `-163182`. `CENTER='500@-163182'` gives positions as seen from SPHEREx. No CORS.
- JPL `sbdb.api`, `sbdb_query.api`, and `sb_ident.api` (field identification that accepts an observer state vector). No CORS.
- IRSA MOST supports SPHEREx (`catalog="spherex"`).
- IRSA lists per-exposure positions of comet 3I/ATLAS in SPHEREx images.
- CelesTrak: https://celestrak.org/NORAD/elements/gp.php?CATNR=63182&FORMAT=json
  - Object "SPHEREX (MIDEX 9)", NORAD 63182, COSPAR 2025-047E. CORS allowed.
  - One download per data update per client (about every 2 hours). 50 errors in 2 hours gets the IP blocked. Cache it.
- satellite.js 7.2.0 (MIT, ES modules only): `json2satrec(omm)`, `propagate(satrec, date)`, `eciToGeodetic`.

## WiseView

NASA's resource tab calls it a model: "Feel free to use it as a model or as inspiration!"

- http://byw.tools/wiseview. HTTP only, so an HTTPS page can't embed it. Code is public domain: https://github.com/backyardworlds/wiseview (ASCL 1806.004).
- Inputs: RA and Dec, field of view in arcsec (default 176, max 2000), band W1, W2, or both.
- Controls: coadd window, blink speed, zoom, min and max clip, asinh linearity, invert, maximize dynamic range.
- Modes: separate scan directions (shows parallax), NEOWISE only, first and last epochs only, difference imaging, shift-and-add with a proper-motion guess, injected synthetic movers.
- Overlays and links: Gaia DR3 propagated by proper motion. Links to Legacy Survey, SIMBAD, VizieR, and Pan-STARRS.
- URL hash parameters: ra, dec, size, band, speed, zoom, minbright, maxbright, linear, invert, maxdyr, window, diff_window, diff, scandir, neowise, outer_epochs, unique_window, smooth_scan, shift, pmra, pmdec, border, gaia, synth_a_* and synth_b_*.
- Volunteers value coordinates as the only input, fast tunable blinking, shareable URLs, parallax modes, the Gaia overlay, and one-click cross-checks.

## unWISE and WISE time series

- unwise.me cutouts are full-depth only, with no CORS. The time-resolved coadds are effectively reachable only through WiseView.
- unTimely catalog (W1 and W2, about 16 epochs from 2010 to 2020): Parquet on the S3 bucket `nasa-irsa-wise`, CORS allowed.
- Legacy Survey unWISE cutouts (CORS allowed, full depth only): `https://www.legacysurvey.org/viewer/cutout.fits?ra=<ra>&dec=<dec>&layer=unwise-neo7&pixscale=2.75&size=64&bands=12`
- WISE ended July 31, 2024.

## SAMP

- The Web Profile hub listens at http://localhost:21012/. TOPCAT and Aladin Desktop start one. Use sampjs (CC0) or Aladin's built-in support.
- Chrome 142 and later asks permission for loopback access. Expect a browser prompt and a hub dialog.
- Desktop apps fetch URLs themselves, so send public URLs, not blob URLs (unverified).

## Animation export

| Option | Notes |
|---|---|
| Mediabunny (MPL-2.0) | Uses WebCodecs. Writes MP4 or WebM faster than real time with exact frame timing. |
| gifenc (MIT) | Fast GIF encoding. Use a fixed gray palette for grayscale frames. |
| MediaRecorder | Records in real time only. Capturing one canvas misses Aladin's catalog layer. |
| ffmpeg.wasm | 32 MB core. Multithreading needs cross-origin isolation. |
