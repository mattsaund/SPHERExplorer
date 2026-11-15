# UI checklist

Every tool the app offers, and the engine pieces the UI must use to offer it. A redesign can move, rename, and restyle anything. It must not drop a row.

`scripts/check_ui_coverage.py` reads the third column of these tables and fails when a piece is not used anywhere under `web/src/ui/`. CI runs it on every pull request. When the engine gains a tool, its row is added here in the same commit that adds it to the UI.

The working example of every row is in `web/src/ui/`: `App.tsx` holds the page and its bars, `settings.tsx` the settings drawer, `cards.tsx` the cards laid over the map and the images, and `tools.tsx` the tools in the bottom dock. A new tool usually needs one component and one entry in `TOOLS` in `tools.tsx`. `docs/architecture.md` says which part of the page holds what.

## Start and search

| Tool | The user can | Engine pieces |
|---|---|---|
| Start | Have the app load its settings and open a shared link | `actions.init` |
| Search | Type a name, J2000 coordinates, or a planet, asteroid, or comet | `actions.search` |
| Tour | Walk through the page step by step with a real example (Barnard's Star), on a first visit or from Help | `TEST_TARGETS`, `actions.goTo` |
| Search suggestions | Pick from a dropdown: recent searches and NASA's targets at first, then matching names and typed coordinates | `actions.suggest`, `suggestions` |
| Test targets | Open any of NASA's five test targets in one click | `TEST_TARGETS`, `actions.goTo` |
| Status | See search and download progress as a count and a ring, whether a very large field was sampled, and when a large sum is being added up for the picture | `targetState`, `framesState`, `loaded`, `failed`, `leftOut`, `summing` |
| Messages | Read notices and errors, and try again | `notice`, `error`, `actions.reload` |
| Fast movers | See a fast-moving object near typed coordinates first in the objects list, and follow it | `movers`, `actions.studyObject` |

## Image viewer

| Tool | The user can | Engine pieces |
|---|---|---|
| Viewer | See the images, pan, zoom, and click | `FrameView` |
| Playback | Play, pause, step, scrub, and set the speed, in a bar that is on the page while the images are | `actions.togglePlay`, `actions.step`, `actions.seek`, `actions.setSpeed` |
| What to play | Choose every image, by visit, by wavelength, or the deepest sum | `actions.setMode` |
| Detectors | Switch each of the six detectors on or off | `actions.toggleDetector` |
| Field size | Change how much sky is loaded. The film comes back to the image that was on screen | `actions.setFieldSize` |
| Full color | Turn on color and choose a recipe | `COLOR_PRESETS`, `color`, `bands` |
| Show only changes | Subtract the first step, the one before, or all others | `actions.setSubtract` |
| Brightness | Pick the curve, black and white points, and auto contrast | `stretch`, `lo`, `hi`, `actions.autoStretch` |
| Look | Pick a color table, invert, and smooth pixels | `COLOR_MAPS`, `invert`, `smooth` |
| Overlays | Show bad pixels, the target marker, known objects, Gaia stars, and found changes | `showFlags`, `showMarker`, `showObjects`, `showGaia`, `showChanges` |
| Follow | Keep a moving target centered in sums | `actions.setFollow` |
| Blink | Swap the image with an older survey's picture of the same field, back and forth, to see what moved in the years between | `actions.setBlink`, `blink`, `BLINK_PARTNERS`, `blinkPartner` |
| Reset zoom | Return to the whole field | `actions.resetView` |
| Readout | Read position, value, wavelength, and flags under the pointer | `hover` |
| Details | See the target's name, kind, and distance, and open its full database entry | `distance`, `formatDistance`, `url` |
| Per-image facts | See date, detector, wavelength, and brightness of the image on screen | `phot`, `formatFlux` |
| Solar system distances | See a body's distance from Earth and the Sun at each image | `earthDistance`, `sunDistance`, `formatAu` |
| Objects list | See every object in the field in one card, hide them all or open one for its facts, take their marks off the image, study one, or open its details | `fieldObjects`, `actions.selectObject`, `selectedIn`, `actions.studyObject` |
| Picked spot | Take the spectrum of a clicked spot, study it, or copy its coordinates | `actions.probe`, `actions.pick`, `pickedIn` |
| Known bodies | Ask which known asteroids, comets, and planets were in the field when the image on screen was taken, and follow one | `actions.identify`, `known` |

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
| Object card | Click an object's label to load its images at once, with the view box around it, and see its facts, distance, and details link. A planet, asteroid, or comet loads at once too, and the map goes to its first image. The Sun and the Moon only show their card | `selected`, `isStudied` |
| Selected area | Click the map to select an area and load its images, see its size, move it by dragging inside it, resize it by dragging its edge, copy its coordinates, and close the study. Every study has the square, with the target's name on it: a searched object too, and a planet or comet, whose square is where the image on screen was taken. When a larger area is chosen on a zoomed-in map, the map zooms out so the whole square stays in sight | `picked`, `fieldSize`, `fieldShown`, `actions.closeStudy`, `fieldCenter`, `fieldDate` |
| Coordinates | Read the coordinates under the pointer and at the center of the map, and copy the center | `mapHover`, `center` |
| Coverage | Show where SPHEREx spectral images exist, and where the deep fields are | `coverage`, `deepFields` |
| Tile grid | Show the HEALPix tiles that all-sky maps are cut into | `tiles` |
| Solar system | See the Sun, the Moon, the planets, dwarf planets, large asteroids, and well-known comets where they are right now, open one for its facts, and study it in SPHEREx. The Sun and the Moon are drawn at their true size, the Moon with its lit share | `solar`, `formatAu`, `lit` |
| Measure | Drag on the map to measure the angle between two points | `measuring`, `measured`, `formatAngle` |

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
| Save FITS | Save the image on screen as a FITS file with sky coordinates: the archive's own pixels, flags, and variance for one exposure, or the sum | `actions.saveFits` |
| Save all FITS | Save every loaded image as FITS files in one zip, with progress | `actions.saveAllFits`, `packing` |
| Save tables | Save the brightness over time, and what the change finder found, as CSV tables | `actions.saveLightCurve`, `actions.saveChanges` |
| Share | Copy a link that reopens the whole view: the screen, the open tool, the image on screen with its zoom and brightness, the spectrum settings, and where the map looks. The address bar follows the view too | `actions.shareLink`, `actions.setLayout`, `layout` |
| About and credits | Read who made it, where the data comes from, that it is not a NASA product, and that SI was used | `DATA_CREDIT`, `index` |
| Embed code | Copy HTML that shows the view inside another web page | `actions.embedCode` |
| Embedded view | Get a compact viewer when the address holds `embed=1` | `embed`, `Embed` |
