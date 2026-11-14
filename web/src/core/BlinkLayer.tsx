// The older picture used for blinking, laid exactly over the image viewer.
// It is a second, bare Aladin Lite view of a survey's tile set. It follows the image viewer's
// center and scale, so every star sits where it does in the SPHEREx image. It takes no clicks:
// the image viewer under it keeps handling the pointer.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef } from "react";
import { offsetToSky } from "./astro";
import { blinkPartner } from "./blink";
import { useStore, type AppState } from "./store";

/** The older picture for blinking, as a layer that fills the image viewer. */
export function BlinkLayer() {
  const hostRef = useRef<HTMLDivElement>(null);
  // On screen only at the moments the blink shows the older picture.
  const shown = useStore((s) => s.blink.on && s.blink.older);

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let A: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aladin: any = null;
    let tiles = "";
    let unsubscribe = () => {};
    let observer: ResizeObserver | null = null;

    /** Match the image viewer: same survey choice, same center, same width of sky. */
    function sync(state: AppState) {
      if (!aladin || !state.target || state.target.moving) return;
      const partner = blinkPartner(state);
      if (partner.url !== tiles) {
        aladin.setBaseImageLayer(A.HiPS(partner.url, { name: partner.name }));
        tiles = partner.url;
      }
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      // The image viewer fits the field to the shorter side of its box. See scaleOf in FrameView.
      const scale = state.fieldSize / (Math.min(width, height) * state.view.zoom || 1); // arcseconds per pixel
      const center = offsetToSky(state.view.east, state.view.north, state.target);
      aladin.setFoV((width * scale) / 3600);
      aladin.gotoRaDec(center.ra, center.dec);
    }

    (async () => {
      try {
        A = (await import("aladin-lite")).default;
        await A.init;
      } catch {
        return; // the sky map reports the same failure in words
      }
      if (disposed) return;
      const state = useStore.getState();
      const first = blinkPartner(state);
      tiles = first.url;
      aladin = A.aladin(host, {
        survey: first.url,
        // The image viewer shows the sky as a camera does, north up and east left.
        projection: "TAN",
        cooFrame: "ICRSd",
        fov: 0.1,
        target: state.target ? `${state.target.ra} ${state.target.dec}` : "0 0",
        // No usage reports to third parties, and none of Aladin's own controls.
        log: false,
        showReticle: false,
        showProjectionControl: false,
        showFullscreenControl: false,
        showLayersControl: false,
        showGotoControl: false,
        showZoomControl: false,
        showFrame: false,
        showCooLocation: false,
        showFov: false,
        showCooGrid: false,
        showCooGridControl: false,
        showSimbadPointerControl: false,
        showSettingsControl: false,
        showShareControl: false,
        showStatusBar: false,
        showContextMenu: false,
        showColorPickerControl: false,
        showSelectionModeControl: false,
      });
      sync(useStore.getState());
      unsubscribe = useStore.subscribe((next, before) => {
        if (next.view !== before.view || next.fieldSize !== before.fieldSize || next.target !== before.target || next.blink.choice !== before.blink.choice || next.blink.on !== before.blink.on || (next.blink.choice === "auto" && next.player.index !== before.player.index) || next.sequence !== before.sequence) sync(next);
      });
      observer = new ResizeObserver(() => sync(useStore.getState()));
      observer.observe(host);
    })();

    return () => {
      disposed = true;
      unsubscribe();
      observer?.disconnect();
      host.replaceChildren();
    };
  }, []);

  return <div ref={hostRef} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", visibility: shown ? "visible" : "hidden" }} />;
}
