# Linking and embedding

Every view of SPHERExplorer has an address. Put coordinates in the address and the tool opens on that patch of sky. Add `embed=1` and it fits inside another web page.

`<site>` below stands for the address of the live site.

## Link to a place

```
<site>/?ra=133.795129&dec=-7.245147
<site>/?ra=08h55m10.831s&dec=-7d14m42.53s
<site>/?target=Barnard's Star
```

- `ra` and `dec` are J2000 (ICRS). Plain numbers are degrees. Any form the search box reads also works, such as `08h55m10.8s`, `08:55:10.8`, or `-07d14m42s`.
- `target` is anything the search box accepts: an object name, coordinates, or a planet, asteroid, or comet.
- Give `target`, or `ra` and `dec`. If both are present, `target` wins.

## Options

All optional. Bad or unknown values are ignored.

| Name | Values | Meaning |
|---|---|---|
| `fov` | 60 to 3600 | Width of the field in arcseconds. Default 300 |
| `mode` | `exposures`, `visits`, `channels`, `deep` | What to play: every image, one sum per visit, one sum per wavelength, or the deepest sum |
| `det` | digits 1 to 6, for example `56` | Detectors switched on. Default all six |
| `color` | `wide`, `short`, `long`, `ice` | Full color with that recipe: full range, starlight, cool objects, or water ice |
| `sub` | `first`, `previous`, `others` | Show only changes, by subtracting that reference |
| `play` | `1` | Start playing as soon as the images arrive |
| `layer` | `spherex`, `spherex-color`, `wise`, `2mass`, and others | Sky map layer |
| `ch` | 0 to 101 | SPHEREx channel shown on the sky map |
| `proj` | `AIT`, `SIN`, `MOL`, `MER`, `ZEA`, `STG`, `TAN` | Sky map shape |
| `embed` | `1` | Compact layout for a frame inside another page |

## Embed the viewer

```html
<iframe src="<site>/?ra=133.795129&dec=-7.245147&mode=visits&det=56&play=1&embed=1"
        width="640" height="560" style="border:0;max-width:100%"
        loading="lazy" allowfullscreen title="SPHEREx images of WISE 0855-0714"></iframe>
```

- In the tool, "Copy embed code" writes this snippet for the view on screen.
- The compact layout shows the images, playback controls, what to play, and the data credit. "Open in SPHERExplorer" opens the same view in the whole tool.
- It works at any size from about 320 by 300 pixels up. The image scales to the frame.
- The site sends no header that blocks framing, and it uses no cookies.
- An embedded viewer skips the survey and partner image requests, so it loads less than the whole tool.

## Use the data API from another project

The API under `<site>/api/` allows requests from any site. `<site>/api/docs` lists every route.

| Route | Returns |
|---|---|
| `/api/search?ra=133.795&dec=-7.245` | Every SPHEREx exposure that covers the position |
| `/api/resolve?name=Barnard's Star` | The position, motion, and distance for a name |
| `/api/objects?ra=133.795&dec=-7.245&radius=0.1` | Known objects around the position, from SIMBAD |

Please credit SPHEREx and IRSA when you show the images. The wording is in `docs/references.md`.
