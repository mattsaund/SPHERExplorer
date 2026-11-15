# Media

What the team shows people, and the code that makes the video.

| Folder | What it holds |
|---|---|
| `videos/` | The demo video, `spherexplorer-demo.mp4`, 29 seconds. It is also on YouTube at https://www.youtube.com/watch?v=EtcNxZPPJSA. It is SI-generated: built by `code/` from real captures of the live site, with a visible SI watermark on every frame and an SI statement in its metadata |
| `slides/` | Two slide decks, listed below |
| `pictures/` | Pictures and animations of the project, listed below |
| `data/` | A table saved from the tool, listed below |
| `code/` | The code that makes the video. `capture.mjs` takes the captures from the live site, `scenes.js` lays out any moment of the video, and `render.mjs` renders every frame and encodes the file. Its captures, frames, and installed packages stay out of the repo |

## The slides

Both decks were drafted with Claude Code, an SI tool, and each slide's footer says so. Neither shows any NASA insignia or logo, and each ends with the note that the project is not endorsed by NASA.

| File | What it is |
|---|---|
| `spherexplorer-live-presentation.pdf` | The deck for the 5-minute live presentation at our Local Event on Nov 15, 2026. Six slides: the title, the challenge, the six stops of the live demo, how it works, who it is for, and the close. Its slides are numbered 1 to 7, and number 5 is not in the file |
| `spherexplorer-slides.pdf` | The backup deck for the demo: seven slides with real screenshots of the live site |

## The pictures

Each one is the live site as it was on Nov 15, 2026. None is SI-generated imagery: every pixel of sky is NASA SPHEREx data, drawn by the tool. Claude Code took the first four with a headless browser. Matt saved the two large animations in his own browser, and they keep the file names the tool gave them.

| File | What it shows | How it was made |
|---|---|---|
| `orion-nebula-color.png` | The Orion Nebula, M 42, as one color picture from three wavelength ranges, the sum of 373 images | The tool's own Save picture button |
| `wise-0855-by-visit.gif` | The brown dwarf WISE 0855 stepping west across three visits | The tool's own Save animation button |
| `app-barnards-star.png` | The whole page with Barnard's Star open: the sky map and the image study | A screenshot of the page |
| `epsilon-indi-b-spectrum.png` | The spectrum of Epsilon Indi B, with water and methane marked | A screenshot of the page |
| `spherexplorer_136108_Haumea_2003_EL61_exposures.gif` | The dwarf planet Haumea, followed through 55 images from Jun 23, 2025 to Jul 25, 2026. Haumea stays under the cross while the stars behind it change. 32 MB | The tool's own Save animation button |
| `spherexplorer_10.6851_41.2555_exposures.gif` | The core of the Andromeda Galaxy, M 31, in 102 images from Jul 9, 2025 to Jul 14, 2026, with the objects in the field labeled. 26 MB | The tool's own Save animation button |

## The data

| File | What it holds | How it was made |
|---|---|---|
| `spherexplorer_R_Draconis_brightness.csv` | The brightness of the variable star R Draconis over time: 2,321 measurements in 16 visits, from Apr 24, 2025 to Sep 25, 2026. Each row has the time, the visit, the detector, the wavelength, the brightness against the star's usual brightness at that wavelength with its error, and the SPHEREx file it came from | Matt, on Nov 15, 2026, with the tool's own Save brightness table button |

To make the video again:

```sh
cd media/code
npm install
node capture.mjs
node render.mjs
```

The plan for the video, its on-screen text, and the upload steps are in `docs/submission/video.md`.
