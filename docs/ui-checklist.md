# UI checklist

Every tool the app offers, and the engine pieces the UI must use to offer it. A redesign can move, rename, and restyle anything. It must not drop a row.

`scripts/check_ui_coverage.py` reads the third column of these tables and fails when a piece is not used anywhere under `web/src/ui/`. CI runs it on every pull request. When the engine gains a tool, its row is added here in the same commit that adds it to the UI.

The working example of every row is the starter UI in `web/src/ui/App.tsx`.

## Start and search

| Tool | The user can | Engine pieces |
|---|---|---|
| Start | Have the app load its settings and open a shared link | `actions.init` |
| Search | Type a name, J2000 coordinates, or a planet, asteroid, or comet | `actions.search` |
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
| Overlays | Show bad pixels, the target marker, known objects, and Gaia stars | `showFlags`, `showMarker`, `showObjects`, `showGaia` |
| Follow | Keep a moving target centered in sums | `actions.setFollow` |
| Reset zoom | Return to the whole field | `actions.resetView` |
| Readout | Read position, value, wavelength, and flags under the pointer | `hover` |
| Details | See the target's name, kind, and distance, and open its full database entry | `distance`, `formatDistance`, `url` |
| Per-image facts | See date, detector, wavelength, and brightness of the image on screen | `phot`, `formatFlux` |
| Solar system distances | See a body's distance from Earth and the Sun at each image | `earthDistance`, `sunDistance`, `formatAu` |
| Object card | Open a labeled object's facts, study it, or open its details | `actions.selectObject`, `actions.studyObject` |
| Picked spot | Take the spectrum of a clicked spot, or study it | `actions.probe`, `actions.pick` |

## Measuring

| Tool | The user can | Engine pieces |
|---|---|---|
| Timeline | See every image by date and wavelength, and jump to one | `Timeline` |
| Spectrum | See brightness against wavelength, and jump to an image | `SpectrumPlot` |
| Spectrum options | Compare visits, show every measurement, use a log scale, show 2MASS and WISE | `perVisit`, `showPoints`, `log`, `showSurveys` |
| Measuring shape | Measure a point or a circle of chosen size | `aperture` |
| Features | Mark hydrogen, water, and the other families, and slide the redshift | `LINE_FAMILIES`, `actions.toggleFamily`, `redshift` |
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

## Spacecraft

| Tool | The user can | Engine pieces |
|---|---|---|
| Orbit | Watch where SPHEREx is right now | `OrbitView` |
| Live numbers | Read latitude, longitude, height, speed, and sunlight | `spacecraftNow` |
| Archive status | See how many exposures are public and how new | `spacecraft` |

## Save and share

| Tool | The user can | Engine pieces |
|---|---|---|
| Save picture | Save the image on screen | `actions.saveImage` |
| Save animation | Save the sequence as a GIF, with progress | `actions.saveAnimation`, `exporting` |
| Save spectrum | Save the spectrum table | `actions.saveSpectrum` |
| Share | Copy a link that reopens the view | `actions.shareLink` |
