// Layout state for the full-screen shell: what fills the stage, and which panels are open.
// This is about the page only. The engine knows nothing of it.
// Written with Claude Code (Anthropic) assistance.
import { create } from "zustand";

/** What fills the stage: the sky map, the image viewer, or both side by side. */
export type StageMode = "map" | "images" | "both";

/** The tabs of the tray, the wide panel above the bottom bar. */
export type TrayTab = "timeline" | "spectrum" | "brightness" | "changes" | "motion" | "telescopes" | "spacecraft" | "about";

export interface LayoutState {
  stage: StageMode;
  /** True when the tools panel on the right is open. */
  dock: boolean;
  /** The open tray tab, or null when the tray is closed. */
  tray: TrayTab | null;
  /** Height of the open tray in CSS pixels. */
  trayHeight: number;
  /** A short message shown for a moment, such as "Link copied". */
  toast: string | null;
}

/** Wide enough to keep the tools panel open beside the stage. */
const ROOMY = 1180;
const width = () => (typeof window === "undefined" ? 1280 : window.innerWidth);
const height = () => (typeof window === "undefined" ? 800 : window.innerHeight);

export const useLayout = create<LayoutState>(() => ({
  stage: "map",
  dock: width() >= ROOMY,
  tray: null,
  trayHeight: Math.round(Math.min(320, height() * 0.32)),
  toast: null,
}));

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const layout = {
  setStage(stage: StageMode): void {
    useLayout.setState({ stage });
  },
  toggleDock(): void {
    useLayout.setState((state) => ({ dock: !state.dock }));
  },
  closeDock(): void {
    useLayout.setState({ dock: false });
  },
  /** Open a tray tab. Choosing the open tab again closes the tray. */
  toggleTray(tab: TrayTab): void {
    useLayout.setState((state) => ({ tray: state.tray === tab ? null : tab }));
  },
  openTray(tab: TrayTab): void {
    useLayout.setState({ tray: tab });
  },
  closeTray(): void {
    useLayout.setState({ tray: null });
  },
  setTrayHeight(pixels: number): void {
    useLayout.setState({ trayHeight: Math.round(Math.min(height() * 0.7, Math.max(160, pixels))) });
  },
  /** Show a short message for a moment. */
  say(text: string): void {
    if (toastTimer) clearTimeout(toastTimer);
    useLayout.setState({ toast: text });
    toastTimer = setTimeout(() => useLayout.setState({ toast: null }), 2600);
  },
};

/**
 * Put text on the clipboard and say so. Browsers only offer the modern clipboard on secure
 * pages, so a plain http address on a local network falls back to the older way.
 */
export async function copyText(text: string, done: string): Promise<void> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      const holder = document.createElement("textarea");
      holder.value = text;
      holder.style.position = "fixed";
      holder.style.opacity = "0";
      document.body.appendChild(holder);
      holder.select();
      const copied = document.execCommand("copy");
      holder.remove();
      if (!copied) throw new Error("copy refused");
    }
    layout.say(done);
  } catch {
    layout.say("Copying is blocked in this browser. Use the address bar instead.");
  }
}
