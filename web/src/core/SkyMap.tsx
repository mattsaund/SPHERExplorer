// The sky map: a pannable, zoomable view of the whole sky with clickable labels for known objects.
// Built on Aladin Lite (CDS, Strasbourg), loaded on demand. All of Aladin's own buttons are
// switched off, so the UI supplies the controls through actions.setMap and friends.
// Colors come from CSS variables: --map-label, --map-marker, --map-field.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef } from "react";
import { apiUrl, getObjects } from "./api";
import { SKY_LAYERS, type SkyLayer } from "./skyLayers";
import { skyOffset } from "./astro";
import { actions, useStore, type AppState } from "./store";
import type { SkyObject, SkyPosition } from "./types";

/** How many objects to ask for, and how many of those get a text label. */
const OBJECT_LIMIT = 160;
const LABEL_LIMIT = 45;
/** Wait this long after the view stops moving before asking for objects. */
const SETTLE_MS = 450;
const LIGHT_SPEED = 299792458; // meters per second
/** How close, in screen pixels, the pointer must be to a square's outline to grab it. */
const GRAB_PIXELS = 9;

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
    // Bumped on every layer change so late callbacks for an old layer do nothing.
    let generation = 0;
    let settle: ReturnType<typeof setTimeout> | null = null;
    let request: AbortController | null = null;
    let lastObjectClick = 0;
    let applied: Partial<AppState["map"]> & { goal?: number; target?: unknown; fieldSize?: number } = {};

    /** Address of a layer's tile set. The color view of the cube is built by our own server. */
    function layerUrl(spec: SkyLayer): string {
      return spec.color ? apiUrl(`/hips/spherex-color/${spec.color.join("-")}`) : spec.url;
    }

    /** Put a layer on the map. The SPHEREx cube also gets its channel. */
    function showLayer(id: string) {
      const spec = SKY_LAYERS.find((entry) => entry.id === id) ?? SKY_LAYERS[0];
      generation++;
      layer = A.HiPS(layerUrl(spec), { name: spec.name });
      aladin.setBaseImageLayer(layer);
      if (spec.cube) whenReady(layer, generation, (cube) => setChannel(cube, useStore.getState().map.channel));
    }

    /** A cube accepts settings only after its properties have loaded. Wait for that, then apply. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function whenReady(cube: any, made: number, apply: (cube: any) => void, tries = 60) {
      if (disposed || made !== generation) return;
      if (cube.added && cube.cubeDepth) apply(cube);
      else if (tries > 0) setTimeout(() => whenReady(cube, made, apply, tries - 1), 250);
    }

    /**
     * Show one channel of the SPHEREx cube. Aladin picks a cube frame by frequency, spreading the
     * frames evenly in frequency between the cube's limits. Aiming at the middle of frame k's
     * slot selects tile k, which is channel k in ascending wavelength.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function setChannel(cube: any, channel: number) {
      try {
        const depth = cube.cubeDepth || 102;
        const low = LIGHT_SPEED / (cube.emMax || 5.009e-6);
        const high = LIGHT_SPEED / (cube.emMin || 7.43e-7);
        cube.setFrequency({ value: low + ((channel + 0.5) / depth) * (high - low), unit: "Hz" });
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

    /** Corners of a north-up square of `size` arcseconds around a position, as [ra, dec] pairs. */
    function squareCorners(center: SkyPosition, size: number): [number, number][] {
      const half = size / 3600 / 2;
      const wide = half / Math.max(Math.cos((center.dec * Math.PI) / 180), 0.01);
      return [
        [center.ra - wide, center.dec - half], [center.ra + wide, center.dec - half],
        [center.ra + wide, center.dec + half], [center.ra - wide, center.dec + half],
      ];
    }

    /** The squares on the map that can be resized: the picked area and the field being studied. */
    function squares(state: AppState): { center: SkyPosition; studied: boolean }[] {
      const list: { center: SkyPosition; studied: boolean }[] = [];
      if (state.map.picked) list.push({ center: state.map.picked, studied: false });
      if (state.target && !state.target.moving) list.push({ center: state.target, studied: true });
      return list;
    }

    /** Draw the studied field, the picked area, and the selected object. */
    function drawMarks(state: AppState) {
      if (!marks) return;
      // Aladin keeps drawing a shape it thinks the pointer is over, even after the shape is
      // removed. Release the old shapes from that state first, so no stale outline is left behind.
      try {
        const old: unknown[] = marks.overlayItems ?? [];
        for (const item of old as { unhover?: () => void; deselect?: () => void }[]) {
          item.unhover?.();
          item.deselect?.();
        }
        const held = aladin.view.lastHoveredObject as unknown[] | null;
        if (held) aladin.view.lastHoveredObject = held.filter((item) => !old.includes(item));
      } catch {
        // These are Aladin internals. If they change, the worst case is a brief leftover outline.
      }
      marks.removeAll();
      const [fovX] = aladin.getFov();
      const pixel = fovX / Math.max(host.clientWidth, 1); // degrees per screen pixel
      const field = cssVariable(host, "--map-field", "#ffd24a");
      const marker = cssVariable(host, "--map-marker", "#ff6b6b");
      for (const square of squares(state)) {
        // A north-up square, the true shape and size of the area that is loaded.
        const color = square.studied ? field : marker;
        const corners = squareCorners(square.center, state.fieldSize);
        marks.add(A.polygon(corners, { color, lineWidth: 2 }));
        // Small grips on the corners show that the square can be dragged to resize.
        for (const [ra, dec] of corners) marks.add(A.circle(ra, dec, 3.5 * pixel, { color, lineWidth: 2 }));
        // From far out the square is too small to see, so a ring marks the place.
        if (state.fieldSize / 3600 < 14 * pixel) marks.add(A.circle(square.center.ra, square.center.dec, 9 * pixel, { color, lineWidth: 2 }));
      }
      const selected = state.map.selected;
      if (selected) marks.add(A.circle(selected.ra, selected.dec, Math.max(fovX / 60, 0.002), { color: marker, lineWidth: 2 }));
    }

    // ---- Resizing a square with the mouse or a finger -------------------------------------------
    let resizing: { center: SkyPosition; studied: boolean } | null = null;
    let swallowClick = false;

    /** Distance in screen pixels from a point to the outline of a square, or Infinity when it is off screen. */
    function outlineDistance(x: number, y: number, center: SkyPosition, size: number): number {
      const points = squareCorners(center, size).map(([ra, dec]) => aladin.world2pix(ra, dec) as [number, number] | null);
      if (points.some((point) => !point)) return Infinity;
      let best = Infinity;
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = points[i]!;
        const [bx, by] = points[(i + 1) % 4]!;
        const length = (bx - ax) ** 2 + (by - ay) ** 2;
        const along = length ? Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length)) : 0;
        best = Math.min(best, Math.hypot(x - (ax + along * (bx - ax)), y - (ay + along * (by - ay))));
      }
      return best;
    }

    /** The square whose outline is under the pointer, if any. */
    function grabbed(event: { clientX: number; clientY: number }) {
      if (!aladin) return null;
      const box = host.getBoundingClientRect();
      const state = useStore.getState();
      for (const square of squares(state)) {
        if (outlineDistance(event.clientX - box.left, event.clientY - box.top, square.center, state.fieldSize) <= GRAB_PIXELS) return square;
      }
      return null;
    }

    // These run before Aladin's own handlers, so a drag on a square's outline resizes it
    // instead of moving the map.
    function onPointerDown(event: PointerEvent) {
      const square = grabbed(event);
      if (!square) return;
      resizing = square;
      event.stopPropagation();
      event.preventDefault();
      host.setPointerCapture(event.pointerId);
    }
    function onPointerMove(event: PointerEvent) {
      if (!resizing) {
        host.style.cursor = grabbed(event) ? "nwse-resize" : "";
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      const box = host.getBoundingClientRect();
      const sky = aladin.pix2world(event.clientX - box.left, event.clientY - box.top) as [number, number] | undefined;
      if (!sky) return;
      // The square reaches as far as the pointer is from its center, east-west or north-south.
      const [east, north] = skyOffset({ ra: sky[0], dec: sky[1] }, resizing.center);
      actions.setFieldSize(2 * Math.max(Math.abs(east), Math.abs(north)), false);
    }
    function onPointerUp(event: PointerEvent) {
      if (!resizing) return;
      event.stopPropagation();
      event.preventDefault();
      const studied = resizing.studied;
      resizing = null;
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 50);
      // The field being studied reloads at its new size once the drag ends.
      if (studied) actions.setFieldSize(useStore.getState().fieldSize, true);
    }
    /** While a square is being dragged, keep the matching mouse and touch events from reaching the map. */
    function shield(event: Event) {
      if (resizing || swallowClick || (event.type === "mousedown" && grabbed(event as MouseEvent))) event.stopPropagation();
    }
    const SHIELDED = ["mousedown", "mousemove", "mouseup", "click", "touchstart", "touchmove", "touchend"];
    host.addEventListener("pointerdown", onPointerDown, true);
    host.addEventListener("pointermove", onPointerMove, true);
    host.addEventListener("pointerup", onPointerUp, true);
    host.addEventListener("pointercancel", onPointerUp, true);
    for (const type of SHIELDED) host.addEventListener(type, shield, true);

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
        const spec = SKY_LAYERS.find((entry) => entry.id === map.layer);
        if (spec?.cube && layer) setChannel(layer, map.channel);
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
      if (applied.target !== state.target || applied.fieldSize !== state.fieldSize || applied.picked !== map.picked || applied.selected !== map.selected || applied.fov !== map.fov) {
        drawMarks(state);
        applied.target = state.target;
        applied.fieldSize = state.fieldSize;
        applied.picked = map.picked;
        applied.selected = map.selected;
        applied.fov = map.fov; // the grips are sized in screen pixels, so they follow the zoom
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
        survey: layerUrl(start),
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
      // A handle for debugging in development builds only.
      if (import.meta.env.DEV) (window as unknown as { spxMap?: unknown }).spxMap = aladin;
      applied = { projection: state.map.projection, layer: state.map.layer, grid: state.map.grid, goal: state.mapGoal.token };
      if (start.cube) whenReady(layer, generation, (cube) => setChannel(cube, useStore.getState().map.channel));

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
      host.removeEventListener("pointerdown", onPointerDown, true);
      host.removeEventListener("pointermove", onPointerMove, true);
      host.removeEventListener("pointerup", onPointerUp, true);
      host.removeEventListener("pointercancel", onPointerUp, true);
      for (const type of SHIELDED) host.removeEventListener(type, shield, true);
      request?.abort();
      if (settle) clearTimeout(settle);
      actions.mapReport({ ready: false });
      host.replaceChildren();
    };
  }, []);

  return <div ref={hostRef} className={className} style={{ width: "100%", height: "100%", position: "relative" }} />;
}
