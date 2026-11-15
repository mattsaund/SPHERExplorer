# SPHERExplorer

A public web tool for exploring NASA SPHEREx images of the sky and how they change over time.

Built by team Turing Complete (Matt and Austin) for the [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/), challenge [Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/).

**Live site.** https://spherexplorer.earth

**Status.** In development during the hackathon (Nov 14 to 15, 2026).

## What it does

SPHERExplorer finds every public SPHEREx image of a sky position, from an object name or coordinates, and plays the images in time order.

- **Search.** Object names, J2000 RA and Dec in any common form, and planets, asteroids, and comets. A dropdown suggests matches as you type.
- **Playback.** Every exposure, one summed image per visit, one per wavelength, or the deepest sum of all images.
- **Change over time.** The tool follows moving stars and comets, subtracts one visit from another, measures source motion, and plots brightness over time.
- **Known objects.** One list holds every known object in the field, including the asteroids, comets, and planets present when the image on screen was taken. Each one can be followed by name.
- **Change detection.** Measure Changes checks every source in the field and reports which sources moved, brightened, or faded between visits. It finds all five of NASA's test targets on its own, including stars too bright for the detector.
- **All 102 bands.** Sums of any of the six detectors for higher signal-to-noise, color images from three wavelength ranges, and the spectrum of any selected position.
- **Spectral features.** Markers for hydrogen, water, carbon dioxide, methane, and other features, with a redshift slider for galaxies. The tool tests which features stand out above the noise and reports them in plain language.
- **Partner data.** Gaia DR3 positions and motions, 2MASS and WISE brightness, and NEOSSat images of the same field.
- **Sky map.** The SPHEREx all-sky survey in every channel and in color, surveys from other missions, seven map projections, and labeled objects. Overlays mark SPHEREx coverage and deep fields. Map tools move the selected area, measure angles, and copy coordinates. Selecting an object loads its images. Planets, dwarf planets, the largest asteroids, well-known comets, and interstellar objects appear at their current positions, with the Sun and the Moon at true size.
- **Share and export.** Every view has a link that reopens it exactly, with the same image, zoom, brightness, tool, and map. Exports include PNG images, GIF animations, and FITS files of every image with sky coordinates, flags, and variance. CSV tables hold the spectrum, the brightness over time, and the detected changes.
- **Embed.** Coordinates in the address plus `embed=1` place a compact viewer inside any web page. See [docs/embedding.md](docs/embedding.md).

## Try these

| Link | What it shows |
|---|---|
| `?target=WISE 0855-0714&mode=visits&det=56` | The coldest known brown dwarf, visible only past 3.9 microns, stepping west between visits |
| `?target=Barnard's Star&mode=visits` | The star with the largest proper motion, moving north |
| `?target=Epsilon Indi B` | A binary brown dwarf. Its spectrum shows water and methane absorption |
| `?target=3I/ATLAS&mode=visits` | An interstellar comet. Its spectrum shows carbon dioxide emission |
| `?target=M 42&fov=1200&mode=deep&color=wide` | The Orion Nebula as a color image from three wavelength ranges |
| `?ra=08h55m10.831s&dec=-7d14m42.53s&mode=visits&det=56&play=1&embed=1` | NASA's WISE 0855 coordinates, as a compact viewer for another page |

## How it works

- The API reads only the rows it needs from each SPHEREx Level 2 file, straight from NASA's public S3 bucket: about 1 MB of a 65 MB file for a 5 arcmin field. The frame then travels to the browser as about 8 KB.
- Search runs on our own index of all 273,000 exposures, so it answers in milliseconds and keeps working when the archive's search service is busy.
- The browser does the rest, with a WebGL2 viewer, sums, spectra, and plots.

More in [docs/architecture.md](docs/architecture.md) and [docs/methods.md](docs/methods.md).

## Run it

```sh
cd server && uv sync && uv run uvicorn spherex_api.main:app --port 8000
cd web && npm install && npm run dev
```

Then open http://localhost:5173. Deployment is in [docs/deploy.md](docs/deploy.md).

## Use of Super Intelligence (SI)

Space Apps 2026 uses the term "Super Intelligence (SI)" for tools such as Claude Code. We use SI tools and label their output.

- **Tool.** Claude Code (Anthropic), with Claude Opus 5.5 and Claude Fable 5.2.
- **What it does.** Background research on SPHEREx data and services, code generation, documentation, and testing.
- **What it doesn't do.** The project idea and features come from the team. See [docs/concept.md](docs/concept.md) and [docs/decisions.md](docs/decisions.md).
- **How it's labeled.** Commits written with Claude carry a `Co-Authored-By` trailer. Source files written with Claude carry a header comment. SI-generated images or video carry a visible watermark. Details in [docs/si-usage.md](docs/si-usage.md).

## Data and credits

This project uses data from NASA's SPHEREx mission, served by the NASA/IPAC Infrared Science Archive (IRSA).

> This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration.

> This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.

Other data: Gaia DR3 (ESA, through MAST), 2MASS and AllWISE (through VizieR), SIMBAD (CDS), JPL Horizons and the Small-Body Database, NEOSSat (Canadian Space Agency, through CADC), CelesTrak, and sky survey tiles served by IRSA. The sky map is Aladin Lite (CDS).

SPHEREx DOIs: DR1 Spectral Images [10.26131/IRSA678](https://doi.org/10.26131/IRSA678), Spectral All-Sky Cube [10.26131/IRSA679](https://doi.org/10.26131/IRSA679), QR3 Spectral Images [10.26131/IRSA662](https://doi.org/10.26131/IRSA662).

Every other source, library, and license is listed in [docs/references.md](docs/references.md).

## License

[Apache License 2.0](LICENSE). Third-party data and libraries keep their own licenses, listed in [docs/references.md](docs/references.md).
