// The spectrum plot: brightness of the target against wavelength, built from the frames
// as they arrive. Click a point to see the image it came from.
// Colors come from CSS variables: --plot-ink, --plot-muted, --plot-grid, --plot-cursor,
// --plot-feature, and --plot-series-1 to --plot-series-6.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef } from "react";
import { formatDate } from "./astro";
import { LINE_FAMILIES } from "./lines";
import { fitCanvas, linearTicks, logTicks, quantile, readTheme } from "./plot";
import { binSpectrum, formatFlux, spectrumOf, type SpectrumBin, type SpectrumPoint } from "./spectrum";
import { actions, useStore, type AppState } from "./store";
import { surveyPoints } from "./surveys";
import type { Frame } from "./types";

const WL_MIN = 0.7;
const WL_MAX = 5.1;
const MARGIN = { left: 62, right: 14, top: 30, bottom: 40 };

export function SpectrumPlot({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let raf = 0;
    // Spectrum data is rebuilt only when the frames change.
    let source: Frame[] | null = null;
    let points: SpectrumPoint[] = [];
    let hover: SpectrumPoint | null = null;
    let pointer: { x: number; y: number } | null = null;
    // Screen positions of the points drawn last, for hit testing.
    let drawn: { x: number; y: number; point: SpectrumPoint }[] = [];

    const schedule = () => {
      raf ||= requestAnimationFrame(draw);
    };

    function draw() {
      raf = 0;
      const state = useStore.getState();
      if (state.frames !== source) {
        source = state.frames;
        points = spectrumOf(state.frames, state.meta?.badMask ?? 0);
      }
      const { ctx, width, height } = fitCanvas(canvas);
      const theme = readTheme(canvas);
      const settings = state.spectrum;
      const plotW = width - MARGIN.left - MARGIN.right;
      const plotH = height - MARGIN.top - MARGIN.bottom;
      if (plotW < 40 || plotH < 40) return;

      const good = points.filter((p) => p.good);
      const bins = binSpectrum(points, settings.perVisit);
      const basis = (bins.length ? bins.map((b) => b.flux) : good.map((p) => p.flux)).filter(Number.isFinite);

      // Brightness range from the averages, with head room. Outliers don't set the scale.
      let yMin: number;
      let yMax: number;
      const positive = basis.filter((v) => v > 0);
      const useLog = settings.log && positive.length > 2;
      if (useLog) {
        yMin = Math.max(quantile(positive, 0.02) / 2, quantile(positive, 0.98) / 1e4);
        yMax = quantile(positive, 0.98) * 2;
      } else {
        const top = basis.length ? quantile(basis, 0.98) : 1;
        const bottom = basis.length ? quantile(basis, 0.02) : 0;
        yMax = top + Math.max(Math.abs(top) * 0.18, 1e-9);
        yMin = Math.min(0, bottom - Math.abs(top) * 0.05);
      }
      if (!(yMax > yMin)) yMax = yMin + 1;

      const xOf = (wl: number) => MARGIN.left + ((wl - WL_MIN) / (WL_MAX - WL_MIN)) * plotW;
      const yOf = (flux: number) =>
        useLog
          ? MARGIN.top + plotH * (1 - (Math.log10(Math.max(flux, yMin * 1e-3)) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin)))
          : MARGIN.top + plotH * (1 - (flux - yMin) / (yMax - yMin));
      const clampY = (y: number) => Math.min(MARGIN.top + plotH, Math.max(MARGIN.top, y));

      ctx.font = `12px ${theme.font}`;
      ctx.lineWidth = 1;

      // Detector bands: a faint divider and number for each of the six arrays.
      if (state.meta) {
        ctx.fillStyle = theme.muted;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        for (const [name, range] of Object.entries(state.meta.detectors)) {
          const left = xOf(range.min);
          ctx.strokeStyle = theme.grid;
          ctx.beginPath();
          ctx.moveTo(left, MARGIN.top);
          ctx.lineTo(left, MARGIN.top + plotH);
          ctx.stroke();
          ctx.fillText(`Detector ${name}`, (left + xOf(range.max)) / 2, MARGIN.top + plotH - 4);
        }
      }

      // Axes and grid.
      ctx.strokeStyle = theme.grid;
      ctx.fillStyle = theme.muted;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const yTicks = useLog ? logTicks(yMin, yMax) : linearTicks(yMin, yMax, 5);
      for (const tick of yTicks) {
        const y = yOf(tick);
        ctx.beginPath();
        ctx.moveTo(MARGIN.left, y);
        ctx.lineTo(MARGIN.left + plotW, y);
        ctx.stroke();
        ctx.fillText(formatFlux(tick).replace(/\.0+(?= )/, ""), MARGIN.left - 8, y);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const tick of linearTicks(WL_MIN, WL_MAX, 9)) {
        if (tick < WL_MIN || tick > WL_MAX) continue;
        ctx.fillText(tick.toFixed(1), xOf(tick), MARGIN.top + plotH + 6);
      }
      ctx.fillStyle = theme.ink;
      ctx.fillText("Wavelength (µm)", MARGIN.left + plotW / 2, height - 16);
      ctx.strokeStyle = theme.muted;
      ctx.strokeRect(MARGIN.left + 0.5, MARGIN.top + 0.5, plotW, plotH);

      // Spectral feature marks, shifted by the chosen redshift.
      const stretch = 1 + settings.redshift;
      ctx.textBaseline = "bottom";
      for (const family of LINE_FAMILIES) {
        if (!settings.families.includes(family.id)) continue;
        let lastLabel = -100;
        for (const feature of family.features) {
          const wl = feature.wavelength * stretch;
          if (wl < WL_MIN || wl > WL_MAX) continue;
          const x = xOf(wl);
          if (feature.width) {
            const half = (feature.width * stretch) / 2;
            ctx.fillStyle = theme.feature;
            ctx.globalAlpha = 0.14;
            ctx.fillRect(xOf(wl - half), MARGIN.top, xOf(wl + half) - xOf(wl - half), plotH);
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = theme.feature;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x, MARGIN.top);
          ctx.lineTo(x, MARGIN.top + plotH);
          ctx.stroke();
          ctx.setLineDash([]);
          // Skip a label that would run into the one before it.
          if (x - lastLabel > 34) {
            ctx.fillStyle = theme.feature;
            ctx.textAlign = "center";
            ctx.fillText(feature.label, x, MARGIN.top - 3);
            lastLabel = x;
          }
        }
      }

      // Clip the data to the plot area.
      ctx.save();
      ctx.beginPath();
      ctx.rect(MARGIN.left, MARGIN.top, plotW, plotH);
      ctx.clip();

      drawn = [];
      const colorOf = (season: number) => theme.series[Math.max(0, season) % theme.series.length];
      if (settings.showPoints) {
        for (const p of points) {
          const x = xOf(p.wavelength);
          const y = yOf(p.flux);
          drawn.push({ x, y: clampY(y), point: p });
          ctx.globalAlpha = p.good ? 0.45 : 0.25;
          ctx.fillStyle = p.good ? colorOf(settings.perVisit ? p.season : 0) : theme.muted;
          ctx.beginPath();
          ctx.arc(x, y, p.good ? 2.2 : 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        for (const p of good) drawn.push({ x: xOf(p.wavelength), y: clampY(yOf(p.flux)), point: p });
      }

      // Channel averages, one line per visit (or one for all).
      const bySeason = new Map<number, SpectrumBin[]>();
      for (const bin of bins) {
        const list = bySeason.get(bin.season);
        if (list) list.push(bin);
        else bySeason.set(bin.season, [bin]);
      }
      for (const [season, list] of bySeason) {
        const color = colorOf(season);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let previous: SpectrumBin | null = null;
        for (const bin of list) {
          const x = xOf(bin.wavelength);
          const y = yOf(bin.flux);
          // Break the line across the gap between detectors and across missing channels.
          if (previous && bin.channel - previous.channel <= 2) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          previous = bin;
        }
        ctx.stroke();
        ctx.lineWidth = 1;
        for (const bin of list) {
          const x = xOf(bin.wavelength);
          ctx.beginPath();
          ctx.moveTo(x, yOf(bin.flux + bin.err));
          ctx.lineTo(x, yOf(bin.flux - bin.err));
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, yOf(bin.flux), 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // The same target as 2MASS and WISE saw it: one square per band, with a bar for the band's width.
      if (settings.showSurveys) {
        const points = surveyPoints(state.target, state.missions);
        ctx.font = `11px ${theme.font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        for (const point of points) {
          const x = xOf(point.wavelength);
          const y = yOf(point.flux);
          ctx.strokeStyle = theme.ink;
          ctx.fillStyle = theme.ink;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(xOf(point.wavelength - point.width / 2), y);
          ctx.lineTo(xOf(point.wavelength + point.width / 2), y);
          ctx.stroke();
          ctx.strokeRect(x - 4.5, y - 4.5, 9, 9);
          ctx.fillText(`${point.survey} ${point.band}`, x, y - 8);
        }
        ctx.font = `12px ${theme.font}`;
      }

      // The wavelength of the image on screen.
      const item = state.sequence[state.player.index];
      if (item && Number.isFinite(item.wavelength) && item.frameIds.length === 1) {
        ctx.strokeStyle = theme.cursor;
        ctx.lineWidth = 1.5;
        const x = xOf(item.wavelength);
        ctx.beginPath();
        ctx.moveTo(x, MARGIN.top);
        ctx.lineTo(x, MARGIN.top + plotH);
        ctx.stroke();
      }
      ctx.restore();

      // Legend for visits.
      if (settings.perVisit && bySeason.size > 1) {
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        let x = MARGIN.left + 8;
        for (const season of [...bySeason.keys()].sort((a, b) => a - b)) {
          const label = state.visits[season]?.label ?? `Visit ${season + 1}`;
          ctx.fillStyle = colorOf(season);
          ctx.fillRect(x, MARGIN.top + 10, 12, 3);
          ctx.fillStyle = theme.ink;
          ctx.fillText(label, x + 16, MARGIN.top + 12);
          x += ctx.measureText(label).width + 34;
        }
      }

      // Empty state.
      if (!points.length) {
        ctx.fillStyle = theme.muted;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const waiting = state.framesState === "loading" || state.targetState === "loading";
        ctx.fillText(waiting ? "Measuring brightness in each image…" : "No brightness measurements yet.", MARGIN.left + plotW / 2, MARGIN.top + plotH / 2);
      }

      // Pointer readout.
      hover = null;
      if (pointer) {
        let best = 18 * 18;
        for (const d of drawn) {
          const distance = (d.x - pointer.x) ** 2 + (d.y - pointer.y) ** 2;
          if (distance < best) {
            best = distance;
            hover = d.point;
          }
        }
      }
      if (hover) {
        const x = xOf(hover.wavelength);
        const y = clampY(yOf(hover.flux));
        ctx.strokeStyle = theme.cursor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
        const lines = [
          `${hover.wavelength.toFixed(3)} µm, ${formatDate(hover.mjd)}`,
          `${formatFlux(hover.flux)} ± ${formatFlux(hover.err)}${hover.good ? "" : " (suspect)"}`,
          "Click to see this image",
        ];
        const boxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
        const boxH = lines.length * 17 + 10;
        const bx = Math.min(width - boxW - 4, Math.max(4, x + 12));
        const by = Math.min(height - boxH - 4, Math.max(4, y - boxH - 10));
        ctx.fillStyle = "rgba(10,12,14,0.92)";
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeStyle = theme.muted;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, boxW, boxH);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        lines.forEach((line, i) => ctx.fillText(line, bx + 8, by + 6 + i * 17));
      }
      canvas.style.cursor = hover ? "pointer" : "default";
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
      if (state.frames !== before.frames || state.spectrum !== before.spectrum || state.player.index !== before.player.index || state.sequence !== before.sequence || state.meta !== before.meta || state.framesState !== before.framesState || state.missions !== before.missions) schedule();
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
      aria-label="Spectrum of the target: brightness against wavelength"
    />
  );
}
