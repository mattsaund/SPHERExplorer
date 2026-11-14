// The frame viewer: a WebGL canvas for the image and a 2D canvas on top for the marker,
// compass, and scale bar. It fills its parent and carries no chrome of its own.
// Colors come from CSS variables on any ancestor: --frame-ink, --frame-marker, --frame-label, --frame-gaia, --frame-flag, --frame-empty.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef, useState } from "react";
import { offsetToSky, positionAt, skyOffset } from "./astro";
import { registerCapture } from "./capture";
import { sceneFor, type Scene } from "./layers";
import { getPixels, imageOf } from "./pixels";
import { FrameRenderer } from "./render/renderer";
import { actions, useStore, type AppState } from "./store";
import type { SequenceItem, SkyObject } from "./types";

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

function lengthLabel(arcsec: number): string {
  if (arcsec >= 3600) return `${arcsec / 3600}°`;
  if (arcsec >= 60) return `${arcsec / 60}′`;
  return `${arcsec}″`;
}

export function FrameView({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

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
    const schedule = () => {
      raf ||= requestAnimationFrame(draw);
    };

    /** Arcseconds per CSS pixel for the current view. */
    const scaleOf = (state: AppState) => state.fieldSize / (Math.min(wrap.clientWidth, wrap.clientHeight) * state.view.zoom || 1);

    function draw() {
      raf = 0;
      paint(useStore.getState().player.index);
    }

    /** Draw one step of the sequence: the image, then the overlay. */
    function paint(index: number) {
      const state = useStore.getState();
      if (state.session !== session) {
        // A new target. Old textures belong to other frames.
        renderer.clear();
        session = state.session;
      }
      const item = state.sequence[index];
      scene = item ? sceneFor(item, state) : null;
      const scale = scaleOf(state);
      const flag = cssColor(wrap, "--frame-flag", "#e5484d");
      const empty = cssColor(wrap, "--frame-empty", "#5b2a86");
      renderer.draw(scene?.layer ?? null, {
        center: [state.view.east, state.view.north],
        scale,
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

    /** A copy of one step for saving: image, overlay, and a caption strip underneath. */
    function renderStep(index: number): HTMLCanvasElement | null {
      const state = useStore.getState();
      const item = state.sequence[index];
      if (!item) return null;
      paint(index);
      const strip = 30;
      const ratio = canvas.width / (wrap.clientWidth || 1);
      const out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height + Math.round(strip * ratio);
      const pen = out.getContext("2d")!;
      pen.fillStyle = "#000000";
      pen.fillRect(0, 0, out.width, out.height);
      // The WebGL canvas must be copied in the same task it was drawn in.
      pen.drawImage(canvas, 0, 0);
      pen.drawImage(overlay, 0, 0);
      pen.fillStyle = "#ffffff";
      pen.font = `${Math.round(13 * ratio)}px ${getComputedStyle(wrap).fontFamily || "sans-serif"}`;
      pen.textBaseline = "middle";
      const name = state.target?.name ?? "";
      pen.fillText(`${name ? name + ". " : ""}${item.label}`, 10 * ratio, canvas.height + (strip * ratio) / 2);
      pen.textAlign = "right";
      pen.fillText("NASA SPHEREx. SPHERExplorer", out.width - 10 * ratio, canvas.height + (strip * ratio) / 2);
      // Put the live view back on screen.
      schedule();
      return out;
    }

    function drawOverlay(state: AppState, scale: number, item: SequenceItem | undefined) {
      const ratio = overlay.width / (wrap.clientWidth || 1);
      const ctx = overlay.getContext("2d")!;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
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

      // Known objects, moved to where they were at the time of the image on screen.
      labels = [];
      if (state.display.showObjects && state.target && item) {
        ctx.font = `12px ${font}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.lineWidth = 1.5;
        const following = scene.stack !== undefined && state.follow;
        for (const object of state.fieldObjects.slice(0, OBJECT_LABELS)) {
          const place = positionAt({ ra: object.ra, dec: object.dec, epoch: object.epoch, pmRa: object.pmRa ?? 0, pmDec: object.pmDec ?? 0 }, item.mjd);
          let [east, north] = skyOffset(place, state.target);
          // A sum that follows the target is drawn in the target's own frame.
          if (following) {
            const track = skyOffset(positionAt(state.target, item.mjd), state.target);
            east -= track[0];
            north -= track[1];
          }
          const x = w / 2 - (east - state.view.east) / scale;
          const y = h / 2 - (north - state.view.north) / scale;
          if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
          // The target already has its own marker. A second ring would hide a faint source.
          const markX = w / 2 - (scene.marker[0] - state.view.east) / scale;
          const markY = h / 2 - (scene.marker[1] - state.view.north) / scale;
          if (state.display.showMarker && Math.hypot(x - markX, y - markY) < 6) continue;
          ctx.strokeStyle = label;
          ctx.fillStyle = label;
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillText(object.name, x + 13, y);
          labels.push({ x, y, object });
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
    function onDown(event: PointerEvent) {
      wrap.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      pressed = { x: event.clientX, y: event.clientY };
      pinch = 0;
    }
    function onMove(event: PointerEvent) {
      const last = pointers.get(event.pointerId);
      if (!last) {
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
        actions.selectObject(hit.object);
        return;
      }
      // A click on plain sky picks that spot, so the UI can offer to study it.
      const state = useStore.getState();
      if (!state.target || !scene) return;
      const [east, north] = skyAt(x, y, state);
      const item = state.sequence[state.player.index];
      const origin = state.target.moving && item ? state.frames[item.frameIds[0]].center ?? state.target : state.target;
      actions.pick(offsetToSky(east, north, origin));
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
    // Redraw on any change except the pointer readout, which does not affect the picture.
    const unsubscribe = useStore.subscribe((state, before) => {
      if (state.hover !== before.hover && state.sequence === before.sequence && state.player === before.player && state.display === before.display && state.view === before.view && state.fieldObjects === before.fieldObjects && state.subtract === before.subtract && state.missions === before.missions) return;
      schedule();
    });

    return () => {
      cancelAnimationFrame(raf);
      registerCapture(null);
      observer.disconnect();
      unsubscribe();
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
      <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
      {failure && <p role="alert" style={{ position: "absolute", inset: 0, margin: "auto", height: "fit-content", textAlign: "center", padding: 16 }}>{failure}</p>}
    </div>
  );
}
