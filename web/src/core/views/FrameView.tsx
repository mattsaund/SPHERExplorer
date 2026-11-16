// The frame viewer: a WebGL canvas for the image and a 2D canvas on top for the marker,
// compass, and scale bar. It fills its parent and carries no chrome of its own.
// Colors come from CSS variables on any ancestor: --frame-ink, --frame-marker, --frame-label, --frame-gaia, --frame-pick, --frame-change, --frame-flag, --frame-empty.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef, useState } from "react";
import { offsetToSky, positionAt, skyOffset } from "../sky/astro";
import { BlinkLayer } from "./BlinkLayer";
import { registerCapture } from "../images/capture";
import { changeLabel } from "../science/changes";
import { onSumReady, sceneFor, sumsWaiting, type Scene } from "../images/layers";
import { getPixels, imageOf } from "../images/pixels";
import { FrameRenderer } from "../images/renderer";
import { DEFAULT_APERTURE } from "../science/spectrum";
import { actions, useStore, type AppState } from "../state/store";
import type { SequenceItem, SkyObject, Target } from "../types";

/** How many known objects get a label in the frame view. */
const OBJECT_LABELS = 25;

/** Parse a CSS color into [r, g, b] in 0 to 1 by letting the browser resolve it. */
function cssColor(element: HTMLElement, name: string, fallback: string): { css: string; rgb: [number, number, number] } {
  const css = getComputedStyle(element).getPropertyValue(name).trim() || fallback;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return { css, rgb: [r / 255, g / 255, b / 255] };
}

/** A round length in arcseconds for the scale bar, near a wanted length. */
function niceLength(arcsec: number): number {
  const steps = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600];
  return steps.reduce((best, step) => (Math.abs(step - arcsec) < Math.abs(best - arcsec) ? step : best));
}

/** A length on the sky in words for the scale bar: arcseconds, arcminutes, or degrees. */
function lengthLabel(arcsec: number): string {
  if (arcsec >= 3600) return `${arcsec / 3600}°`;
  if (arcsec >= 60) return `${arcsec / 60}′`;
  return `${arcsec}″`;
}

/** The credit line under a saved picture, from the fullest form to the shortest. */
const SAVE_CREDITS = ["Data: NASA SPHEREx, from IRSA. Made with SPHERExplorer", "Data: NASA SPHEREx. Made with SPHERExplorer", "Data: NASA SPHEREx"];

/** The image viewer: draws the step on screen with its marks, and handles pan, zoom, and clicks. */
export function FrameView({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // The blink layer is a second sky view. It is made the first time blinking is switched on,
  // and kept after that, so switching it on again costs nothing.
  const blinkOn = useStore((s) => s.blink.on);
  const [blinkUsed, setBlinkUsed] = useState(false);
  useEffect(() => {
    if (blinkOn) setBlinkUsed(true);
  }, [blinkOn]);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = glRef.current!;
    const overlay = overlayRef.current!;
    let renderer: FrameRenderer;
    try {
      renderer = new FrameRenderer(canvas);
    } catch (error) {
      setFailure((error as Error).message);
      return;
    }

    let raf = 0;
    let scene: Scene | null = null;
    let session = -1;
    // Screen positions of the object labels drawn last, for clicks.
    let labels: { x: number; y: number; object: SkyObject }[] = [];
    // The surface being drawn on when it is not the viewer itself: a saved picture. Its width
    // and height in CSS pixels, canvas pixels per CSS pixel, and the sky offset at its center.
    let stage: { w: number; h: number; ratio: number; east: number; north: number } | null = null;
    const schedule = () => {
      raf ||= requestAnimationFrame(draw);
    };

    /** Arcseconds per CSS pixel for the current view. */
    const scaleOf = (state: AppState) => state.fieldSize / (Math.min(wrap.clientWidth, wrap.clientHeight) * state.view.zoom || 1);

    function draw() {
      raf = 0;
      paint(useStore.getState().player.index);
    }

    /**
     * Draw one step of the sequence: the image, then the overlay.
     * A sum that takes a while is made in the background, and the picture on screen stays up
     * until it is there. `wait` makes the sum at once instead, for a picture that is being saved.
     */
    function paint(index: number, wait = false) {
      const state = useStore.getState();
      if (state.session !== session) {
        // A new target. Old textures belong to other frames, and so does the old picture.
        renderer.clear();
        session = state.session;
        scene = null;
      }
      const item = state.sequence[index];
      const made = item ? sceneFor(item, state, !wait) : null;
      // Nothing to show for this step yet, but its sum is on the way: keep what is on screen.
      if (made || wait || !sumsWaiting()) scene = made;
      const scale = scaleOf(state);
      const flag = cssColor(wrap, "--frame-flag", "#e5484d");
      const empty = cssColor(wrap, "--frame-empty", "#5b2a86");
      renderer.draw(scene?.layer ?? null, {
        center: stage ? [stage.east, stage.north] : [state.view.east, state.view.north],
        scale,
        ratio: stage?.ratio,
        stretch: state.display.stretch,
        lo: state.display.lo,
        hi: state.display.hi,
        colorMap: state.display.colorMap,
        invert: state.display.invert,
        smooth: state.display.smooth,
        showFlags: state.display.showFlags,
        flagMask: state.meta?.badMask ?? 0,
        flagColor: flag.rgb,
        emptyColor: empty.rgb,
        mode: scene?.color ? "rgb" : scene?.minus ? "difference" : "single",
      }, scene?.color?.[0] ?? scene?.minus ?? null, scene?.color?.[1] ?? null);
      drawOverlay(state, scale, item);
    }

    /**
     * A copy of one step for saving: image, overlay, and a caption strip underneath.
     * The saved picture is the part of the view that the field covers, without the empty
     * margins beside it. It is drawn again at its own size, so it is as sharp from a small
     * window as from a large one. `side` sets that size: a square picture is `side` pixels
     * on a side, and one of another shape has about as many pixels in all.
     */
    function renderStep(index: number, side: number): HTMLCanvasElement | null {
      const state = useStore.getState();
      const item = state.sequence[index];
      if (!item) return null;
      const scale = scaleOf(state);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      // A viewer that is not on screen has no size, and so no picture to save.
      if (w < 2 || h < 2) return null;
      // Where the field is in the viewer, in CSS pixels. North is up and east is left.
      const half = state.fieldSize / 2 / scale;
      const middleX = w / 2 + state.view.east / scale;
      const middleY = h / 2 + state.view.north / scale;
      let left = Math.max(0, middleX - half);
      let right = Math.min(w, middleX + half);
      let top = Math.max(0, middleY - half);
      let bottom = Math.min(h, middleY + half);
      if (right - left < 40 || bottom - top < 40) {
        // The field is off the screen, or nearly. Save the view as it is.
        left = 0;
        right = w;
        top = 0;
        bottom = h;
      }
      const boxW = right - left;
      const boxH = bottom - top;
      // Canvas pixels per CSS pixel. A very long, thin picture is held to twice `side` in length.
      const ratio = Math.min(side / Math.sqrt(boxW * boxH), (2 * side) / Math.max(boxW, boxH));
      const width = Math.max(1, Math.round(boxW * ratio));
      const height = Math.max(1, Math.round(boxH * ratio));

      // Draw on canvases of the saved size, then give the viewer its own size back.
      const kept = [canvas.width, canvas.height];
      for (const target of [canvas, overlay]) {
        target.width = width;
        target.height = height;
      }
      stage = {
        w: boxW,
        h: boxH,
        ratio,
        east: state.view.east - ((left + right) / 2 - w / 2) * scale,
        north: state.view.north - ((top + bottom) / 2 - h / 2) * scale,
      };
      const out = document.createElement("canvas");
      try {
        paint(index, true);
        // A narrow picture has no room for the title and the credit side by side, so they get
        // a line each, and a very narrow one gives the name its own line too. The rule looks
        // only at the width and at whether there is a name, so every frame of a film is one size.
        const name = state.target?.name ?? "";
        const lines = boxW < 700 ? (boxW < 420 && name ? 3 : 2) : 1;
        const strip = lines === 3 ? 71 : lines === 2 ? 50 : 30;
        out.width = width;
        out.height = height + Math.round(strip * ratio);
        const pen = out.getContext("2d")!;
        pen.fillStyle = "#000000";
        pen.fillRect(0, 0, out.width, out.height);
        // The WebGL canvas must be copied in the same task it was drawn in.
        pen.drawImage(canvas, 0, 0);
        pen.drawImage(overlay, 0, 0);
        pen.fillStyle = "#ffffff";
        const family = getComputedStyle(wrap).fontFamily || "sans-serif";
        const size = Math.round(13 * ratio);
        pen.font = `${size}px ${family}`;
        pen.textBaseline = "middle";
        const edge = 10 * ratio;
        // One line of the caption. Text wider than its room is set smaller, so nothing runs off the side.
        const write = (text: string, x: number, y: number, room: number) => {
          pen.font = `${size}px ${family}`;
          const wide = pen.measureText(text).width;
          if (wide > room && wide > 0) pen.font = `${Math.max(1, Math.floor((size * room) / wide))}px ${family}`;
          pen.fillText(text, x, y);
        };
        // The credit says where the data comes from and what drew it. It must not read as a
        // NASA mark on the tool itself, so the data is labeled as data. The longest form that
        // fits is used: beside the title on one line, or alone on its own line.
        const pick = (room: number) => SAVE_CREDITS.find((text) => pen.measureText(text).width <= room) ?? SAVE_CREDITS[SAVE_CREDITS.length - 1];
        const whole = out.width - 2 * edge;
        if (lines === 3) {
          const credit = pick(whole);
          write(`${name}.`, edge, height + 15 * ratio, whole);
          write(item.label, edge, height + 36 * ratio, whole);
          write(credit, edge, height + 57 * ratio, whole);
        } else if (lines === 2) {
          const credit = pick(whole);
          write(`${name ? name + ". " : ""}${item.label}`, edge, height + 15 * ratio, whole);
          write(credit, edge, height + 36 * ratio, whole);
        } else {
          const title = `${name ? name + ". " : ""}${item.label}`;
          const shortest = pen.measureText(SAVE_CREDITS[SAVE_CREDITS.length - 1]).width;
          const titleRoom = out.width - 3 * edge - shortest;
          const credit = pick(out.width - 3 * edge - Math.min(pen.measureText(title).width, titleRoom));
          write(title, edge, height + (strip * ratio) / 2, titleRoom);
          pen.font = `${size}px ${family}`;
          pen.textAlign = "right";
          pen.fillText(credit, out.width - edge, height + (strip * ratio) / 2);
        }
      } finally {
        stage = null;
        for (const target of [canvas, overlay]) {
          target.width = kept[0];
          target.height = kept[1];
        }
        // Put the live view back on screen.
        schedule();
      }
      return out;
    }

    function drawOverlay(live: AppState, scale: number, item: SequenceItem | undefined) {
      // A saved picture is drawn on its own surface, centered on its own part of the view.
      const state = stage ? { ...live, view: { ...live.view, east: stage.east, north: stage.north } } : live;
      const ratio = stage?.ratio ?? overlay.width / (wrap.clientWidth || 1);
      const ctx = overlay.getContext("2d")!;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const w = stage?.w ?? wrap.clientWidth;
      const h = stage?.h ?? wrap.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (!scene) return;
      const ink = cssColor(wrap, "--frame-ink", "rgba(255,255,255,0.92)").css;
      const label = cssColor(wrap, "--frame-label", "#9be8ff").css;
      const marker = cssColor(wrap, "--frame-marker", "#ffd24a").css;
      const font = getComputedStyle(wrap).fontFamily || "sans-serif";

      if (state.display.showMarker) {
        // Four ticks around the expected position, leaving the source itself uncovered.
        const x = w / 2 - (scene.marker[0] - state.view.east) / scale;
        const y = h / 2 - (scene.marker[1] - state.view.north) / scale;
        const gap = Math.max(8, 9 / scale);
        const length = 10;
        ctx.strokeStyle = marker;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          ctx.moveTo(x + dx * gap, y + dy * gap);
          ctx.lineTo(x + dx * (gap + length), y + dy * (gap + length));
        }
        ctx.stroke();
      }

      // The circle the spectrum is measured in, when one is in use.
      const { aperture, probe } = state.spectrum;
      if (aperture !== null || probe) {
        const [east, north] = probe ?? scene.marker;
        ctx.strokeStyle = marker;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(w / 2 - (east - state.view.east) / scale, h / 2 - (north - state.view.north) / scale, (aperture ?? DEFAULT_APERTURE) / scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // A spot picked by a click, until the UI acts on it or clears it.
      const picked = state.map.picked;
      if (picked && state.map.pickedIn === "images" && state.target && !state.target.moving) {
        const [east, north] = skyOffset(picked, state.target);
        const x = w / 2 - (east - state.view.east) / scale;
        const y = h / 2 - (north - state.view.north) / scale;
        ctx.strokeStyle = cssColor(wrap, "--frame-pick", "#ff6b6b").css;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 7, y - 7, 14, 14);
      }

      // Known objects, moved to where they were at the time of the image on screen.
      labels = [];
      const following = scene.stack !== undefined && state.follow;
      /** Where a known object is on screen in the image now showing. */
      const objectAt = (object: SkyObject, mjd: number, target: Target): [number, number] => {
        const place = positionAt({ ra: object.ra, dec: object.dec, epoch: object.epoch, pmRa: object.pmRa ?? 0, pmDec: object.pmDec ?? 0 }, mjd);
        let [east, north] = skyOffset(place, target);
        // A sum that follows the target is drawn in the target's own frame.
        if (following) {
          const track = skyOffset(positionAt(target, mjd), target);
          east -= track[0];
          north -= track[1];
        }
        return [w / 2 - (east - state.view.east) / scale, h / 2 - (north - state.view.north) / scale];
      };
      if (state.display.showObjects && state.target && item) {
        ctx.font = `12px ${font}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.lineWidth = 1.5;
        for (const object of state.fieldObjects.slice(0, OBJECT_LABELS)) {
          const [x, y] = objectAt(object, item.mjd, state.target);
          if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
          // Two objects in almost the same place would print their names on top of each
          // other. The better known one comes first in the list, and it keeps the label.
          if (labels.some((entry) => Math.hypot(entry.x - x, entry.y - y) < 8)) continue;
          // The target keeps its ring like any other object, so the ring does not vanish
          // when an object is chosen for study. The ring sits inside the gap of the target
          // marker, and the name moves out past the marker's arm.
          const markX = w / 2 - (scene.marker[0] - state.view.east) / scale;
          const markY = h / 2 - (scene.marker[1] - state.view.north) / scale;
          const onTarget = state.display.showMarker && Math.hypot(x - markX, y - markY) < 6;
          ctx.strokeStyle = label;
          ctx.fillStyle = label;
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillText(object.name, x + (onTarget ? Math.max(8, 9 / scale) + 14 : 13), y);
          labels.push({ x, y, object });
        }
      }

      // The object chosen in the list or by a click gets a second, wider ring, so it is easy
      // to find. It is named here when it has no label of its own.
      const chosen = state.map.selected;
      if (chosen && state.target && !state.target.moving && item) {
        const [x, y] = objectAt(chosen, item.mjd, state.target);
        if (x > -20 && y > -20 && x < w + 20 && y < h + 20) {
          ctx.strokeStyle = label;
          ctx.fillStyle = label;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x, y, 14, 0, Math.PI * 2);
          ctx.stroke();
          if (!labels.some((entry) => entry.object.id === chosen.id)) {
            ctx.font = `12px ${font}`;
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillText(chosen.name, x + 18, y);
          }
        }
      }

      // What the change finder flagged: a diamond on each source, with a word for what it did.
      const report = state.changes;
      if (state.display.showChanges && report && state.target && item) {
        const following = scene.stack !== undefined && state.follow;
        const track = following ? skyOffset(positionAt(state.target, item.mjd), state.target) : [0, 0];
        const color = cssColor(wrap, "--frame-change", "#ff9f43").css;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.font = `12px ${font}`;
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        const half = 13;
        for (const change of report.changes) {
          // A mover is drawn where it was during the visit nearest in time to the image on screen.
          let east = change.east;
          let north = change.north;
          if (change.kind === "moved") {
            let nearest = Infinity;
            for (const place of change.places) {
              if (place.east === null || place.north === null || Math.abs(place.mjd - item.mjd) >= nearest) continue;
              nearest = Math.abs(place.mjd - item.mjd);
              east = place.east;
              north = place.north;
            }
          }
          const x = w / 2 - (east - track[0] - state.view.east) / scale;
          const y = h / 2 - (north - track[1] - state.view.north) / scale;
          if (x < -30 || y < -30 || x > w + 30 || y > h + 30) continue;
          ctx.beginPath();
          ctx.moveTo(x, y - half);
          ctx.lineTo(x + half, y);
          ctx.lineTo(x, y + half);
          ctx.lineTo(x - half, y);
          ctx.closePath();
          if (change.kind === "moved" && change.angle !== undefined) {
            // A tail pointing the way it is going. North is up and east is left.
            const angle = (change.angle * Math.PI) / 180;
            const dx = -Math.sin(angle);
            const dy = -Math.cos(angle);
            ctx.moveTo(x + dx * half, y + dy * half);
            ctx.lineTo(x + dx * (half + 18), y + dy * (half + 18));
          }
          ctx.stroke();
          ctx.fillText(changeLabel(change), x, y + half + 3);
        }
      }

      // Gaia stars as small crosses, each where its own motion puts it on the date of the image.
      if (state.display.showGaia && state.target && item && state.missions) {
        const gaia = cssColor(wrap, "--frame-gaia", "#7dffa0").css;
        const following = scene.stack !== undefined && state.follow;
        const track = following ? skyOffset(positionAt(state.target, item.mjd), state.target) : [0, 0];
        ctx.strokeStyle = gaia;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const star of state.missions.gaia) {
          const place = positionAt({ ra: star.ra, dec: star.dec, epoch: star.epoch, pmRa: star.pmRa ?? 0, pmDec: star.pmDec ?? 0 }, item.mjd);
          const [east, north] = skyOffset(place, state.target);
          const x = w / 2 - (east - track[0] - state.view.east) / scale;
          const y = h / 2 - (north - track[1] - state.view.north) / scale;
          if (x < 0 || y < 0 || x > w || y > h) continue;
          ctx.moveTo(x - 5, y);
          ctx.lineTo(x + 5, y);
          ctx.moveTo(x, y - 5);
          ctx.lineTo(x, y + 5);
        }
        ctx.stroke();
      }

      // Scale bar, bottom left.
      const barArcsec = niceLength((w * 0.22) * scale);
      const bar = barArcsec / scale;
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, h - 16);
      ctx.lineTo(14 + bar, h - 16);
      ctx.stroke();
      ctx.font = `13px ${font}`;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      ctx.fillText(lengthLabel(barArcsec), 14, h - 21);

      // Compass, bottom right. North is up and east is left.
      const cx = w - 26;
      const cy = h - 22;
      const arm = 26;
      ctx.beginPath();
      ctx.moveTo(cx - arm, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy - arm);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillText("N", cx, cy - arm - 2);
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.fillText("E", cx - arm - 4, cy);
    }

    function resize() {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(wrap.clientWidth * ratio));
      const h = Math.max(1, Math.round(wrap.clientHeight * ratio));
      for (const target of [canvas, overlay]) {
        if (target.width !== w) target.width = w;
        if (target.height !== h) target.height = h;
      }
      schedule();
    }

    /** Sky offset [east, north] under a pointer position given in CSS pixels. */
    function skyAt(x: number, y: number, state: AppState): [number, number] {
      const scale = scaleOf(state);
      return [state.view.east - (x - wrap.clientWidth / 2) * scale, state.view.north - (y - wrap.clientHeight / 2) * scale];
    }

    function publishHover(event: PointerEvent) {
      const state = useStore.getState();
      if (!scene || !state.target) return;
      const box = wrap.getBoundingClientRect();
      const [east, north] = skyAt(event.clientX - box.left, event.clientY - box.top, state);
      const item = state.sequence[state.player.index];
      // For a solar system body the sky under the pointer depends on which frame is showing.
      const origin = state.target.moving && item ? state.frames[item.frameIds[0]].center ?? state.target : state.target;
      const position = offsetToSky(east, north, origin);
      let value: number | null = null;
      let wavelength: number | null = item?.wavelength ?? null;
      let bits = 0;
      const layer = scene.layer;
      const [a, b, c, d] = layer.m;
      const det = a * d - b * c;
      const se = east + (layer.shift?.[0] ?? 0);
      const sn = north + (layer.shift?.[1] ?? 0);
      const px = Math.round(layer.cx + (d * se - b * sn) / det);
      const py = Math.round(layer.cy + (-c * se + a * sn) / det);
      if (px >= 0 && py >= 0 && px < layer.nx && py < layer.ny) {
        if (scene.stack) {
          const v = scene.stack.image[py * layer.nx + px];
          value = Number.isFinite(v) ? v : null;
        } else if (item) {
          const frame = state.frames[item.frameIds[0]];
          const v = imageOf(frame.id)?.[py * layer.nx + px];
          value = v !== undefined && Number.isFinite(v) ? v : null;
          bits = getPixels(frame.id)?.flags?.[py * layer.nx + px] ?? 0;
          if (frame.dwl && frame.cx !== undefined && frame.cy !== undefined) {
            wavelength = frame.wavelength + frame.dwl[0] * (px - frame.cx) + frame.dwl[1] * (py - frame.cy);
          }
        }
      }
      actions.setHover({ ...position, value, wavelength, bits });
    }

    // Pointer handling: drag to pan, pinch or wheel to zoom, double click to reset.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let pressed: { x: number; y: number } | null = null;
    let sizing = false;

    /** Center (screen pixels) and radius of the measuring circle, or null when none is shown. */
    function circleOnScreen(state: AppState): { x: number; y: number; radius: number } | null {
      const { aperture, probe } = state.spectrum;
      if (!scene || (aperture === null && !probe)) return null;
      const [east, north] = probe ?? scene.marker;
      const scale = scaleOf(state);
      return {
        x: wrap.clientWidth / 2 - (east - state.view.east) / scale,
        y: wrap.clientHeight / 2 - (north - state.view.north) / scale,
        radius: (aperture ?? DEFAULT_APERTURE) / scale,
      };
    }

    /** True when the pointer is on the edge of the measuring circle. */
    function onCircleEdge(event: PointerEvent): boolean {
      const circle = circleOnScreen(useStore.getState());
      if (!circle) return false;
      const box = wrap.getBoundingClientRect();
      const distance = Math.hypot(event.clientX - box.left - circle.x, event.clientY - box.top - circle.y);
      return Math.abs(distance - circle.radius) <= 7;
    }

    function onDown(event: PointerEvent) {
      wrap.setPointerCapture(event.pointerId);
      if (onCircleEdge(event)) {
        // Dragging the circle's edge resizes it instead of moving the picture.
        sizing = true;
        return;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      pressed = { x: event.clientX, y: event.clientY };
      pinch = 0;
    }
    function onMove(event: PointerEvent) {
      if (sizing) {
        const state = useStore.getState();
        const circle = circleOnScreen(state);
        if (!circle) return;
        const box = wrap.getBoundingClientRect();
        const pixels = Math.hypot(event.clientX - box.left - circle.x, event.clientY - box.top - circle.y);
        actions.setSpectrum({ aperture: pixels * scaleOf(state) });
        return;
      }
      const last = pointers.get(event.pointerId);
      if (!last) {
        wrap.style.cursor = onCircleEdge(event) ? "ew-resize" : "crosshair";
        publishHover(event);
        return;
      }
      const state = useStore.getState();
      const scale = scaleOf(state);
      if (pointers.size === 1) {
        actions.setView({
          east: state.view.east + (event.clientX - last.x) * scale,
          north: state.view.north + (event.clientY - last.y) * scale,
        });
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [p, q] = [...pointers.values()];
        const spread = Math.hypot(p.x - q.x, p.y - q.y);
        if (pinch) actions.setView({ zoom: state.view.zoom * (spread / pinch) });
        pinch = spread;
      }
    }
    function onUp(event: PointerEvent) {
      if (sizing) {
        sizing = false;
        return;
      }
      const start = pressed;
      pressed = null;
      pointers.delete(event.pointerId);
      pinch = 0;
      // A press and release in one place is a click. See whether it landed on an object label.
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
      const box = wrap.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const hit = labels.find((entry) => Math.hypot(entry.x - x, entry.y - y) <= 14);
      if (hit) {
        actions.selectObject(hit.object, "images");
        return;
      }
      // A click on plain sky picks that spot, so the UI can offer to study it.
      const state = useStore.getState();
      if (!state.target || !scene) return;
      const [east, north] = skyAt(x, y, state);
      const item = state.sequence[state.player.index];
      const origin = state.target.moving && item ? state.frames[item.frameIds[0]].center ?? state.target : state.target;
      actions.pick(offsetToSky(east, north, origin), "images");
    }
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const state = useStore.getState();
      const box = wrap.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const [east, north] = skyAt(x, y, state);
      const zoom = Math.min(40, Math.max(0.5, state.view.zoom * Math.exp(-event.deltaY * 0.0015)));
      // Keep the sky point under the pointer where it is.
      const scale = state.fieldSize / (Math.min(wrap.clientWidth, wrap.clientHeight) * zoom);
      actions.setView({ zoom, east: east + (x - wrap.clientWidth / 2) * scale, north: north + (y - wrap.clientHeight / 2) * scale });
    }
    const onLeave = () => actions.setHover(null);
    const onDouble = () => actions.resetView();

    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("dblclick", onDouble);
    wrap.addEventListener("wheel", onWheel, { passive: false });

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();
    registerCapture({ renderStep });
    // Redraw on any change except those that do not touch the picture: the pointer readouts,
    // the search dropdown, the telescopes' live places, and the sky map moving about.
    // Of the map's state, only the picked place and the chosen object are drawn here.
    const unseen = new Set(["hover", "mapHover", "suggestions", "craftNow", "spacecraftNow", "map", "mapGoal", "blink", "summing"]);
    const unsubscribe = useStore.subscribe((state, before) => {
      const now = state as unknown as Record<string, unknown>;
      const then = before as unknown as Record<string, unknown>;
      const changed = Object.keys(now).some((key) => !unseen.has(key) && now[key] !== then[key]);
      if (!changed && state.map.picked === before.map.picked && state.map.selected === before.map.selected) return;
      schedule();
    });

    // A sum made in the background is drawn as soon as it is there.
    const stopSums = onSumReady(schedule);

    return () => {
      cancelAnimationFrame(raf);
      registerCapture(null);
      observer.disconnect();
      unsubscribe();
      stopSums();
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("dblclick", onDouble);
      wrap.removeEventListener("wheel", onWheel);
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", touchAction: "none", cursor: "crosshair" }}>
      <canvas ref={glRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {/* The older picture for blinking lies over the image and under the marks, so the marks stay put while the pictures swap. */}
      {blinkUsed && <BlinkLayer />}
      <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
      {failure && <p role="alert" style={{ position: "absolute", inset: 0, margin: "auto", height: "fit-content", textAlign: "center", padding: 16 }}>{failure}</p>}
    </div>
  );
}
