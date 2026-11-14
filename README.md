# SPHERExplorer

A public web tool for exploring NASA SPHEREx images of the sky and how they change over time.

Built by team Turing Complete (Matt and Austin) for the [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/), challenge [Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/).

**Status.** In development during the hackathon (Nov 14 to 15, 2026).

## What it does

Type a name or coordinates. SPHERExplorer finds every SPHEREx image of that spot and plays them like a short film.

- **Search.** Object names, J2000 RA and Dec in any common form, or a planet, asteroid, or comet. A dropdown suggests matches as you type.
- **Watch.** Step through every exposure, one summed image per visit, one per wavelength, or the deepest sum of all.
- **See change.** Follow a moving star or comet, subtract one visit from another, measure how fast a source moves, and track brightness over time.
- **Name what is there.** One list holds every known object in the field. It also tells which asteroids, comets, and planets were in the image on screen at that moment. Follow any of them by name.
- **Find change.** One button checks every source in the field and reports what moved, brightened, or faded between visits. It finds all five of NASA's test targets on its own, including stars too bright for the detector.
- **Use all 102 colors.** Sum any of the six detectors, view full color, and read the spectrum of anything you point at.
- **Identify.** Mark hydrogen, water, carbon dioxide, methane, and more on the spectrum. Slide the redshift for galaxies. The tool also measures which of them actually stand out, and says so in plain words.
- **Compare.** Gaia stars, 2MASS and WISE brightness, and NEOSSat images of the same field.
- **Explore.** A sky map with the SPHEREx all-sky survey in every channel and in full color, other missions, seven map shapes, and clickable labels. Overlays show where SPHEREx has images and where its deep fields are. Drag the selected area anywhere, measure angles, and copy coordinates. The planets, dwarf planets, big asteroids, famous comets, and interstellar visitors sit where they are right now.
- **Share and save.** Every view has a link. Save pictures and animations. Save the science too: FITS files of every image with sky coordinates, flags, and variance, and tables of the spectrum, the brightness over time, and the changes found.
- **Embed.** Put coordinates in the address and add `embed=1` to place the viewer inside any web page. See [docs/embedding.md](docs/embedding.md).

## Try these

| Link | What you see |
|---|---|
| `?target=WISE 0855-0714&mode=visits&det=56` | The coldest known brown dwarf, visible only past 3.9 microns, stepping west between visits |
| `?target=Barnard's Star&mode=visits` | The fastest-moving star in the sky, sliding north |
| `?target=Epsilon Indi B` | A brown dwarf pair. Its spectrum shows water and methane |
| `?target=3I/ATLAS&mode=visits` | An interstellar comet. Its spectrum shows carbon dioxide gas |
| `?target=M 42&fov=1200&mode=deep&color=wide` | The Orion Nebula in full color |
| `?ra=08h55m10.831s&dec=-7d14m42.53s&mode=visits&det=56&play=1&embed=1` | NASA's WISE 0855 coordinates, as a compact viewer for another page |

## How it works

- The API reads SPHEREx Level 2 files straight from NASA's public S3 bucket, a few kilobytes at a time. A 5 arcmin frame travels as about 8 KB, not the 65 MB file.
- Search runs on our own index of all 273,000 exposures, so it answers in milliseconds and keeps working when the archive's search service is busy.
- The browser does the rest: a WebGL viewer, sums, spectra, and plots.

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

## Disclaimer

SPHERExplorer is an independent team project. It is not an official NASA product and is not endorsed by NASA.

## License

[Apache License 2.0](LICENSE). Third-party data and libraries keep their own licenses, listed in [docs/references.md](docs/references.md).
