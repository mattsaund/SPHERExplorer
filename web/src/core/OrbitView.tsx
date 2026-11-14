// A live world map of the telescopes behind the tool: where each one in Earth orbit is right
// now, the path of the one in focus, the observatories on the ground, and which side of the
// Earth is in daylight.
// Land outlines are Natural Earth data (public domain) from the world-atlas package.
// Colors come from CSS variables: --orbit-land, --orbit-sea, --orbit-night, --orbit-track,
// --orbit-craft, --orbit-site, --orbit-ink.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef } from "react";
import type { SatRec } from "satellite.js";
import { groundTrack, orbitModel, positionOf, subsolarPoint } from "./orbit";
import { fitCanvas } from "./plot";
import { actions, useStore } from "./store";
import type { SpacecraftNow, Telescope } from "./types";

type Ring = [number, number][];

interface Props {
  className?: string;
  /** Id of the telescope whose path is drawn. SPHEREx when left out. */
  focus?: string;
  /** Called with a telescope's id when its mark on the map is clicked. */
  onPick?: (id: string) => void;
}

/** How close a click must be to a mark to count, in CSS pixels. */
const PICK_RADIUS = 14;

/** The live world map of telescopes. `focus` gets its orbit track drawn, and `onPick` hears clicks on a telescope. */
export function OrbitView({ className, focus = "spherex", onPick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The drawing loop outlives a change of focus, so it reads these through refs.
  const focusRef = useRef(focus);
  const pickRef = useRef(onPick);
  const redraw = useRef<() => void>(() => {});
  focusRef.current = focus;
  pickRef.current = onPick;

  useEffect(() => {
    redraw.current();
  }, [focus]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let disposed = false;
    let land: Ring[] = [];
    // One orbit model per telescope in orbit, rebuilt only when its elements change.
    const models = new Map<string, { elements: unknown; model: SatRec | null }>();
    // Where each mark was last drawn, for clicks.
    let marks: { id: string; x: number; y: number }[] = [];
    actions.loadSpacecraft();

    // The land outline is fetched only when this view is on the page.
    Promise.all([import("topojson-client"), import("world-atlas/land-110m.json")]).then(([topo, atlas]) => {
      if (disposed) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const world = (atlas as any).default ?? atlas;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shape = topo.feature(world, world.objects.land) as any;
      const polygons = shape.features ? shape.features.flatMap((f: { geometry: { coordinates: Ring[][] } }) => f.geometry.coordinates) : shape.geometry.coordinates;
      land = polygons.map((polygon: Ring[]) => polygon[0]);
      draw();
    }, () => {});

    function color(name: string, fallback: string): string {
      return getComputedStyle(canvas).getPropertyValue(name).trim() || fallback;
    }

    /** The telescopes to draw. Before the list arrives, SPHEREx alone from its own elements. */
    function telescopes(): Telescope[] {
      const info = useStore.getState().spacecraft;
      if (!info) return [];
      if (info.telescopes?.length) return info.telescopes;
      return [{ id: "spherex", name: info.name, agency: "NASA", where: "orbit", use: "", note: "", elements: info.elements }];
    }

    function modelOf(telescope: Telescope): SatRec | null {
      const held = models.get(telescope.id);
      if (held && held.elements === telescope.elements) return held.model;
      const model = telescope.elements ? orbitModel(telescope.elements) : null;
      models.set(telescope.id, { elements: telescope.elements, model });
      return model;
    }

    function draw() {
      if (disposed) return;
      const { ctx, width, height } = fitCanvas(canvas);
      const now = new Date();
      // Plain rectangular map: longitude across, latitude up.
      const x = (longitude: number) => ((longitude + 180) / 360) * width;
      const y = (latitude: number) => ((90 - latitude) / 180) * height;

      ctx.fillStyle = color("--orbit-sea", "#0e2233");
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = color("--orbit-land", "#3d5a45");
      for (const ring of land) {
        ctx.beginPath();
        ring.forEach(([longitude, latitude], i) => (i ? ctx.lineTo(x(longitude), y(latitude)) : ctx.moveTo(x(longitude), y(latitude))));
        ctx.closePath();
        ctx.fill();
      }

      // Night side: for each longitude, the latitude where the Sun sits on the horizon.
      const sun = subsolarPoint(now);
      const tilt = (sun.latitude * Math.PI) / 180;
      ctx.fillStyle = color("--orbit-night", "rgba(0, 0, 0, 0.45)");
      ctx.beginPath();
      const dark = sun.latitude >= 0 ? height : 0; // the pole that is in darkness
      ctx.moveTo(0, dark);
      for (let px = 0; px <= width; px += 4) {
        const longitude = (px / width) * 360 - 180;
        const hour = ((longitude - sun.longitude) * Math.PI) / 180;
        const edge = Math.atan(-Math.cos(hour) / Math.tan(Math.abs(tilt) < 1e-3 ? 1e-3 : tilt));
        ctx.lineTo(px, y((edge * 180) / Math.PI));
      }
      ctx.lineTo(width, dark);
      ctx.closePath();
      ctx.fill();

      const list = telescopes();
      const chosen = focusRef.current;
      const ink = color("--orbit-ink", "#ffffff");
      const font = getComputedStyle(canvas).fontFamily || "sans-serif";
      marks = [];
      /** A name beside a mark, kept inside the map, with a dark edge so it reads over land and sea. */
      const label = (text: string, px: number, py: number, bold: boolean) => {
        ctx.font = `${bold ? "600 " : ""}12px ${font}`;
        ctx.textBaseline = "middle";
        const wide = ctx.measureText(text).width;
        const left = px + 10 + wide > width - 4;
        ctx.textAlign = left ? "right" : "left";
        const tx = left ? px - 10 : px + 10;
        const ty = Math.min(height - 8, Math.max(8, py));
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
        ctx.strokeText(text, tx, ty);
        ctx.fillStyle = ink;
        ctx.fillText(text, tx, ty);
      };

      // Observatories on the ground: small squares.
      const site = color("--orbit-site", "#9be8ff");
      for (const telescope of list) {
        if (telescope.where !== "ground" || telescope.latitude === undefined || telescope.longitude === undefined) continue;
        const px = x(telescope.longitude);
        const py = y(telescope.latitude);
        const picked = telescope.id === chosen;
        const half = picked ? 6 : 4;
        ctx.fillStyle = site;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;
        ctx.fillRect(px - half, py - half, 2 * half, 2 * half);
        ctx.strokeRect(px - half, py - half, 2 * half, 2 * half);
        if (picked) label(telescope.name, px, py, true);
        marks.push({ id: telescope.id, x: px, y: py });
      }

      // The path of the telescope in focus: the last half orbit faint, the next orbit and a half bright.
      const focused = list.find((telescope) => telescope.id === chosen && telescope.where === "orbit");
      const focusedModel = focused ? modelOf(focused) : null;
      if (focusedModel) {
        const period = (2 * Math.PI) / focusedModel.no;
        const strokes: [number, number, number][] = [[period / 2, 0, 0.35], [0, period * 1.5, 1]];
        ctx.strokeStyle = color("--orbit-track", "#ffd24a");
        ctx.lineWidth = 2;
        for (const [before, after, alpha] of strokes) {
          const track = groundTrack(focusedModel, now, before, after);
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          track.forEach(([longitude, latitude], i) => {
            // Lift the pen where the path wraps around the edge of the map.
            if (i && Math.abs(longitude - track[i - 1][0]) < 180) ctx.lineTo(x(longitude), y(latitude));
            else ctx.moveTo(x(longitude), y(latitude));
          });
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Every telescope in orbit: a dot where it is this second, with its name.
      const live: Record<string, SpacecraftNow> = {};
      for (const telescope of list) {
        if (telescope.where !== "orbit") continue;
        const model = modelOf(telescope);
        const at = model ? positionOf(model, now) : null;
        if (!at) continue;
        live[telescope.id] = at;
        const px = x(at.longitude);
        const py = y(at.latitude);
        const picked = telescope.id === chosen;
        ctx.fillStyle = color("--orbit-craft", "#ffffff");
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, picked ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        label(telescope.name, px, py, picked);
        marks.push({ id: telescope.id, x: px, y: py });
      }
      if (Object.keys(live).length) actions.craftNow(live);
    }
    redraw.current = draw;

    function onClick(event: MouseEvent) {
      if (!pickRef.current) return;
      const box = canvas.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      let best: { id: string; distance: number } | null = null;
      for (const mark of marks) {
        const distance = Math.hypot(mark.x - px, mark.y - py);
        if (distance <= PICK_RADIUS && (!best || distance < best.distance)) best = { id: mark.id, distance };
      }
      if (best) pickRef.current(best.id);
    }

    const timer = setInterval(draw, 1000);
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    canvas.addEventListener("click", onClick);
    const unsubscribe = useStore.subscribe((state, before) => {
      if (state.spacecraft !== before.spacecraft) draw();
    });
    draw();

    return () => {
      disposed = true;
      clearInterval(timer);
      observer.disconnect();
      canvas.removeEventListener("click", onClick);
      unsubscribe();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
      role="img"
      aria-label="World map showing where SPHEREx and the other telescopes are right now"
    />
  );
}
