// The sky map: a pannable, zoomable view of the whole sky with clickable labels for known objects.
// Built on Aladin Lite (CDS, Strasbourg), loaded on demand. All of Aladin's own buttons are
// switched off, so the UI supplies the controls through actions.setMap and friends.
// Colors come from CSS variables: --map-label, --map-marker, --map-field.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef } from "react";
import { getObjects } from "./api";
import { SKY_LAYERS } from "./skyLayers";
import { actions, useStore, type AppState } from "./store";
import type { SkyObject } from "./types";

/** How many objects to ask for, and how many of those get a text label. */
const OBJECT_LIMIT = 160;
const LABEL_LIMIT = 45;
/** Wait this long after the view stops moving before asking for objects. */
const SETTLE_MS = 450;
const LIGHT_SPEED = 299792458; // meters per second

function cssVariable(element: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

export function SkyMap({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let A: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aladin: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let layer: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let labeled: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let unlabeled: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let marks: any = null;
    let settle: ReturnType<typeof setTimeout> | null = null;
    let request: AbortController | null = null;
    let lastObjectClick = 0;
    let applied: Partial<AppState["map"]> & { goal?: number; target?: unknown; fieldSize?: number } = {};

    /** Put a layer on the map and select its channel when it is the SPHEREx cube. */
    function showLayer(id: string) {
      const spec = SKY_LAYERS.find((entry) => entry.id === id) ?? SKY_LAYERS[0];
      layer = A.HiPS(spec.url, { name: spec.name });
      aladin.setBaseImageLayer(layer);
      if (spec.cube) channelWhenReady(layer);
    }

    /** A cube accepts a channel only after its properties have loaded. Wait for that, then apply. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function channelWhenReady(waiting: any, tries = 40) {
      if (disposed || waiting !== layer) return;
      if (waiting.added && waiting.cubeDepth) setChannel(useStore.getState().map.channel);
      else if (tries > 0) setTimeout(() => channelWhenReady(waiting, tries - 1), 250);
    }

    /**
     * Show one channel of the SPHEREx cube. Aladin picks a cube frame by frequency, spreading the
     * frames evenly in frequency between the cube's limits. Aiming at the middle of frame k's
     * slot selects tile k, which is channel k in ascending wavelength.
     */
    function setChannel(channel: number) {
      try {
        const depth = layer?.cubeDepth || 102;
        const low = LIGHT_SPEED / (layer?.emMax || 5.009e-6);
        const high = LIGHT_SPEED / (layer?.emMin || 7.43e-7);
        layer?.setFrequency?.({ value: low + ((channel + 0.5) / depth) * (high - low), unit: "Hz" });
      } catch {
        // The cube is still loading its properties. The next change will apply.
      }
    }

    /** Ask the server for the best-known objects in view. */
    function loadObjects() {
      if (!aladin || disposed) return;
      const state = useStore.getState();
      if (!state.map.labels) return;
      const [ra, dec] = aladin.getRaDec();
      const [fovX, fovY] = aladin.getFov();
      // Radius that covers the view. 90 degrees or more asks for the whole sky.
      const radius = Math.min(180, (Math.max(fovX, fovY || fovX) / 2) * 1.15);
      request?.abort();
      request = new AbortController();
      actions.mapReport({ objectsState: "loading" });
      getObjects(ra, dec, radius, OBJECT_LIMIT, request.signal).then(
        (objects) => {
          if (disposed) return;
          actions.mapReport({ objects, objectsState: "ready" });
          drawObjects(objects);
        },
        (error) => {
          if ((error as Error).name !== "AbortError") actions.mapReport({ objectsState: "failed" });
        },
      );
    }

    function drawObjects(objects: SkyObject[]) {
      if (!aladin) return;
      const toSource = (object: SkyObject) => A.source(object.ra, object.dec, { name: object.name, object });
      labeled.removeAll();
      unlabeled.removeAll();
      labeled.addSources(objects.slice(0, LABEL_LIMIT).map(toSource));
      unlabeled.addSources(objects.slice(LABEL_LIMIT).map(toSource));
    }

    /** Draw the studied field and any picked spot. */
    function drawMarks(state: AppState) {
      if (!marks) return;
      marks.removeAll();
      const target = state.target;
      if (target) {
        // The studied field as a square, north up.
        const half = state.fieldSize / 3600 / 2;
        const wide = half / Math.max(Math.cos((target.dec * Math.PI) / 180), 0.01);
        marks.add(A.polygon([
          [target.ra - wide, target.dec - half], [target.ra + wide, target.dec - half],
          [target.ra + wide, target.dec + half], [target.ra - wide, target.dec + half],
        ], { color: cssVariable(host, "--map-field", "#ffd24a"), lineWidth: 2 }));
      }
      const picked = state.map.picked ?? state.map.selected;
      if (picked) {
        const [fovX] = aladin.getFov();
        marks.add(A.circle(picked.ra, picked.dec, Math.max(fovX / 60, 0.002), { color: cssVariable(host, "--map-marker", "#ff6b6b"), lineWidth: 2 }));
      }
    }

    /** Apply store changes to the map. */
    function sync(state: AppState) {
      if (!aladin) return;
      const map = state.map;
      if (applied.projection !== map.projection) {
        aladin.setProjection(map.projection);
        applied.projection = map.projection;
      }
      if (applied.layer !== map.layer) {
        showLayer(map.layer);
        applied.layer = map.layer;
        applied.channel = map.channel;
      } else if (applied.channel !== map.channel) {
        setChannel(map.channel);
        applied.channel = map.channel;
      }
      if (applied.grid !== map.grid) {
        aladin.setCooGrid({ enabled: map.grid });
        applied.grid = map.grid;
      }
      if (applied.labels !== map.labels) {
        if (map.labels) {
          labeled.show();
          unlabeled.show();
          loadObjects();
        } else {
          labeled.hide();
          unlabeled.hide();
        }
        applied.labels = map.labels;
      }
      if (applied.goal !== state.mapGoal.token) {
        aladin.gotoRaDec(state.mapGoal.ra, state.mapGoal.dec);
        if (state.mapGoal.fov) aladin.setFoV(state.mapGoal.fov);
        applied.goal = state.mapGoal.token;
      }
      if (applied.target !== state.target || applied.fieldSize !== state.fieldSize || applied.picked !== map.picked || applied.selected !== map.selected) {
        drawMarks(state);
        applied.target = state.target;
        applied.fieldSize = state.fieldSize;
        applied.picked = map.picked;
        applied.selected = map.selected;
      }
    }

    function moved() {
      if (!aladin) return;
      const [ra, dec] = aladin.getRaDec();
      const [fov] = aladin.getFov();
      actions.mapReport({ center: { ra, dec }, fov });
      if (settle) clearTimeout(settle);
      settle = setTimeout(loadObjects, SETTLE_MS);
    }

    let unsubscribe = () => {};
    (async () => {
      try {
        A = (await import("aladin-lite")).default;
        await A.init;
      } catch (error) {
        actions.mapReport({ failure: typeof error === "string" ? error : "The sky map could not start in this browser." });
        return;
      }
      if (disposed) return;
      const state = useStore.getState();
      const start = SKY_LAYERS.find((entry) => entry.id === state.map.layer) ?? SKY_LAYERS[0];
      aladin = A.aladin(host, {
        survey: start.url,
        projection: state.map.projection,
        cooFrame: "ICRSd",
        fov: state.mapGoal.fov ?? state.map.fov,
        target: `${state.mapGoal.ra} ${state.mapGoal.dec}`,
        showCooGrid: state.map.grid,
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
        showCooGridControl: false,
        showSimbadPointerControl: false,
        showSettingsControl: false,
        showShareControl: false,
        showStatusBar: false,
        showContextMenu: false,
        showColorPickerControl: false,
        showSelectionModeControl: false,
      });
      layer = aladin.getBaseImageLayer();
      applied = { projection: state.map.projection, layer: state.map.layer, grid: state.map.grid, goal: state.mapGoal.token };
      if (start.cube) channelWhenReady(layer);

      const labelColor = cssVariable(host, "--map-label", "#9be8ff");
      const font = getComputedStyle(host).fontFamily || "sans-serif";
      const onClick = (source: { data: { object: SkyObject } }) => {
        lastObjectClick = Date.now();
        actions.selectObject(source.data.object);
      };
      labeled = A.catalog({ name: "Known objects", shape: "circle", sourceSize: 14, color: labelColor, displayLabel: true, labelColumn: "name", labelColor, labelFont: `13px ${font}`, onClick });
      unlabeled = A.catalog({ name: "More objects", shape: "circle", sourceSize: 9, color: labelColor, onClick });
      marks = A.graphicOverlay({ color: "#ffd24a", lineWidth: 2 });
      aladin.addCatalog(labeled);
      aladin.addCatalog(unlabeled);
      aladin.addOverlay(marks);

      aladin.on("positionChanged", moved);
      aladin.on("zoomChanged", moved);
      aladin.on("click", (event: { ra: number; dec: number; isDragging: boolean }) => {
        if (event.isDragging) return;
        // A click on an object fires this too. Let the object win.
        setTimeout(() => {
          if (Date.now() - lastObjectClick > 250) actions.pick({ ra: event.ra, dec: event.dec });
        }, 0);
      });

      actions.mapReport({ ready: true, failure: null });
      sync(useStore.getState());
      moved();
      unsubscribe = useStore.subscribe((next, before) => {
        if (next.map !== before.map || next.mapGoal !== before.mapGoal || next.target !== before.target || next.fieldSize !== before.fieldSize) sync(next);
      });
    })();

    return () => {
      disposed = true;
      unsubscribe();
      request?.abort();
      if (settle) clearTimeout(settle);
      actions.mapReport({ ready: false });
      host.replaceChildren();
    };
  }, []);

  return <div ref={hostRef} className={className} style={{ width: "100%", height: "100%", position: "relative" }} />;
}
