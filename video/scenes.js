// Lays out the demo video for any moment. render(t) is a pure function of the time in
// seconds: it shows the scene for that moment, with its caption, credit, and watermark.
// The pictures are captures of the app taken by capture.mjs. Their boxes (where the map, the
// image viewer, and so on sit in each capture) arrive in window.BOXES from render.mjs.
// The on-screen text follows the storyboard in docs/video.md.
// Written with Claude Code (Anthropic) assistance.

const FPS = 30;
const LENGTH = 28.5; // seconds. The demo may not pass 30.
const STAGE = { width: 1920, height: 1080 };
const FRAME = { left: 120, top: 14, width: 1680, height: 945 }; // the same box as .frame in scenes.html
const FADE = 0.3; // seconds for one scene to fade in over the last
const WATERMARK = "SI-generated video. Made with Claude Code (Anthropic).";
const CREDIT_SPHEREX = "SPHEREx data: NASA, JPL-Caltech, IPAC IRSA";
const CREDIT_PARTNERS = "Gaia: ESA, DPAC. NEOSSat: CSA. 2MASS and WISE: NASA, IPAC";

/**
 * The scenes in order. `from` and `to` are seconds. A scene of kind "shot" shows captures
 * in the frame: `frames` lists [seconds into the scene, capture name], and `crop` names the
 * box of the capture to fill the frame with (none means the whole page).
 */
const SCENES = [
  { from: 0, to: 2.5, kind: "card", lines: [["title", "Turing Complete"], ["heading", "Matt and Austin"], ["line", "NASA Space Apps Challenge 2026"]] },
  {
    // The push is small enough that the edge of the page, with the name and Help, is not cut.
    from: 2.5, to: 5.5, kind: "shot", frames: [[0, "sky"]], push: 0.008,
    plate: "Planet X and SPHEREx", caption: "Find what moves in SPHEREx's all-sky infrared images.", credit: CREDIT_SPHEREX,
  },
  {
    from: 5.5, to: 9.5, kind: "shot", frames: [[0, "app"]], dim: 0.62,
    big: "SPHERExplorer", caption: "Explore SPHEREx images of the sky and how they change over time.", credit: CREDIT_SPHEREX,
  },
  {
    from: 9.5, to: 12.25, kind: "shot",
    // The name is typed a letter at a time, then the map goes there and the square appears.
    frames: [[0, "search-00"], ...Array.from({ length: 9 }, (_, i) => [0.3 + i * 0.09, `search-0${i + 1}`]), [1.35, "search-done"]],
    callouts: [{ box: ["search", "box"], from: 0.1, to: 1.3 }],
    caption: "Search any object or coordinates.", credit: CREDIT_SPHEREX,
  },
  {
    from: 12.25, to: 15, kind: "shot", steps: "motion",
    caption: "Play every visit. Moving objects step across the frame.", credit: CREDIT_SPHEREX,
  },
  {
    from: 15, to: 17.75, kind: "shot", frames: [[0, "spectrum"]],
    callouts: [{ box: ["spectrum", "plot"], from: 0.3, to: 2.6 }],
    caption: "102 infrared bands. A spectrum for any point.", credit: CREDIT_SPHEREX,
  },
  {
    from: 17.75, to: 20.5, kind: "shot",
    // The two pictures swap, as Blink swaps them in the app.
    frames: Array.from({ length: 6 }, (_, i) => [i * 0.46, i % 2 ? "blink-old" : "blink-new"]),
    caption: "Checked against Gaia, 2MASS, WISE, and NEOSSat.", credit: CREDIT_PARTNERS,
  },
  {
    from: 20.5, to: 25.5, kind: "grid",
    cells: [["grid-wise", "WISE 0855"], ["grid-barnard", "Barnard's Star"], ["grid-atlas", "3I/ATLAS"], ["grid-orion", "Orion Nebula"]],
    captions: [[0, 2.5, "For classrooms, researchers, and anyone curious."], [2.5, 5, "Built to update with every new SPHEREx data release."]],
    credit: CREDIT_SPHEREX,
  },
  {
    from: 25.5, to: 28.5, kind: "card",
    lines: [["title", "spherexplorer.earth"], ["heading", "Open source, Apache-2.0"], ["small", `${CREDIT_SPHEREX}. ${CREDIT_PARTNERS}.`], ["line", "Independent project. Not endorsed by NASA."]],
  },
];

const clamp = (value) => Math.min(1, Math.max(0, value));
const ease = (value) => value * value * (3 - 2 * value); // a soft start and stop
const BOXES = window.BOXES ?? {};
const images = new Map();

/** A capture as an image element, made once. */
function picture(name) {
  if (!images.has(name)) {
    const img = new Image();
    img.src = `captures/${name}.png`;
    images.set(name, img);
  }
  return images.get(name);
}

function element(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}

/**
 * Place a capture inside a container so that `crop` (a box of the capture, or the whole page)
 * fills it: whole inside it, or covering it with `cover`. `push` scales it up around the middle.
 */
function place(img, container, crop, cover, push = 0) {
  const box = crop ?? { x: 0, y: 0, width: STAGE.width, height: STAGE.height };
  const fitX = container.width / box.width;
  const fitY = container.height / box.height;
  const scale = (cover ? Math.max(fitX, fitY) : Math.min(fitX, fitY)) * (1 + push);
  const x = container.width / 2 - scale * (box.x + box.width / 2);
  const y = container.height / 2 - scale * (box.y + box.height / 2);
  img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  return { scale, x, y };
}

/**
 * The middle of the image viewer in a capture, at a given shape (width over height). The
 * picture itself is a square in the middle of the viewer, and the cards sit at its sides,
 * so this keeps the sky and leaves the cards out.
 */
function middleOf(viewer, shape) {
  if (!viewer) return null;
  const width = Math.min(viewer.width, viewer.height);
  const height = width / shape;
  return { x: viewer.x + (viewer.width - width) / 2, y: viewer.y + (viewer.height - height) / 2, width, height };
}

const stage = document.getElementById("stage");
const built = SCENES.map((scene) => {
  const node = element("div", "scene", stage);
  const parts = { node };
  if (scene.kind === "card") {
    // Lines of text stacked in the middle of the stage.
    const heights = { title: 150, heading: 96, line: 78, small: 60 };
    const total = scene.lines.reduce((sum, [kind]) => sum + heights[kind], 0);
    let top = (STAGE.height - total) / 2 - 20;
    for (const [kind, text] of scene.lines) {
      const line = element("div", `over ${kind}`, node, text);
      line.style.top = `${top}px`;
      line.style.lineHeight = `${heights[kind]}px`;
      top += heights[kind];
    }
  } else if (scene.kind === "shot") {
    const frame = element("div", "frame", node);
    const names = scene.steps ? Array.from({ length: BOXES[scene.steps]?.steps ?? 0 }, (_, i) => `${scene.steps}-${i}`) : scene.frames.map(([, name]) => name);
    parts.pictures = names.map((name) => {
      const img = frame.appendChild(picture(name).cloneNode());
      img.style.opacity = 0;
      return img;
    });
    parts.names = names;
    if (scene.dim) element("div", "dim", frame).style.opacity = scene.dim;
    parts.callouts = (scene.callouts ?? []).map(() => element("div", "callout", frame));
    if (scene.plate) {
      // A solid plate keeps the words readable over a busy sky.
      const plate = element("div", "over heading", frame, scene.plate);
      Object.assign(plate.style, { top: "392px", left: "430px", right: "430px", lineHeight: "130px", background: "var(--bg)", border: "1px solid var(--line)" });
    }
    if (scene.big) {
      const big = element("div", "over title", frame, scene.big);
      Object.assign(big.style, { top: "380px", lineHeight: "150px" });
    }
    parts.captions = [element("div", "caption", node, scene.caption)];
  } else if (scene.kind === "grid") {
    const gap = 8;
    const width = (FRAME.width - gap) / 2;
    const height = (FRAME.height - gap) / 2;
    scene.cells.forEach(([name, label], i) => {
      const cell = element("div", "cell", node);
      Object.assign(cell.style, {
        left: `${FRAME.left + (i % 2) * (width + gap)}px`, top: `${FRAME.top + Math.floor(i / 2) * (height + gap)}px`,
        width: `${width}px`, height: `${height}px`,
      });
      const img = cell.appendChild(picture(name).cloneNode());
      place(img, { width, height }, middleOf(BOXES[name]?.images, width / height), true);
      element("span", "", cell, label);
    });
    parts.captions = scene.captions.map(([, , text]) => element("div", "caption", node, text));
  }
  return parts;
});
const watermark = element("div", "", stage, WATERMARK);
watermark.id = "watermark";
const credit = element("div", "", stage, "");
credit.id = "credit";

/** How visible a caption is `u` seconds into its time on screen of `length` seconds, and how far it has yet to rise. */
function captionAt(u, length) {
  const rise = clamp((u - 0.15) / 0.3);
  const out = clamp((length - 0.05 - u) / 0.2);
  return { opacity: ease(rise) * out, lift: (1 - ease(rise)) * 12 };
}

/** Show the video as it is `t` seconds in. */
function render(t) {
  let shown = "";
  SCENES.forEach((scene, i) => {
    const parts = built[i];
    const u = t - scene.from;
    const length = scene.to - scene.from;
    // A scene fades in over the one before it, and stays under the next while that one fades in.
    const visible = u >= 0 && u < length + FADE;
    parts.node.style.opacity = !visible ? 0 : i === 0 ? 1 : ease(clamp(u / FADE));
    parts.node.style.zIndex = i;
    if (!visible) return;
    if (u < length) shown = scene.credit ?? "";

    if (scene.kind === "shot") {
      const push = (scene.push ?? 0) * clamp(u / length);
      const crop = scene.crop ? BOXES[scene.crop[0]]?.[scene.crop[1]] : null;
      // Which capture is up now: by its own time, or one per step, held for equal shares.
      let current = 0;
      if (scene.steps) current = Math.min(parts.pictures.length - 1, Math.floor((clamp(u / length) * parts.pictures.length)));
      else scene.frames.forEach(([at], k) => { if (u >= at) current = k; });
      let fit = null;
      parts.pictures.forEach((img, k) => {
        const placed = place(img, FRAME, crop, scene.cover, push);
        if (k === current) fit = placed;
        img.style.opacity = k === current ? 1 : 0;
      });
      (scene.callouts ?? []).forEach((callout, k) => {
        const box = BOXES[callout.box[0]]?.[callout.box[1]];
        const mark = parts.callouts[k];
        if (!box || !fit) return;
        Object.assign(mark.style, {
          left: `${fit.x + fit.scale * box.x - 6}px`, top: `${fit.y + fit.scale * box.y - 6}px`,
          width: `${fit.scale * box.width + 12}px`, height: `${fit.scale * box.height + 12}px`,
          opacity: clamp((u - callout.from) / 0.2) * clamp((callout.to - u) / 0.2),
        });
      });
      const caption = captionAt(u, length);
      Object.assign(parts.captions[0].style, { opacity: caption.opacity, transform: `translateY(${caption.lift}px)` });
    } else if (scene.kind === "grid") {
      scene.captions.forEach(([from, to], k) => {
        const caption = captionAt(u - from, to - from);
        Object.assign(parts.captions[k].style, { opacity: u >= from && u < to ? caption.opacity : 0, transform: `translateY(${caption.lift}px)` });
      });
    }
  });
  credit.textContent = shown;
}

// render.mjs waits for this before it saves the first frame.
window.ready = Promise.all([document.fonts.ready, document.fonts.load('600 48px "Inter"'), document.fonts.load('700 120px "Inter"'), document.fonts.load('400 24px "Inter"'),
  ...[...images.values()].map((img) => img.decode().catch(() => { throw new Error(`The capture ${img.src} is missing. Run capture.mjs first.`); }))]);
window.render = render;
window.VIDEO = { FPS, LENGTH, WATERMARK };
render(0);
