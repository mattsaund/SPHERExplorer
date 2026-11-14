# UI checklist

Every tool the app offers, and the engine pieces the UI must use to offer it. A redesign can move, rename, and restyle anything. It must not drop a row.

`scripts/check_ui_coverage.py` reads the third column of these tables and fails when a piece is not used anywhere under `web/src/ui/`. CI runs it on every pull request. When the engine gains a tool, its row is added here in the same commit that adds it to the UI.

The working example of every row is in `web/src/ui/`: `App.tsx` holds the page and its bars, `settings.tsx` the top drawer, and `tools.tsx` the tools in the bottom dock. A new tool usually needs one component and one entry in `TOOLS` in `tools.tsx`. `docs/architecture.md` says which part of the page holds what.

## Start and search

| Tool | The user can | Engine pieces |
|---|---|---|
| Start | Have the app load its settings and open a shared link | `actions.init` |
| Search | Type a name, J2000 coordinates, or a planet, asteroid, or comet | `actions.search` |
| Search suggestions | Pick from a dropdown: recent searches and NASA's targets at first, then matching names and typed coordinates | `actions.suggest`, `suggestions` |
| Test targets | Open any of NASA's five test targets in one click | `TEST_TARGETS`, `actions.goTo` |
| Status | See search and download progress | `targetState`, `framesState`, `loaded`, `failed` |
| Messages | Read notices and errors, and try again | `notice`, `error`, `actions.reload` |
| Fast-mover hint | Be offered a fast-moving object near typed coordinates | `movers`, `actions.studyObject` |

## Image viewer

| Tool | The user can | Engine pieces |
|---|---|---|
| Viewer | See the images, pan, zoom, and click | `FrameView` |
| Playback | Play, pause, step, scrub, and set the speed | `actions.togglePlay`, `actions.step`, `actions.seek`, `actions.setSpeed` |
| What to play | Choose every image, by visit, by wavelength, or the deepest sum | `actions.setMode` |
| Detectors | Switch each of the six detectors on or off | `actions.toggleDetector` |
| Field size | Change how much sky is loaded | `actions.setFieldSize` |
| Full color | Turn on color and choose a recipe | `COLOR_PRESETS`, `color`, `bands` |
| Show only changes | Subtract the first step, the one before, or all others | `actions.setSubtract` |
| Brightness | Pick the curve, black and white points, and auto contrast | `stretch`, `lo`, `hi`, `actions.autoStretch` |
| Look | Pick a color table, invert, and smooth pixels | `COLOR_MAPS`, `invert`, `smooth` |
| Overlays | Show bad pixels, the target marker, known objects, Gaia stars, and found changes | `showFlags`, `showMarker`, `showObjects`, `showGaia`, `showChanges` |
| Follow | Keep a moving target centered in sums | `actions.setFollow` |
| Reset zoom | Return to the whole field | `actions.resetView` |
| Readout | Read position, value, wavelength, and flags under the pointer | `hover` |
| Details | See the target's name, kind, and distance, and open its full database entry | `distance`, `formatDistance`, `url` |
| Per-image facts | See date, detector, wavelength, and brightness of the image on screen | `phot`, `formatFlux` |
| Solar system distances | See a body's distance from Earth and the Sun at each image | `earthDistance`, `sunDistance`, `formatAu` |
| Object card | Open a labeled object's facts, study it, or open its details | `actions.selectObject`, `actions.studyObject` |
| Picked spot | Take the spectrum of a clicked spot, or study it | `actions.probe`, `actions.pick` |
| Known movers | Ask whether a known asteroid, comet, or planet was at a clicked spot when the image was taken, and follow it | `actions.identify`, `known` |

## Measuring

| Tool | The user can | Engine pieces |
|---|---|---|
| Timeline | See every image by date and wavelength, and jump to one | `Timeline` |
| Spectrum | See brightness against wavelength, and jump to an image | `SpectrumPlot` |
| Spectrum options | Compare visits, show every measurement, use a log scale, show 2MASS and WISE | `perVisit`, `showPoints`, `log`, `showSurveys` |
| Measuring shape | Measure a point or a circle of chosen size | `aperture` |
| Halo spectrum | Measure the halo of a star too bright for the detector, and be offered it when needed | `halo`, `spectrumTrust` |
| Features | Mark hydrogen, water, and the other families, and slide the redshift | `LINE_FAMILIES`, `actions.toggleFamily`, `redshift` |
| Feature finder | Read which known features stand out in the spectrum, and mark them on the plot | `spectrumFeatures`, `describeFeature`, `actions.markFound` |
| Change finder | Search the whole field for anything that moved, brightened, or faded, with progress | `actions.findChanges`, `finding`, `changes` |
| Found changes | Read what each source did in plain words, and jump to it | `describeChange`, `actions.showChange` |
| Motion | Measure how fast the source crosses the sky | `actions.measureMotion`, `motion` |
| Brightness over time | See whether the source brightened or faded | `LightCurvePlot` |
| Partner images | See NEOSSat images of the field with their credit line | `partner` |

## Sky map

| Tool | The user can | Engine pieces |
|---|---|---|
| Map | Pan and zoom the whole sky, click labels and empty sky | `SkyMap` |
| Layers | Choose a survey, including SPHEREx in full color | `SKY_LAYERS`, `actions.setMap` |
| SPHEREx channel | Slide through the 102 channels | `channel` |
| Map shape | Choose among the seven projections | `PROJECTIONS` |
| Labels and grid | Switch object labels and the coordinate grid | `labels`, `grid` |
| Go to | Jump to the whole sky or to a place | `actions.flyTo` |
| Object card | See a clicked object's facts, distance, and details link | `selected` |
| Selected area | See the picked area and its size, resize it by dragging, and study it | `picked`, `fieldSize` |

## Telescopes

| Tool | The user can | Engine pieces |
|---|---|---|
| Live map | Watch where SPHEREx and the other telescopes in Earth orbit are right now, and see the observatories on the ground | `OrbitView` |
| Telescope facts | Pick any telescope behind the tool and read what it is, what the tool takes from it, and where it is this second | `telescopes`, `craftNow` |
| Archive status | See how many exposures are public and how new | `spacecraft` |

## Save and share

| Tool | The user can | Engine pieces |
|---|---|---|
| Save picture | Save the image on screen | `actions.saveImage` |
| Save animation | Save the sequence as a GIF, with progress | `actions.saveAnimation`, `exporting` |
| Save spectrum | Save the spectrum table | `actions.saveSpectrum` |
| Share | Copy a link that reopens the view | `actions.shareLink` |
| About and credits | Read who made it, where the data comes from, that it is not a NASA product, and that SI was used | `DATA_CREDIT`, `index` |
| Embed code | Copy HTML that shows the view inside another web page | `actions.embedCode` |
| Embedded view | Get a compact viewer when the address holds `embed=1` | `embed`, `Embed` |
