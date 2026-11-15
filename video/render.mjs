// Renders the demo video: opens scenes.html, saves one picture for each thirtieth of a
// second, and has ffmpeg encode them. Fails if the result would pass the 30 second limit.
// Usage: node render.mjs            the whole video, to out/spherexplorer-demo.mp4
//        node render.mjs 3.5 12     single frames at those seconds, to out/frame-<t>.png
// Written with Claude Code (Anthropic) assistance.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME ?? "/usr/sbin/google-chrome-stable";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRAMES = path.join(HERE, "frames");
const OUT = path.join(HERE, "out");
const LIMIT = 29.5; // seconds. Over 30 the project loses Global Judging, so stop well short.
const SI_NOTE = "SI-generated video. Made with Claude Code (Anthropic) from captures of the SPHERExplorer web tool.";

const boxes = JSON.parse(fs.readFileSync(path.join(HERE, "captures", "boxes.json"), "utf8"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files", "--force-color-profile=srgb"] });
const page = await browser.newPage();
page.on("pageerror", (error) => { throw error; });
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
// The scenes need to know where the map, the viewer, and the rest sit in each capture.
await page.evaluateOnNewDocument((data) => { window.BOXES = data; }, boxes);
await page.goto(pathToFileURL(path.join(HERE, "scenes.html")).href);
await page.evaluate(() => window.ready);
const { FPS, LENGTH, WATERMARK } = await page.evaluate(() => window.VIDEO);
if (LENGTH > LIMIT) throw new Error(`The video is ${LENGTH} s long. The limit is ${LIMIT} s.`);
const stage = await page.$("#stage");
fs.mkdirSync(OUT, { recursive: true });

const singles = process.argv.slice(2).map(Number).filter(Number.isFinite);
if (singles.length) {
  for (const t of singles) {
    await page.evaluate((time) => window.render(time), t);
    await stage.screenshot({ path: path.join(OUT, `frame-${t}.png`) });
    console.log(`out/frame-${t}.png`);
  }
  await browser.close();
  process.exit(0);
}

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
const count = Math.round(LENGTH * FPS);
const started = Date.now();
for (let frame = 0; frame < count; frame++) {
  await page.evaluate((time) => window.render(time), frame / FPS);
  // The watermark must be on every frame. Check that the page still shows it.
  if (frame % 150 === 0) {
    const mark = await page.evaluate(() => {
      const node = document.getElementById("watermark");
      const box = node.getBoundingClientRect();
      // Seen means nothing lies over it: the page's topmost element at its middle is the watermark itself.
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { text: node.textContent, seen: box.width > 100 && getComputedStyle(node).opacity === "1" && top === node };
    });
    if (mark.text !== WATERMARK || !mark.seen) throw new Error(`The SI watermark is missing on frame ${frame}.`);
  }
  await stage.screenshot({ path: path.join(FRAMES, `${String(frame).padStart(4, "0")}.png`) });
}
await browser.close();
console.log(`${count} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);

const file = path.join(OUT, "spherexplorer-demo.mp4");
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(FRAMES, "%04d.png"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart",
  "-metadata", "title=SPHERExplorer demo", "-metadata", `comment=${SI_NOTE}`, "-metadata", `description=${SI_NOTE}`,
  file,
], { stdio: "inherit" });
const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString().trim());
if (!(seconds <= LIMIT)) throw new Error(`The encoded video is ${seconds} s long. The limit is ${LIMIT} s.`);
console.log(`${path.relative(HERE, file)}: ${seconds.toFixed(2)} s, ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
