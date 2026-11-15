// Small helpers shared by the canvas plots: sizing, theme colors, and tick placement.
// Written with Claude Code (Anthropic) assistance.

/** Colors and fonts for plots, read from CSS variables so the UI theme controls them. */
export interface PlotTheme {
  ink: string;
  muted: string;
  grid: string;
  cursor: string;
  feature: string;
  series: string[];
  font: string;
}

// Okabe-Ito colors: distinct for people with color-vision deficiency.
const SERIES = ["#56b4e9", "#e69f00", "#009e73", "#cc79a7", "#f0e442", "#d55e00"];

/** The plot colors the page sets through CSS variables, with defaults for any it leaves out. */
export function readTheme(element: HTMLElement): PlotTheme {
  const style = getComputedStyle(element);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    ink: pick("--plot-ink", "#e8ebee"),
    muted: pick("--plot-muted", "#9aa4ae"),
    grid: pick("--plot-grid", "rgba(255,255,255,0.10)"),
    cursor: pick("--plot-cursor", "#ffd24a"),
    feature: pick("--plot-feature", "#b9a7ff"),
    series: SERIES.map((color, i) => pick(`--plot-series-${i + 1}`, color)),
    font: style.fontFamily || "sans-serif",
  };
}

/** Match a canvas's drawing buffer to its CSS size. Returns the CSS size and a ready 2D context. */
export function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; width: number; height: number } {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const w = Math.max(1, Math.round(width * ratio));
  const h = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

/** Round tick values covering [min, max], about `count` of them. */
export function linearTicks(min: number, max: number, count: number): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}

/** Powers of ten inside [min, max], for a log axis. */
export function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  for (let e = Math.ceil(Math.log10(min)); e <= Math.floor(Math.log10(max)); e++) ticks.push(10 ** e);
  return ticks;
}

/** Value at a quantile (0 to 1) of an unsorted list. */
export function quantile(values: number[], q: number): number {
  if (!values.length) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}
