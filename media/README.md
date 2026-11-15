# Media

What the team shows people, and the code that makes the video.

| Folder | What it holds |
|---|---|
| `videos/` | The demo video, `spherexplorer-demo.mp4`, 29 seconds. It is SI-generated: built by `code/` from real captures of the live site, with a visible SI watermark on every frame and an SI statement in its metadata |
| `slides/` | The backup slide deck, `spherexplorer-slides.pdf`: seven slides with real screenshots of the live site, drafted with Claude Code, which each slide's footer says. `speaker-notes.md` holds about 30 seconds of notes a slide |
| `pictures/` | Pictures of the project, listed below |
| `code/` | The code that makes the video. `capture.mjs` takes the captures from the live site, `scenes.js` lays out any moment of the video, and `render.mjs` renders every frame and encodes the file. Its captures, frames, and installed packages stay out of the repo |

## The pictures

Each one is the live site as it was on Nov 15, 2026. Claude Code took them with a headless browser. None is SI-generated imagery: every pixel of sky is NASA SPHEREx data, drawn by the tool.

| File | What it shows | How it was made |
|---|---|---|
| `orion-nebula-color.png` | The Orion Nebula, M 42, as one color picture from three wavelength ranges, the sum of 373 images | The tool's own Save picture button |
| `wise-0855-by-visit.gif` | The brown dwarf WISE 0855 stepping west across three visits | The tool's own Save animation button |
| `app-barnards-star.png` | The whole page with Barnard's Star open: the sky map and the image study | A screenshot of the page |
| `epsilon-indi-b-spectrum.png` | The spectrum of Epsilon Indi B, with water and methane marked | A screenshot of the page |

To make the video again:

```sh
cd media/code
npm install
node capture.mjs
node render.mjs
```

The plan for the video, its on-screen text, and the upload steps are in `docs/submission/video.md`.
