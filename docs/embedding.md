# Linking and embedding

Every view of SPHERExplorer has an address. Put coordinates in the address and the tool opens on that patch of sky. Add `embed=1` and it fits inside another web page.

The address bar follows what is on screen. Copy it, or use "Copy link" under Save and share, and the link reopens the same view: the same image, zoom, brightness, tool, and map.

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

## The whole view

A link made by the tool also carries these. Each is left out while it is at its default, so a plain view keeps a short link. All are optional, and bad values are ignored.

| Name | Values | Meaning |
|---|---|---|
| `view` | `map`, `images`, `both` | Which screen is up. A link with a target opens on `both`, or on the images alone where the window is narrow |
| `tool` | `graphs`, `studies`, `telescopes`, `save`, `about` | The tool tab that is open |
| `t`, `w` | A Modified Julian Date, a wavelength in microns | The image on screen, by its time and wavelength. Not its number in the film, so the link still lands on it after a new data release |
| `zoom`, `x`, `y` | 0.5 to 40, arcseconds | Zoom of the image, and its pan east and north of the field center |
| `curve`, `lo`, `hi` | `linear`, `sqrt`, `log`, `asinh`, two numbers | Brightness curve, black point, and white point |
| `cmap`, `inv`, `smooth` | `gray`, `viridis`, `magma`, `inferno`, `plasma`, `cividis`, then `1` | Color table, inverted, smoothed pixels |
| `marks` | Letters from `mogcf`, or `0` for none | Marks on the image: `m` target, `o` known objects, `g` Gaia stars, `c` found changes, `f` bad pixels. Default `moc` |
| `follow` | `0` or `1` | Hold the sky still, or keep a moving target centered, when images are summed |
| `fps` | 0.5 to 30 | Film speed in steps per second. Default 6 |
| `blink` | `auto`, `wise-w2`, `wise-w1`, `2mass`, `dss` | Blink against that older survey |
| `plot` | Letters from `vpls`, or `0` for none | Spectrum options: `v` compare visits, `p` every measurement, `l` log scale, `s` 2MASS and WISE. Default `vps` |
| `ap` | 4 to 120, or `halo` | Radius of the measuring circle in arcseconds, or the halo measure for a star too bright for the detector |
| `rs` | 0 to 12 | Redshift applied to the feature marks |
| `feat` | Names joined by commas, such as `water,co2` | Feature families marked on the spectrum |
| `spot` | Two numbers joined by a comma | Take the spectrum of this spot instead of the target: arcseconds east and north of the field center |
| `mra`, `mdec`, `mfov` | Degrees | Where the sky map looks and how wide. All three together. Without them the map goes to the target |
| `ov` | Letters from `lsgcdt`, or `0` for none | On the sky map: `l` object labels, `s` solar system, `g` coordinate grid, `c` SPHEREx coverage, `d` deep fields, `t` tile grid. Default `ls` |

- The compact layout takes the ones about the image itself: `t`, `w`, `zoom`, `x`, `y`, `curve`, `lo`, `hi`, `cmap`, `inv`, `smooth`, `marks`, `follow`, and `fps`.
- Not carried: a card that is open, the measure tool's line, and the results of the change finder and the motion measure. Those are one click to make again.

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
