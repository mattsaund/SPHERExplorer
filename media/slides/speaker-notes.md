# Speaker notes

The notes for `spherexplorer-slides.pdf`, about 30 seconds a slide, or 4 minutes in all. Drafted with Claude Code (Anthropic), an SI tool.

## 1. Title

We’re Matt and Austin, team Turing Complete. We took on the Planet X and SPHEREx challenge: helping anyone see what moves in NASA’s new all-sky infrared images. Our answer is SPHERExplorer, a free website that plays every SPHEREx image of any place in the sky as a time sequence.

## 2. The challenge

SPHEREx is a NASA space telescope that maps the entire sky in 102 bands of infrared light, and it photographs each place many times. That makes it great for finding things that move or change, like nearby brown dwarfs, asteroids, and variable stars. But the images are separate files, so seeing a change meant downloading and lining up many large files. The challenge asked for a public tool that shows them in order, so motion is easy to spot.

## 3. Our project

This is SPHERExplorer. Type a name or coordinates, and it finds every public SPHEREx image of that place and plays them in time order, like a time-lapse. Here is WISE 0855, the coldest brown dwarf we know of. It steps west from visit to visit while the stars around it hold still. It runs in any web browser, with nothing to install and no account.

## 4. How people use it

Using it takes three steps. First, search any star, planet, or comet, by name or by sky coordinates. Second, one button checks every source in the field and reports what moved, brightened, or faded between visits. Third, read the light: the spectrum splits an object’s light into 102 bands, and the tool marks features like water and methane and says which ones really stand out.

## 5. The data

All of this rests on free, open data from space. NASA’s SPHEREx images come from the NASA/IPAC Infrared Science Archive, read straight from NASA’s public cloud bucket. We add star positions and motions from the European Space Agency’s Gaia, visible-light images from the Canadian Space Agency’s NEOSSat, the older WISE and 2MASS surveys to compare against, and JPL Horizons for planets, asteroids, and comets. The server reads only about 1 MB of each 65 MB file and sends about 8 KB to the browser, which keeps it fast.

## 6. Does it work?

Does it work? The challenge named five test targets. Our change finder checks every source in the field and flags each target once, with nothing else flagged. Barnard’s Star moved 10.9 arcseconds north in a year, against a catalog value of 10.4. Epsilon Indi B matches almost exactly. WISE 0855 is faint and sits near another star, so its measure is rougher, but the direction is right. RW Aurigae brightened 55 percent in the infrared, and R Draconis shows its pulsation. Every method and its limits are written up in our methods document.

## 7. What's next

What’s next? Anyone, from a classroom to a research group, can hunt for hidden worlds, follow asteroids and comets, find stars that change, and watch the universe change over time. SPHERExplorer picks up new SPHEREx data as it is released, and the code is open source for anyone to build on. Try it at spherexplorer.earth. Thank you.
