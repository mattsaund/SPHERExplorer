# Live presentation

Sunday, Nov 15, 3:30 pm Eastern, at our Local Event in Bethesda. Five minutes at most for each team. Aim for 4 minutes 30 seconds.

The talking points were drafted with Claude Code (Anthropic), an SI tool, at Matt's request on Nov 15. They follow his direction for the video: science, not a sales pitch, in the proper terms, and short. Every number in them was measured on the live site that day. Matt and Austin choose the words they say.

The demo video and the backup slides have their own plan in `docs/submission/video.md`.

## Run of show

| Time | Part | On screen |
|---|---|---|
| 0:00 to 0:30 | Who we are, and the challenge | The 29-second video. It is silent, so talk over it |
| 0:30 to 3:00 | Live demo, six stops | The live site |
| 3:00 to 3:45 | How it works, the data, and the checks | The spectrum of Epsilon Indi B, or the About tab |
| 3:45 to 4:30 | Who it is for, and what comes next | The sky map |
| 4:30 to 5:00 | Thanks, and the address | https://spherexplorer.earth |

## Talking points

### 1. Open, 0:00 to 0:30

- We are Matthew Saunders and Austin Laubach, team Turing Complete.
- We chose Planet X and SPHEREx for our challenge. The challenge was to create a public facing tool to interact with and review SPHEREx images.
- The tool was to show SPHEREx images of one sky position as a sequence, allowing a user to map object movement.
- SPHEREx maps the whole sky in 102 infrared bands, from 0.75 to 5 µm, and it returns to each position many times.
- The hard part is that every exposure is a separate 65 MB file, and each one lands at a different wavelength.
- Why we chose this challenge. One sentence, in your own words.

### 2. Live demo, 0:30 to 3:00

Six stops, about 25 seconds each. The links are in "The eight demo objects" below. Open them in tabs, in this order, before going on.

| Stop | Object | Do | Say |
|---|---|---|---|
| 1 | WISE 0855 | Step with the right arrow. Then open Studies and press Measure Changes, and keep talking while it runs | One of NASA's five test targets. The coldest known brown dwarf, 2.3 parsecs away. It is detected only above about 3.9 µm, so detectors 5 and 6 are selected. It steps west between visits while the field stars hold still. Measure Changes checks every source in the field and flags this one. It moved 2.8 arcsec west, at 6.0 ± 0.9 arcsec a year. The catalog value is 8.2. The source is faint, so the measure is rough, and the direction is right |
| 2 | Haumea | Press Play, or the space bar | A dwarf planet beyond Neptune. Its position at each exposure comes from JPL Horizons. The yellow square follows it on the map, and the image study keeps it under its marker through a year of images |
| 3 | Epsilon Indi B | The link opens Graphs with the spectrum | Every exposure is at a different wavelength, so the same images give a spectrum. This brown dwarf shows water and methane absorption between 0.75 and 5 µm, and the tool marks both |
| 4 | Barnard's Star | The link opens Blink against WISE | Blink swaps the SPHEREx image with the WISE image of 2010. The star has moved more than 2.5 arcminutes. From SPHEREx alone, Measure Changes gives 11.1 ± 1.4 arcsec a year. The catalog value is 10.4 |
| 5 | Pillars of Creation | Let the color image load, then zoom in | The Eagle Nebula, M 16. This is the deepest sum in three wavelength ranges, shown as color. Find takes a common name, a catalog name, or RA and Dec |
| 6 | Jupiter and its moons | Step with the arrows | Jupiter with its four large moons as points beside it. They change places from image to image |

- Short on time: drop stops from the bottom. Stops 1 to 4 answer the challenge directly.
- Spares, if a stop fails or time is left: 3I/ATLAS (an interstellar comet, followed on its JPL Horizons path) and the Orion Nebula (three wavelength ranges as color).
- The moons of Jupiter have no names in the tool. Find does not know them, so open Jupiter and point at them.

### 3. How it works, the data, and the checks, 3:00 to 3:45

- The server reads only the rows it needs from each file, about 1 MB of 65 MB. The browser gets about 8 KB per image.
- Our own index holds all 273,367 public exposures and answers a search in about a tenth of a second. It is rebuilt twice a week, with no code change.
- Stars are moved to each exposure's date by their proper motion. Planets, asteroids, and comets follow JPL Horizons.
- Brightness comes from a point spread function fit in every frame.
- The data: SPHEREx from NASA's IRSA archive, Gaia DR3 from the European Space Agency, NEOSSat from the Canadian Space Agency, and WISE and 2MASS to compare across decades.
- The checks: Measure Changes flags all five of NASA's test targets, WISE 0855 with detectors 5 and 6. Barnard's Star comes out at 11.1 arcsec a year against a catalog 10.4, and Epsilon Indi B at 4.6 against 4.7. RW Aurigae brightened 55 percent in the infrared. R Draconis, which pulsates with a 245-day period, was 50 percent fainter in June 2026.

### 4. Who it is for, and what comes next, 3:45 to 4:30

- SPHEREx data is public but hard to use. The tool runs in a browser, with no download and no account.
- Researchers get FITS files with flags and variance. Students get plain words and a guided tour.
- Every view has a link that carries its coordinates, and it can be embedded in another page.
- New SPHEREx exposures are indexed twice a week, and the code is open source under Apache-2.0.
- What you want it to become. One or two sentences, in your own words. Matt's concept note says it best: "I want this program to be used for all types of space science and research."

### 5. Close, 4:30 to 5:00

- The address is spherexplorer.earth. The code is on GitHub under Apache-2.0.
- It is an independent project. It is not a NASA product and is not endorsed by NASA.
- Thank the Local Lead and the judges, and take questions.

## Words to watch

- Say SI, the Space Apps term.
- Say "NASA's SPHEREx data" and "NASA's test targets". Don't say "according to NASA", and don't suggest that NASA endorses the tool.
- The tool did not find a Planet X. Say what it does: it flags what moved, brightened, or faded, and it was checked on known objects.

## Numbers to have ready

| Fact | Number |
|---|---|
| SPHEREx bands | 102, from 0.75 to 5 µm, on six detectors |
| Public exposures in our index | 273,367 |
| Search | About a tenth of a second |
| One SPHEREx file | 65 MB. The server reads about 1 MB of it |
| Sent to the browser | About 8 KB per image |
| Index refresh | Tuesday and Friday |
| WISE 0855 | 2.8 arcsec west. 6.0 ± 0.9 arcsec a year, catalog 8.2. Detectors 5 and 6 only |
| Barnard's Star | 10.9 arcsec north in a year. 11.1 ± 1.4 arcsec a year, catalog 10.4 |
| Epsilon Indi B | 6.3 arcsec southeast. 4.6 ± 0.1 arcsec a year, catalog 4.7 |
| RW Aurigae | 55 percent brighter at 3.81 to 4.42 µm |
| R Draconis | 50 percent fainter in June 2026. Period 245 days |
| A new 5 arcminute field | Loads in 5 to 9 seconds. A field already in the server's memory opens at once |

## Questions that may come up

- **Did you find Planet X?** No. We checked the tool on known objects: NASA's five test targets, a dwarf planet, and a comet. It flags anything in a field that moved between visits, which is the search the challenge describes.
- **How is it different from the IRSA Data Explorer and WiseView?** We studied both, and the challenge names WiseView as a model. Ours plays SPHEREx exposures in time order with each star carried to the exposure's date, checks the whole field for change, and builds the spectrum from the same images.
- **Why does WISE 0855 need detectors 5 and 6?** It is detected only above about 3.9 µm, at a signal to noise of 1.4 to 6.6 per frame. Frames at shorter wavelengths hold only noise at its position.
- **How do you compare images taken at different wavelengths?** Change is compared only between images at matching wavelengths.
- **What about stars that saturate?** Saturated pixels carry no value. The tool measures the halo around the core, so Barnard's Star still gets a rough spectrum.
- **What happens when new data comes out?** A scheduled job rebuilds the index on Tuesday and Friday, with no code change. A guard stops it if more than 2 percent of the index would be lost.
- **How do you know the numbers are right?** The five test targets are checked against published catalog values. `docs/methods.md` describes each method and its limits.
- **How did you use SI?** We used Claude Code. We set the concept and the features, and we made the decisions. Claude wrote and tested the code and the docs under our direction. Its work is labeled in commits, file headers, and `docs/si-usage.md`.
- **Can another site use it?** Yes. Every view has a link, and `embed=1` in the link gives a compact layout for another page.
- **Will it stay online?** Yes, through judging. It is one container on Google Cloud Run, on the credit from the Space Apps Global Offers.

## Before going on

- Check the projector early. Set the browser zoom so the back row can read it.
- Open the six stops in tabs, in order, and the two spares after them. A field that was opened once comes back at once.
- Matt's Claude keeps the site warm from 3:05 pm to 5:00 pm, which Matt asked for on Nov 15. It opens the eight demo objects on the live site, asks the site for its health every three minutes so the instance stays up, and opens the objects again if the instance was replaced.
- The site can run two instances, and each has its own memory, so a first load can still take a few seconds. Keep talking through it.
- Don't merge to `main` between 3:00 and 5:00 pm. A merge deploys about four minutes later, and a new deploy starts with empty memory.
- Agree who says which part, and run it once with a timer.

## If something fails

- The venue network blocks the new domain: use https://spherexplorer-112779026983.us-east4.run.app instead.
- A stop does not load: go to the next tab, or to a spare.
- The network fails: play `media/videos/spherexplorer-demo.mp4` and show `media/slides/spherexplorer-slides.pdf` from the laptop. The slides have notes in `media/slides/speaker-notes.md`.

## The eight demo objects

Matt chose these on Nov 15. Each link was opened on the live site that day. An object stays quick as long as it is opened at the field size of its link, or at the 5 arcminutes that a typed name opens with.

| Object | Link | What it shows |
|---|---|---|
| WISE 0855 | https://spherexplorer.earth/?target=WISE%200855-0714&mode=visits&det=56 | The coldest known brown dwarf stepping west between visits. Measure Changes finds it |
| Haumea | https://spherexplorer.earth/?target=Haumea&fov=600&smooth=1&det=2 | A dwarf planet followed through a year. Press Play: the square moves on the map and the image study keeps it under its marker |
| Epsilon Indi B | https://spherexplorer.earth/?target=Epsilon%20Indi%20B&tool=graphs&feat=water,methane | The spectrum of a brown dwarf, with water and methane marked |
| Barnard's Star | https://spherexplorer.earth/?target=Barnard%27s%20Star&blink=wise-w1 | Blink against WISE from 2010. The star jumps more than 2.5 arcminutes |
| Pillars of Creation | https://spherexplorer.earth/?target=M%2016&fov=900&mode=deep&color=wide | The Eagle Nebula, M 16, in three-band color. Typing "Pillars of Creation" in Find opens the same place at 5 arcminutes |
| Jupiter and its moons | https://spherexplorer.earth/?target=Jupiter&fov=1200 | Jupiter with its four large moons as points beside it. Step through the film and they change places |
| 3I/ATLAS | https://spherexplorer.earth/?target=3I/ATLAS&mode=visits | An interstellar comet, followed as it moves |
| Orion Nebula | https://spherexplorer.earth/?target=M%2042&fov=1200&mode=deep&color=wide | A color image from three wavelength ranges |
