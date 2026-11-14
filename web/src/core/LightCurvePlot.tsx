// The brightness-over-time plot. Each point is one image, shown as the target's brightness
// relative to its own average at that wavelength. A line across each visit shows the visit's average.
// Colors come from the same CSS variables as the spectrum plot.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef } from "react";
import { formatDate } from "./astro";
import { formatChange, lightCurve, type LightCurve, type LightPoint } from "./lightcurve";
import { fitCanvas, linearTicks, quantile, readTheme } from "./plot";
import { currentSpectrum } from "./measure";
import { actions, useStore, type AppState } from "./store";

const MARGIN = { left: 62, right: 14, top: 14, bottom: 26 };
const GAP = 14;

/** The brightness-over-time plot. It redraws when the measurements or the size of its box change. */
export function LightCurvePlot({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let raf = 0;
    let source: unknown = null;
    let curve: LightCurve = { points: [], visits: [] };
    let pointer: { x: number; y: number } | null = null;
    let hover: LightPoint | null = null;
    let drawn: { x: number; y: number; point: LightPoint }[] = [];

    const schedule = () => {
      raf ||= requestAnimationFrame(draw);
    };

    function draw() {
      raf = 0;
      const state = useStore.getState();
      const spectrum = currentSpectrum(state);
      if (spectrum !== source) {
        source = spectrum;
        curve = lightCurve(spectrum);
      }
      const { ctx, width, height } = fitCanvas(canvas);
      const theme = readTheme(canvas);
      const plotW = width - MARGIN.left - MARGIN.right;
      const plotH = height - MARGIN.top - MARGIN.bottom;
      ctx.font = `12px ${theme.font}`;
      drawn = [];
      if (plotW < 40 || plotH < 40) return;

      const visits = state.visits;
      if (!curve.points.length || !visits.length) {
        ctx.fillStyle = theme.muted;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const waiting = state.framesState === "loading" || state.targetState === "loading";
        const text = waiting ? "Measuring brightness in each image…" : visits.length < 2 ? "Brightness changes need at least two visits." : "No usable brightness measurements.";
        ctx.fillText(text, MARGIN.left + plotW / 2, MARGIN.top + plotH / 2);
        return;
      }

      // Symmetric range around 1 that holds nearly all points and every visit average.
      const spread = Math.max(
        quantile(curve.points.map((p) => Math.abs(p.ratio - 1)), 0.97),
        ...curve.visits.map((v) => Math.abs(v.ratio - 1) + v.err),
        0.02,
      ) * 1.25;
      const yMin = 1 - spread;
      const yMax = 1 + spread;
      const yOf = (ratio: number) => MARGIN.top + plotH * (1 - (ratio - yMin) / (yMax - yMin));

      const each = (plotW - GAP * (visits.length - 1)) / visits.length;
      const x0Of = (season: number) => MARGIN.left + season * (each + GAP);
      const xOf = (p: { season: number; mjd: number }) => {
        const visit = visits[p.season];
        const span = Math.max(visit.end - visit.start, 0.5);
        return x0Of(p.season) + 6 + ((p.mjd - visit.start) / span) * (each - 12);
      };

      // Axis: percent change from the usual brightness.
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const tick of linearTicks(yMin, yMax, 5)) {
        const y = yOf(tick);
        ctx.strokeStyle = tick === 1 ? theme.muted : theme.grid;
        ctx.beginPath();
        ctx.moveTo(MARGIN.left, y);
        ctx.lineTo(MARGIN.left + plotW, y);
        ctx.stroke();
        ctx.fillStyle = theme.muted;
        ctx.fillText(tick === 1 ? "usual" : formatChange(tick).replace(".0", ""), MARGIN.left - 8, y);
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const visit of visits) {
        ctx.strokeStyle = theme.muted;
        ctx.strokeRect(x0Of(visit.season) + 0.5, MARGIN.top + 0.5, each, plotH);
        ctx.fillStyle = theme.ink;
        ctx.fillText(visit.label, x0Of(visit.season) + each / 2, MARGIN.top + plotH + 6);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(MARGIN.left, MARGIN.top, plotW, plotH);
      ctx.clip();
      for (const p of curve.points) {
        const x = xOf(p);
        const y = yOf(p.ratio);
        drawn.push({ x, y: Math.min(MARGIN.top + plotH, Math.max(MARGIN.top, y)), point: p });
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = theme.series[(p.detector - 1) % theme.series.length];
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Visit averages: a band for the uncertainty, a line for the value, and the change in words.
      ctx.textBaseline = "bottom";
      for (const visit of curve.visits) {
        const left = x0Of(visit.season) + 3;
        const y = yOf(visit.ratio);
        ctx.fillStyle = theme.cursor;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(left, yOf(visit.ratio + visit.err), each - 6, Math.max(1, yOf(visit.ratio - visit.err) - yOf(visit.ratio + visit.err)));
        ctx.globalAlpha = 1;
        ctx.strokeStyle = theme.cursor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + each - 6, y);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = theme.ink;
        ctx.textAlign = "center";
        ctx.fillText(`${formatChange(visit.ratio)} ± ${(visit.err * 100).toFixed(1)}`, left + each / 2, Math.max(MARGIN.top + 16, y - 6));
      }

      // The image on screen.
      const item = state.sequence[state.player.index];
      const current = new Set(item?.frameIds ?? []);
      ctx.strokeStyle = theme.ink;
      ctx.lineWidth = 2;
      for (const d of drawn) {
        if (current.size !== 1 || !current.has(d.point.frameId)) continue;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      hover = null;
      if (pointer) {
        let best = 16 * 16;
        for (const d of drawn) {
          const distance = (d.x - pointer.x) ** 2 + (d.y - pointer.y) ** 2;
          if (distance < best) {
            best = distance;
            hover = d.point;
          }
        }
      }
      canvas.style.cursor = hover ? "pointer" : "default";
      if (hover) {
        const d = drawn.find((entry) => entry.point === hover)!;
        const lines = [`${formatDate(hover.mjd)}, ${hover.wavelength.toFixed(2)} µm`, `${formatChange(hover.ratio)} ± ${(hover.err * 100).toFixed(1)} from usual`, "Click to see this image"];
        const boxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
        const boxH = lines.length * 17 + 10;
        const bx = Math.min(width - boxW - 4, Math.max(4, d.x + 12));
        const by = Math.min(height - boxH - 4, Math.max(4, d.y - boxH - 10));
        ctx.fillStyle = "rgba(10,12,14,0.92)";
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeStyle = theme.muted;
        ctx.strokeRect(bx + 0.5, by + 0.5, boxW, boxH);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        lines.forEach((line, i) => ctx.fillText(line, bx + 8, by + 6 + i * 17));
      }
    }

    function onMove(event: PointerEvent) {
      const box = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
      schedule();
    }
    function onLeave() {
      pointer = null;
      schedule();
    }
    function onClick() {
      if (hover) actions.showFrame(hover.frameId);
    }

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);
    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);
    const unsubscribe = useStore.subscribe((state: AppState, before: AppState) => {
      if (state.frames !== before.frames || state.visits !== before.visits || state.player.index !== before.player.index || state.sequence !== before.sequence || state.framesState !== before.framesState || state.spectrum !== before.spectrum) schedule();
    });
    schedule();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      unsubscribe();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "manipulation" }}
      role="img"
      aria-label="Brightness of the target over time, relative to its average"
    />
  );
}
