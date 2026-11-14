# SPHERExplorer

A public web tool for exploring NASA SPHEREx images of the sky and how they change over time.

Built by Matt and Austin for the [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/), challenge [Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/).

**Status.** In development during the hackathon (Nov 14 to 15, 2026).

## Use of Super Intelligence (SI)

Space Apps calls AI tools "Super Intelligence (SI)". We use them and label their output.

- **Tool.** Claude Code (Anthropic), with Claude Opus 5.5 and Claude Fable 5.2.
- **What it does.** Background research on SPHEREx data and services, code generation, documentation, and testing.
- **What it doesn't do.** The project idea and features come from the team. See [docs/concept.md](docs/concept.md) and [docs/decisions.md](docs/decisions.md).
- **How it's labeled.** Commits written with Claude carry a `Co-Authored-By` trailer. Source files written with Claude carry a header comment. SI-generated images or video carry a visible watermark. Details in [docs/si-usage.md](docs/si-usage.md).

## Data and credits

This project uses data from NASA's SPHEREx mission, served by the NASA/IPAC Infrared Science Archive (IRSA).

> This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration.

> This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.

SPHEREx DOIs: DR1 Spectral Images [10.26131/IRSA678](https://doi.org/10.26131/IRSA678), Spectral All-Sky Cube [10.26131/IRSA679](https://doi.org/10.26131/IRSA679), QR3 Spectral Images [10.26131/IRSA662](https://doi.org/10.26131/IRSA662).

Every other source, library, and license is listed in [docs/references.md](docs/references.md).

## Disclaimer

SPHERExplorer is an independent team project. It is not an official NASA product and is not endorsed by NASA.

## License

[Apache License 2.0](LICENSE). Third-party data and libraries keep their own licenses, listed in [docs/references.md](docs/references.md).
