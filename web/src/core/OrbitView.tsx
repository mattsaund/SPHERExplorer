// A live world map showing where the SPHEREx spacecraft is: its path over the ground, the
// spot directly below it right now, and which side of the Earth is in daylight.
// Land outlines are Natural Earth data (public domain) from the world-atlas package.
// Colors come from CSS variables: --orbit-land, --orbit-sea, --orbit-night, --orbit-track, --orbit-craft.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef } from "react";
import type { SatRec } from "satellite.js";
import { groundTrack, orbitModel, positionOf, subsolarPoint } from "./orbit";
import { fitCanvas } from "./plot";
import { actions, useStore } from "./store";

type Ring = [number, number][];

export function OrbitView({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let disposed = false;
    let land: Ring[] = [];
    let model: SatRec | null = null;
    let modelFor: unknown = null;
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

    function draw() {
      if (disposed) return;
      const { ctx, width, height } = fitCanvas(canvas);
      const info = useStore.getState().spacecraft;
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

      const elements = info?.elements ?? null;
      if (elements !== modelFor) {
        model = elements ? orbitModel(elements) : null;
        modelFor = elements;
      }
      if (!model) return;

      // Path: the last half orbit faint, the next orbit and a half bright.
      const period = (2 * Math.PI) / model.no;
      const strokes: [number, number, number][] = [[period / 2, 0, 0.35], [0, period * 1.5, 1]];
      ctx.strokeStyle = color("--orbit-track", "#ffd24a");
      ctx.lineWidth = 2;
      for (const [before, after, alpha] of strokes) {
        const track = groundTrack(model, now, before, after);
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

      const at = positionOf(model, now);
      if (!at) return;
      actions.spacecraftNow(at);
      ctx.fillStyle = color("--orbit-craft", "#ffffff");
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x(at.longitude), y(at.latitude), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const timer = setInterval(draw, 1000);
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    const unsubscribe = useStore.subscribe((state, before) => {
      if (state.spacecraft !== before.spacecraft) draw();
    });
    draw();

    return () => {
      disposed = true;
      clearInterval(timer);
      observer.disconnect();
      unsubscribe();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
      role="img"
      aria-label="World map showing where the SPHEREx spacecraft is right now"
    />
  );
}
