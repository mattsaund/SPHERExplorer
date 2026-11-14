// The observation timeline: every image of the target as a dot, by time and wavelength.
// It shows how SPHEREx sweeps a field through all its colors on each visit.
// Click a dot to see that image. Colors come from the same CSS variables as the spectrum plot.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef } from "react";
import { fitCanvas, linearTicks, readTheme } from "./plot";
import { actions, useStore, type AppState } from "./store";
import type { Frame } from "./types";

const WL_MIN = 0.7;
const WL_MAX = 5.1;
const MARGIN = { left: 62, right: 14, top: 10, bottom: 26 };
const GAP = 14; // pixels between visit panels

interface Panel {
  season: number;
  start: number;
  end: number;
  x0: number;
  x1: number;
}

/** The timeline: every image as a dot by date and wavelength. A click on a dot jumps to that image. */
export function Timeline({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let raf = 0;
    let pointer: { x: number; y: number } | null = null;
    let hover: Frame | null = null;
    let drawn: { x: number; y: number; frame: Frame }[] = [];

    const schedule = () => {
      raf ||= requestAnimationFrame(draw);
    };

    function draw() {
      raf = 0;
      const state = useStore.getState();
      const { ctx, width, height } = fitCanvas(canvas);
      const theme = readTheme(canvas);
      const plotW = width - MARGIN.left - MARGIN.right;
      const plotH = height - MARGIN.top - MARGIN.bottom;
      const frames = state.frames;
      ctx.font = `12px ${theme.font}`;
      drawn = [];
      if (plotW < 40 || plotH < 30 || !frames.length) return;

      // One panel per visit, each stretched to its own duration. The months between visits are skipped.
      const panels: Panel[] = state.visits.map((visit) => ({ season: visit.season, start: visit.start, end: visit.end, x0: 0, x1: 0 }));
      if (!panels.length) return;
      const each = (plotW - GAP * (panels.length - 1)) / panels.length;
      panels.forEach((panel, i) => {
        panel.x0 = MARGIN.left + i * (each + GAP);
        panel.x1 = panel.x0 + each;
      });

      const yOf = (wl: number) => MARGIN.top + plotH * (1 - (wl - WL_MIN) / (WL_MAX - WL_MIN));
      const xOf = (frame: Frame) => {
        const panel = panels[frame.season];
        const span = Math.max(panel.end - panel.start, 0.5);
        return panel.x0 + 6 + ((frame.mjd - panel.start) / span) * (panel.x1 - panel.x0 - 12);
      };

      // Wavelength axis.
      ctx.fillStyle = theme.muted;
      ctx.strokeStyle = theme.grid;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const tick of linearTicks(1, 5, 4)) {
        const y = yOf(tick);
        ctx.fillText(`${tick} µm`, MARGIN.left - 8, y);
        ctx.beginPath();
        ctx.moveTo(MARGIN.left, y);
        ctx.lineTo(MARGIN.left + plotW, y);
        ctx.stroke();
      }

      // Panels and their month labels.
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const panel of panels) {
        ctx.strokeStyle = theme.muted;
        ctx.strokeRect(panel.x0 + 0.5, MARGIN.top + 0.5, panel.x1 - panel.x0, plotH);
        const days = Math.max(1, Math.round(panel.end - panel.start));
        ctx.fillStyle = theme.ink;
        ctx.fillText(`${state.visits[panel.season].label}, ${days} ${days === 1 ? "day" : "days"}`, (panel.x0 + panel.x1) / 2, MARGIN.top + plotH + 6);
      }

      // The current step's members.
      const item = state.sequence[state.player.index];
      const current = new Set(item?.frameIds ?? []);

      for (const frame of frames) {
        if (!Number.isFinite(frame.wavelength)) continue;
        const x = xOf(frame);
        const y = yOf(frame.wavelength);
        drawn.push({ x, y, frame });
        if (frame.status === "failed" || frame.status === "outside") continue;
        ctx.globalAlpha = frame.status === "ready" ? 0.85 : 0.35;
        ctx.fillStyle = frame.status === "ready" ? theme.series[(frame.detector - 1) % theme.series.length] : theme.muted;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = theme.cursor;
      ctx.lineWidth = 2;
      for (const d of drawn) {
        if (!current.has(d.frame.id)) continue;
        ctx.beginPath();
        ctx.arc(d.x, d.y, current.size === 1 ? 6 : 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.lineWidth = 1;

      hover = null;
      if (pointer) {
        let best = 14 * 14;
        for (const d of drawn) {
          if (d.frame.status !== "ready") continue;
          const distance = (d.x - pointer.x) ** 2 + (d.y - pointer.y) ** 2;
          if (distance < best) {
            best = distance;
            hover = d.frame;
          }
        }
      }
      canvas.style.cursor = hover ? "pointer" : "default";
      if (hover) {
        const d = drawn.find((entry) => entry.frame === hover)!;
        ctx.strokeStyle = theme.ink;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
        ctx.stroke();
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
      if (hover) actions.showFrame(hover.id);
    }

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);
    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);
    const unsubscribe = useStore.subscribe((state: AppState, before: AppState) => {
      if (state.frames !== before.frames || state.visits !== before.visits || state.player.index !== before.player.index || state.sequence !== before.sequence) schedule();
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
      aria-label="Timeline of the images of the target, by date and wavelength"
    />
  );
}
