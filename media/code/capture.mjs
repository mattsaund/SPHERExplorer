// Takes the pictures the demo video is made from: real captures of the live site at 1920 by
// 1080, driven the way a person would use it. Each shot is saved under captures/.
// Usage: node capture.mjs [shot ...]   (no names means every shot)
// Written with Claude Code (Anthropic) assistance.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const SITE = process.env.SITE ?? "https://spherexplorer.earth";
const CHROME = process.env.CHROME ?? "/usr/sbin/google-chrome-stable";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "captures");
const WIDTH = 1920;
const HEIGHT = 1080;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  // The software renderer gives WebGL2 without a display, so the sky map and the viewer draw.
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", `--window-size=${WIDTH},${HEIGHT}`],
});

/** Open the site at an address, with the first-visit tour already seen, and wait for the page. */
async function open(address) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem("spherexplorer.tour", "seen");
    } catch {
      // Without storage the tour shows, and the shot would be of the tour.
    }
  });
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.goto(SITE + "/" + address, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".statusbar", { timeout: 120000 });
  return page;
}

/** Wait until the status line says the images are in. */
const loaded = (page) =>
  page.waitForFunction("/images loaded|no public images|not in any/.test(document.querySelector('.status')?.innerText ?? '')", { timeout: 300000 });

/** Press the button with this exact label. */
const press = (page, label) =>
  page.evaluate((text) => {
    const button = [...document.querySelectorAll("button")].find((entry) => entry.innerText.trim() === text);
    button?.click();
    return Boolean(button);
  }, label);

const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), type: "png" });

/** Where an element is on the page, for the scenes to crop to and to outline. */
const boxOf = (page, selector) =>
  page.evaluate((query) => {
    const element = document.querySelector(query);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  }, selector);

const boxes = {};
const SHOTS = {
  // The whole sky in three SPHEREx bands, for the challenge beat.
  async sky() {
    const page = await open("?layer=spherex-color");
    await wait(9000); // the sky tiles arrive over a few seconds
    await shot(page, "sky");
    boxes.sky = { map: await boxOf(page, ".view.map") };
    await page.close();
  },

  // The whole app with a study open, for the title beat.
  async app() {
    const page = await open("?target=" + encodeURIComponent("Barnard's Star") + "&mode=visits");
    await loaded(page);
    await wait(3500);
    await shot(page, "app");
    await page.close();
  },

  // Typing a name into Find, then the map centered with the yellow square.
  async search() {
    const page = await open("");
    await wait(5000);
    await shot(page, "search-00");
    await page.click(".search input");
    const text = "WISE 0855";
    for (let i = 1; i <= text.length; i++) {
      await page.keyboard.type(text[i - 1]);
      await wait(120);
      await shot(page, `search-${String(i).padStart(2, "0")}`);
    }
    boxes.search = { box: await boxOf(page, ".search") };
    await page.keyboard.press("Enter");
    await loaded(page);
    await wait(4000);
    await shot(page, "search-done");
    boxes.search.map = await boxOf(page, ".view.map");
    boxes.search.images = await boxOf(page, ".view.images");
    await page.close();
  },

  // One picture per visit of a target that moves. The sky is held still (follow=0), so the
  // brown dwarf steps across the frame while the stars stay put. Detectors 5 and 6 are the
  // only ones that see it. Zoomed in and smoothed so the step reads at a glance.
  async motion() {
    const page = await open("?target=" + encodeURIComponent("WISE 0855-0714") + "&mode=visits&det=56&view=images&zoom=3&follow=0&smooth=1");
    await loaded(page);
    await wait(4000);
    const steps = await page.evaluate(() => Number(document.querySelector(".controlbar")?.innerText.match(/\d+\s*\/\s*(\d+)/)?.[1] ?? 0));
    for (let i = 0; i < steps; i++) {
      await wait(1800); // a visit's sum is made in the background, then drawn
      await shot(page, `motion-${i}`);
      await page.keyboard.press("ArrowRight");
    }
    boxes.motion = { steps, images: await boxOf(page, ".view.images") };
    await page.close();
  },

  // A dwarf planet followed through a year of images. One detector is chosen, the one where
  // it is brightest, so the film has 55 steps. The map is set wide enough to hold its whole
  // path, so the yellow square is seen moving across it, while the image study keeps the body
  // under its marker.
  async haumea() {
    const page = await open("?target=Haumea&fov=600&smooth=1&det=2&mra=219.87&mdec=14.37&mfov=4");
    await loaded(page);
    await wait(5000);
    const place = () => page.evaluate(() => (document.querySelector(".controlbar")?.innerText.match(/(\d+)\s*\/\s*(\d+)/) ?? []).slice(1).map(Number));
    // Go back to the first step, whatever step the film opened on.
    for (let [now] = await place(); now > 1; [now] = await place()) {
      await page.keyboard.press("ArrowLeft");
      await wait(120);
    }
    // A step forward and back. Until the film has been moved, the square sits on the body's
    // marker, where it is today. After, it is where the image on screen was taken.
    await page.keyboard.press("ArrowRight");
    await wait(400);
    await page.keyboard.press("ArrowLeft");
    const [, total] = await place();
    const stride = 3; // every third image, so the year passes in a couple of seconds
    const steps = Math.ceil(total / stride);
    for (let i = 0; i < steps; i++) {
      await wait(1600); // the map moves its square and draws again
      await shot(page, `haumea-${i}`);
      for (let k = 0; k < stride; k++) {
        await page.keyboard.press("ArrowRight");
        await wait(150);
      }
    }
    boxes.haumea = { steps, map: await boxOf(page, ".view.map"), images: await boxOf(page, ".view.images") };
    await page.close();
  },

  // The spectrum of a brown dwarf with water and methane marked.
  async spectrum() {
    const page = await open("?target=" + encodeURIComponent("Epsilon Indi B") + "&tool=graphs&feat=water,methane");
    await loaded(page);
    await wait(5000);
    await shot(page, "spectrum");
    boxes.spectrum = { dock: await boxOf(page, ".dock"), plot: await boxOf(page, ".dock canvas") };
    await page.close();
  },

  // The same field in SPHEREx and in an older survey, as Blink shows them in turn. A field
  // 10 arcminutes wide holds both places of Barnard's Star, which moved more than
  // 2.5 arcminutes between the two pictures.
  async blink() {
    const page = await open("?target=" + encodeURIComponent("Barnard's Star") + "&mode=visits&view=images&fov=600");
    await loaded(page);
    await wait(3500);
    await press(page, "Blink");
    await wait(7000); // the older survey's tiles arrive over a few seconds
    // The Blink box names the picture now on screen, and the two swap every 0.8 s. A shot is
    // started at the moment the wanted picture comes up, and kept only if that picture is
    // still up when the shot is done.
    const showing = () => page.evaluate(() => document.querySelector(".blink-now")?.innerText ?? "");
    const shotOf = async (name, older) => {
      for (let attempt = 0; attempt < 15; attempt++) {
        await page.evaluate((wantOlder) => new Promise((resolve) => {
          const isWanted = () => {
            const text = document.querySelector(".blink-now")?.innerText ?? "";
            return text !== "" && text.startsWith("SPHEREx") !== wantOlder;
          };
          let before = isWanted();
          const timer = setInterval(() => {
            const now = isWanted();
            if (now && !before) {
              clearInterval(timer);
              resolve();
            }
            before = now;
          }, 15);
        }), older);
        await shot(page, name);
        const text = await showing();
        if (text !== "" && text.startsWith("SPHEREx") !== older) return text;
      }
      throw new Error(`Blink never held the ${older ? "older" : "SPHEREx"} picture long enough for a shot.`);
    };
    boxes.blink = { older: await shotOf("blink-old", true) };
    await shotOf("blink-new", false);
    boxes.blink.images = await boxOf(page, ".view.images");
    await page.close();
  },

  // Four real fields for the closing grid.
  async grid() {
    const fields = [
      ["wise", "?target=" + encodeURIComponent("WISE 0855-0714") + "&mode=deep&det=56&view=images"],
      ["barnard", "?target=" + encodeURIComponent("Barnard's Star") + "&mode=deep&view=images"],
      ["atlas", "?target=" + encodeURIComponent("3I/ATLAS") + "&mode=deep&view=images"],
      ["orion", "?target=" + encodeURIComponent("M 42") + "&fov=1200&mode=deep&color=wide&view=images"],
    ];
    for (const [name, address] of fields) {
      const page = await open(address);
      await loaded(page);
      await wait(name === "orion" ? 12000 : 6000); // the deepest sum, in three bands for Orion
      await shot(page, `grid-${name}`);
      boxes[`grid-${name}`] = { images: await boxOf(page, ".view.images") };
      await page.close();
    }
  },
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
// Boxes found on earlier runs are kept, so one shot can be taken again by itself.
const boxFile = path.join(OUT, "boxes.json");
if (fs.existsSync(boxFile)) Object.assign(boxes, JSON.parse(fs.readFileSync(boxFile, "utf8")));
for (const name of wanted) {
  if (!SHOTS[name]) throw new Error(`No shot named ${name}. The shots are: ${Object.keys(SHOTS).join(", ")}`);
  const started = Date.now();
  await SHOTS[name]();
  console.log(`${name}: ${((Date.now() - started) / 1000).toFixed(0)} s`);
  fs.writeFileSync(boxFile, JSON.stringify(boxes, null, 2));
}
await browser.close();
