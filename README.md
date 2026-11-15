# SPHERExplorer

A public web tool for exploring NASA SPHEREx images of the sky and how they change over time.

Built by team Turing Complete (Matt and Austin) for the [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/), challenge [Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/).

**Live site.** https://spherexplorer.earth

**Status.** Built during the NASA Space Apps Challenge, Nov 14 to 15, 2026. The live site stays up through judging, which ends Jan 26, 2027.

## What it does

SPHERExplorer finds every public SPHEREx image of a sky position, from an object name or coordinates, and plays the images in time order.

- **Search.** Object names, J2000 RA and Dec in any common form, and planets, asteroids, and comets. A dropdown suggests matches as you type.
- **Playback.** Every exposure, one summed image per visit, one per wavelength, or the deepest sum of all images.
- **Change over time.** The tool follows moving stars and comets, subtracts one visit from another, measures source motion, and plots brightness over time.
- **Known objects.** One list holds the best-known objects in the field, including the asteroids, comets, and planets present when the image on screen was taken. Each one can be followed by name.
- **Change detection.** Measure Changes checks every source in the field and reports which sources moved, brightened, or faded between visits. It flags all five of NASA's test targets, including stars too bright for the detector. WISE 0855 needs detectors 5 and 6 selected, the only ones that see it.
- **All 102 bands.** Sums of any of the six detectors for higher signal-to-noise, color images from three wavelength ranges, and the spectrum of any selected position.
- **Spectral features.** Markers for hydrogen, water, carbon dioxide, methane, and other features, with a redshift slider for galaxies. The tool tests which features stand out above the noise and reports them in plain language.
- **Partner data.** Gaia DR3 positions and motions, 2MASS and WISE brightness, and NEOSSat images of the same field where NEOSSat has observed it.
- **Sky map.** The SPHEREx all-sky survey channel by channel and in color, surveys from other missions, seven map projections, and labeled objects. Overlays mark SPHEREx coverage and deep fields. Map tools move the selected area, measure angles, and copy coordinates. Selecting an object loads its images. Planets, dwarf planets, the largest asteroids, well-known comets, and interstellar objects appear at their current positions, with the Sun and the Moon at true size.
- **Share and export.** Every view has a link that reopens it exactly, with the same image, zoom, brightness, tool, and map. Exports include PNG images, GIF animations, and FITS files of every image with sky coordinates, flags, and variance. CSV tables hold the spectrum, the brightness over time, and the detected changes.
- **Embed.** Coordinates in the address plus `embed=1` place a compact viewer inside any web page. See [docs/embedding.md](docs/embedding.md).

## Try these

Each link opens the live site on that view.

| Example | What it shows |
|---|---|
| [WISE 0855-0714, by visit](https://spherexplorer.earth/?target=WISE%200855-0714&mode=visits&det=56) | The coldest known brown dwarf, visible only past 3.9 microns, stepping west between visits |
| [Barnard's Star, by visit](https://spherexplorer.earth/?target=Barnard%27s%20Star&mode=visits) | The star with the largest proper motion, moving north |
| [Epsilon Indi B](https://spherexplorer.earth/?target=Epsilon%20Indi%20B) | A binary brown dwarf. Its spectrum shows water and methane absorption |
| [3I/ATLAS, by visit](https://spherexplorer.earth/?target=3I/ATLAS&mode=visits) | An interstellar comet. Its spectrum shows carbon dioxide emission |
| [The Orion Nebula in color](https://spherexplorer.earth/?target=M%2042&fov=1200&mode=deep&color=wide) | The Orion Nebula as a color image from three wavelength ranges |
| [WISE 0855, embedded](https://spherexplorer.earth/?ra=08h55m10.831s&dec=-7d14m42.53s&mode=visits&det=56&play=1&embed=1) | NASA's WISE 0855 coordinates, as the compact viewer another page would show |

## How it works

- The API reads only the rows it needs from each SPHEREx Level 2 file, straight from NASA's public S3 bucket: about 1 MB of a 65 MB file for a 5 arcmin field. The frame then travels to the browser as about 8 KB.
- Search runs on our own index of all 273,000 exposures, so it answers in a fraction of a second and keeps working when the archive's search service is busy.
- The browser does the rest, with a WebGL2 viewer, sums, spectra, and plots.

More in [docs/architecture.md](docs/architecture.md) and [docs/methods.md](docs/methods.md). The terms are explained in [docs/glossary.md](docs/glossary.md).

## Run it locally

You need Python 3.12 or newer with [uv](https://docs.astral.sh/uv/), and Node.js 22 with npm. uv can install the right Python for you.

Start the API and the web app in two terminals, each from the repository root.

```sh
# Terminal 1: the API on port 8000. The first start downloads the exposure index (12 MB).
cd server
uv sync
uv run uvicorn spherex_api.main:app --reload --port 8000
```

```sh
# Terminal 2: the web app on port 5173. It forwards /api requests to port 8000.
cd web
npm install
npm run dev
```

Then open http://localhost:5173. `scripts/check_all.sh` runs the same checks as CI. Deployment is covered in [docs/deploy.md](docs/deploy.md). The team's rules, and why the repo is closed to contributions during judging, are in [CONTRIBUTING.md](CONTRIBUTING.md).

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

## Disclaimer

SPHERExplorer is an independent team project. It is not an official NASA product and is not endorsed by NASA.

## License

[Apache License 2.0](LICENSE). Third-party data and libraries keep their own licenses, listed in [docs/references.md](docs/references.md).
