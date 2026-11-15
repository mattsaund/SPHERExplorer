// The sky map: a pannable, zoomable view of the whole sky with clickable labels for known objects.
// Built on Aladin Lite (CDS, Strasbourg), loaded on demand. All of Aladin's own buttons are
// switched off, so the UI supplies the controls through actions.setMap and friends.
// Colors come from CSS variables: --map-label, --map-field, --map-pick, --map-coverage,
// --map-deep, --map-measure, --map-solar, --map-sun, --map-moon.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef } from "react";
import { apiUrl, coverageUrl, getObjects } from "../net/api";
import { SKY_LAYERS, type SkyLayer } from "../sky/skyLayers";
import { solarPlaces } from "../sky/solar";
import { formatDate, separation, skyOffset, skyPath } from "../sky/astro";
import { fieldCenter, fieldDate, fieldIsNow, isStudied } from "../state/field";
import { actions, useStore, type AppState } from "../state/store";
import type { SkyObject, SkyPosition } from "../types";

/** How many objects to ask for, and how many of those get a text label. */
const OBJECT_LIMIT = 160;
const LABEL_LIMIT = 45;
/** Wait this long after the view stops moving before asking for objects. */
const SETTLE_MS = 450;
const LIGHT_SPEED = 299792458; // meters per second
/** How close, in screen pixels, the pointer must be to a square's outline to grab it. */
const GRAB_PIXELS = 9;
/** A square narrower than this many screen pixels is too small to see, so a mark stands in for it. */
const TINY_PIXELS = 14;
/**
 * The crosshair that marks a chosen place: the gap around the place and the length of each arm,
 * in screen pixels. The same shape and yellow as the target marker in the image viewer.
 */
const CROSS_GAP = 8;
const CROSS_ARM = 10;
/** How often the bodies of the solar system are moved to where they are now, in milliseconds. */
const SOLAR_MS = 60000;
/** A press that moves less than this many screen pixels is a click, not a drag. */
const CLICK_SLOP = 4;
/** How close, in screen pixels, a click must be to an object's ring to choose it. */
const OBJECT_REACH = 10;
/** A moving body's square counts as in sight while it is this many screen pixels inside the map's edge. */
const SIGHT_MARGIN = 24;
/** The gap between the studied field's square and its name, in screen pixels. */
const CAPTION_GAP = 6;
/**
 * The square must be seen whole. Once it would take more than FIT_LIMIT of the map's shorter
 * side, the map zooms out until it takes FIT_SHARE of it, which leaves room to see around it.
 */
const FIT_LIMIT = 0.85;
const FIT_SHARE = 0.55;
/** The Sun and the Moon are drawn as discs once their radius is at least this many screen pixels. */
const MIN_DISC = 5;

/**
 * Coverage maps laid over the sky, the same two the IRSA SPHEREx Data Explorer offers.
 * `key` is the switch in the map state and `file` the map's name on our server.
 */
const COVERAGE = [
  { key: "coverage", file: "spectral-images", name: "SPHEREx spectral images", color: "--map-coverage", fallback: "#ffa94d" },
  { key: "deepFields", file: "deep-fields", name: "SPHEREx deep fields", color: "--map-deep", fallback: "#c79bff" },
] as const;

/** The value of a CSS variable on an element, or a fallback when the page does not set it. */
function cssVariable(element: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

/** The sky map. It fills its parent and follows the map part of the store. */
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
    // The view (center and radius) whose objects were last asked for.
    let objectsView = "";
    let lastObjectClick = 0;
    // The width of view last asked for, in degrees. Used once, to settle the map after it starts.
    let wantedFov = 0;
    let applied: Partial<AppState["map"]> & { goal?: number; target?: unknown; fieldSize?: number; field?: SkyPosition | null; caption?: string } = {};
    // The studied target's name, written beside its square.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let caption: any = null;
    // Colors and the font for what is drawn on every frame of the map, read from the page once.
    const ink = {
      font: getComputedStyle(host).fontFamily || "sans-serif",
      field: cssVariable(host, "--map-field", "#ffd24a"),
      sun: cssVariable(host, "--map-sun", "#ffd76a"),
      moon: cssVariable(host, "--map-moon", "#d9dde3"),
    };
    // The solar system's marks, and the bodies they stand for, as they were last placed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let planets: any = null;
    // The Sun and the Moon again, as discs of their true size under their marks.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let discs: any = null;
    let solarNow: SkyObject[] = [];
    let solarTimer: ReturnType<typeof setInterval> | null = null;
    // Coverage maps already on the map, by their switch in the map state.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coverage: Record<string, any> = {};

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
      // The same view never asks twice. At start two things call this within half a second,
      // and a resize or a redraw can report a move that changed nothing.
      const view = `${ra.toFixed(4)} ${dec.toFixed(4)} ${radius.toFixed(4)}`;
      if (view === objectsView) return;
      objectsView = view;
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
          // A request that did not finish may be asked again for the same view.
          if (objectsView === view) objectsView = "";
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

    /**
     * Put the bodies of the solar system where they are at this moment. Each becomes an object
     * like any other on the map, so a click opens its facts.
     */
    function placeSolar() {
      if (!aladin || !planets) return;
      const year = 2000 + (Date.now() / 86400000 - 10957.5) / 365.25;
      solarNow = solarPlaces(new Date()).map((body) => ({
        id: `solar:${body.id}`, name: body.name, ra: body.ra, dec: body.dec, epoch: year, kind: body.kind, code: null,
        pmRa: null, pmDec: null, parallax: null, redshift: null, spectralType: null, refs: null, vMag: null, kMag: null,
        url: body.url, distance: null, solar: { query: body.query, earth: body.earth, sun: body.sun, note: body.note, disc: body.disc, lit: body.lit, sunward: body.sunward },
      }));
      planets.removeAll();
      planets.addSources(solarNow.map((object) => A.source(object.ra, object.dec, { name: object.name, object })));
      discs.removeAll();
      discs.addSources(solarNow.filter((object) => object.solar?.disc).map((object) => A.source(object.ra, object.dec, { name: object.name, object })));
      // A studied body's square sits on its marker, so it moves along with the markers.
      const state = useStore.getState();
      if (state.target?.moving && state.map.fieldShown && applied) {
        drawMarks(state);
        applied.field = fieldCenter(state);
      }
    }

    /** How many screen pixels a length on the sky covers near the middle of the map. `degrees` is that length. */
    function onScreen(degrees: number): number {
      const [fovX] = aladin.getFov();
      return (degrees * Math.max(host.clientWidth, 1)) / fovX;
    }

    /**
     * Draw the Sun or the Moon as a disc of its true size on the sky, so there is something
     * to see where its label is. Aladin calls this as the "shape" of the source. From far out
     * the disc would be smaller than its mark, so nothing is drawn. The disc is a flat tint
     * with an outline, like the other overlays. It is a drawing, not part of the survey image.
     * The Moon shows how much of its face is lit, with the bright edge toward the Sun.
     */
    function drawDisc(source: { x: number; y: number; data: { object: SkyObject } }, ctx: CanvasRenderingContext2D) {
      const body = source.data.object;
      const solar = body.solar;
      if (!solar?.disc) return;
      const radius = onScreen(solar.disc);
      if (radius < MIN_DISC) return;
      const moon = solar.lit !== undefined && solar.sunward !== undefined;
      const color = moon ? ink.moon : ink.sun;
      ctx.save();
      ctx.translate(source.x, source.y);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      if (!moon) {
        ctx.globalAlpha = 0.35;
        ctx.fill();
      } else {
        // The dark part of the Moon is a faint tint. The lit part goes over it.
        ctx.globalAlpha = 0.12;
        ctx.fill();
        // Find where the Sun is from here on the screen, by stepping toward it on the sky.
        const toward = (solar.sunward! * Math.PI) / 180;
        const flat = Math.max(Math.cos((body.dec * Math.PI) / 180), 0.01);
        const tip = aladin.world2pix(body.ra + (solar.disc * Math.sin(toward)) / flat, body.dec + solar.disc * Math.cos(toward)) as [number, number] | null;
        if (tip) {
          // Turn the drawing so that the Sun is to the right. The lit part is then the right
          // half of the edge, closed by the line between light and dark, which is half an
          // ellipse: bulging left when more than half is lit, right when less.
          ctx.rotate(Math.atan2(tip[1] - source.y, tip[0] - source.x));
          const more = solar.lit! > 0.5;
          ctx.beginPath();
          ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
          ctx.ellipse(0, 0, radius * Math.abs(2 * solar.lit! - 1), radius, 0, Math.PI / 2, more ? 1.5 * Math.PI : -Math.PI / 2, !more);
          ctx.closePath();
          ctx.globalAlpha = 0.55;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    /** The Sun or the Moon, when a place on the sky lies on its drawn disc. Otherwise null. */
    function discAt(place: SkyPosition): SkyObject | null {
      if (!useStore.getState().map.solar) return null;
      for (const object of solarNow) {
        const disc = object.solar?.disc;
        if (disc && onScreen(disc) >= MIN_DISC && separation(place, object).arcsec / 3600 <= disc) return object;
      }
      return null;
    }

    /** Switch the solar system on or off. While on, the bodies are moved along once a minute. */
    function showSolar(on: boolean) {
      if (!planets) return;
      if (solarTimer) clearInterval(solarTimer);
      solarTimer = null;
      if (on) {
        planets.show();
        discs.show();
        placeSolar();
        solarTimer = setInterval(placeSolar, SOLAR_MS);
      } else {
        planets.hide();
        discs.hide();
      }
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

    /**
     * The selected area: one yellow square that can be moved and resized. It is the field
     * being studied. While it is being dragged to a new place it follows the pointer, and its
     * images load when it is let go. `studied` is false only during that drag.
     * A planet or comet has a square too. It sits where the image on screen was taken, so it
     * moves across the map as the film plays.
     */
    function squares(state: AppState): { center: SkyPosition; studied: boolean }[] {
      if (state.map.picked && state.map.pickedIn === "map") return [{ center: state.map.picked, studied: false }];
      const center = state.map.fieldShown ? fieldCenter(state) : null;
      return center ? [{ center, studied: true }] : [];
    }

    /** True when a place on the sky is on the map, clear of its edge. */
    function inSight(position: SkyPosition): boolean {
      const at = aladin.world2pix(position.ra, position.dec) as [number, number] | null;
      if (!at) return false;
      return at[0] >= SIGHT_MARGIN && at[0] <= host.clientWidth - SIGHT_MARGIN && at[1] >= SIGHT_MARGIN && at[1] <= host.clientHeight - SIGHT_MARGIN;
    }

    /**
     * Zoom the map out when the studied field's square does not fit in it. A square wider than
     * the map has all four sides off screen, so it would seem to have vanished: that happens
     * when a larger area is chosen on a map that is zoomed in. The map only ever zooms out
     * here, and only as far as needed. Returns true when it did.
     */
    function fitSquare(size: number): boolean {
      const width = Math.max(host.clientWidth, 1);
      const room = Math.min(width, Math.max(host.clientHeight, 1));
      const [fovX] = aladin.getFov();
      const side = size / 3600 / (fovX / width); // the square's side in screen pixels
      if (!(side > FIT_LIMIT * room)) return false;
      const wanted = Math.min(180, ((size / 3600) / (FIT_SHARE * room)) * width);
      aladin.setFoV(wanted);
      wantedFov = wanted;
      return true;
    }

    /**
     * The name to write beside the studied field's square, or "" for none: a named target
     * gets its name. A moving body's square also gets the date of the image on screen when it
     * is where the body was on that date, and not on the body's marker.
     */
    function captionText(state: AppState): string {
      const target = state.target;
      if (!target?.name || (state.map.picked && state.map.pickedIn === "map")) return "";
      // A star, or a body whose square sits on its own marker, where it is today.
      if (!target.moving || fieldIsNow(state)) return target.name;
      const date = fieldDate(state);
      return date === null ? target.name : `${target.name}, ${formatDate(date)}`;
    }

    /**
     * Write the studied target's name beside its square. Aladin calls this as the "shape" of
     * the one source in the caption catalog, which sits at the middle of the field. The name
     * goes above the square, or beside the crosshair that stands in for a square too small to see.
     */
    function drawCaption(source: { x: number; y: number; data: { name: string } }, ctx: CanvasRenderingContext2D) {
      const [fovX] = aladin.getFov();
      const pixel = fovX / Math.max(host.clientWidth, 1); // degrees per screen pixel
      const half = useStore.getState().fieldSize / 3600 / 2 / pixel; // half the square's width on screen
      ctx.save();
      ctx.font = `600 13px ${ink.font}`;
      ctx.fillStyle = ink.field;
      ctx.textBaseline = "alphabetic";
      // A thin dark edge keeps the name readable over bright sky and over other labels.
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
      // Above the square, from its left edge. A square too small to see has the crosshair in
      // its place, and the name goes above that, clear of the object's own label on the right.
      const tiny = 2 * half < TINY_PIXELS;
      const x = tiny ? source.x - ctx.measureText(source.data.name).width / 2 : source.x - half;
      const y = tiny ? source.y - CROSS_GAP - CROSS_ARM - CAPTION_GAP : source.y - half - CAPTION_GAP;
      ctx.strokeText(source.data.name, x, y);
      ctx.fillText(source.data.name, x, y);
      ctx.restore();
    }

    /** Put the caption on the studied field, move it there, or take it away. */
    function showCaption(state: AppState) {
      if (!caption) return;
      const center = state.map.fieldShown ? fieldCenter(state) : null;
      const text = center ? captionText(state) : "";
      const key = text && center ? `${text}|${center.ra}|${center.dec}` : "";
      if (applied.caption === key) return;
      applied.caption = key;
      caption.removeAll();
      if (text && center) caption.addSources([A.source(center.ra, center.dec, { name: text })]);
    }

    /** Draw the picked area or the studied field, and the selected object. */
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
      const pick = cssVariable(host, "--map-pick", "#ffd24a");
      /**
       * Four short arms around a place, which leave the place itself uncovered. `gap` is in
       * screen pixels. The arms are laid out on screen, so the cross stands upright in any map
       * shape, also far from the middle of a whole-sky view where north is tilted.
       */
      const crosshair = (center: SkyPosition, gap: number) => {
        const at = aladin.world2pix(center.ra, center.dec) as [number, number] | null;
        if (!at) return;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const from = skyAt(at[0] + dx * gap, at[1] + dy * gap);
          const to = skyAt(at[0] + dx * (gap + CROSS_ARM), at[1] + dy * (gap + CROSS_ARM));
          if (from && to) marks.add(A.polyline([[from.ra, from.dec], [to.ra, to.dec]], { color: pick, lineWidth: 2 }));
        }
      };
      for (const square of squares(state)) {
        if (state.fieldSize / 3600 < TINY_PIXELS * pixel) {
          // From far out the square is too small to see, so the crosshair marks its place.
          crosshair(square.center, CROSS_GAP);
          continue;
        }
        // A north-up square, the true shape and size of the area the images cover.
        const corners = squareCorners(square.center, state.fieldSize);
        marks.add(A.polygon(corners, { color: field, lineWidth: 2 }));
        // Small grips on the corners show that the square can be dragged to resize.
        for (const [ra, dec] of corners) marks.add(A.circle(ra, dec, 3.5 * pixel, { color: field, lineWidth: 2 }));
      }
      // A spot picked in the images is a point, not an area, so it gets the crosshair.
      if (state.map.picked && state.map.pickedIn === "images") crosshair(state.map.picked, CROSS_GAP);
      // The chosen object keeps its own ring. The crosshair goes around that. An object that
      // is being studied has the square instead, so one mark says it all.
      const selected = state.map.selected;
      if (selected && !isStudied(state, selected)) crosshair(selected, CROSS_GAP + 6);
      // The measured line follows the shortest path on the sky, so it is drawn as many short pieces.
      const measured = state.map.measured;
      if (measured) {
        const ink = cssVariable(host, "--map-measure", "#ffffff");
        marks.add(A.polyline(skyPath(measured.from, measured.to).map((point) => [point.ra, point.dec]), { color: ink, lineWidth: 2 }));
        for (const end of [measured.from, measured.to]) marks.add(A.circle(end.ra, end.dec, 3 * pixel, { color: ink, lineWidth: 2 }));
      }
      showCaption(state);
    }

    /** Switch a coverage map on or off. Its file is fetched the first time it is switched on. */
    function showCoverage(entry: (typeof COVERAGE)[number], on: boolean) {
      const shown = coverage[entry.key];
      if (shown) {
        if (on) shown.show();
        else shown.hide();
        return;
      }
      if (!on) return;
      const color = cssVariable(host, entry.color, entry.fallback);
      // A light fill tints the covered sky. The outline marks its edge.
      const moc = A.MOCFromURL(
        coverageUrl(entry.file),
        { name: entry.name, color, fillColor: color, fill: true, perimeter: true, opacity: 0.22, lineWidth: 2 },
        undefined,
        () => {
          // The file did not arrive. Switch the overlay back off and say so.
          delete coverage[entry.key];
          actions.setMap({ [entry.key]: false });
          useStore.setState({ notice: `The map of ${entry.name} could not be loaded. Try again in a minute.` });
        },
      );
      coverage[entry.key] = moc;
      aladin.addMOC(moc);
    }

    // ---- Dragging on the map: measuring, or resizing and moving the square ----------------------
    type Square = { center: SkyPosition; studied: boolean };
    type Drag =
      | { kind: "resize"; square: Square }
      // offsetX and offsetY lead from the pointer to the square's center, in screen pixels.
      | { kind: "move"; offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean }
      | { kind: "measure"; from: SkyPosition; startX: number; startY: number; moved: boolean };
    let drag: Drag | null = null;
    let swallowClick = false;
    let hoverFrame = 0;
    let hoverNext: SkyPosition | null = null;
    // The cursor our own tools ask for: a cross to measure, arrows to resize, a hand to move.
    let cursorWanted = "";

    /** The pointer's place inside the map, in screen pixels. */
    function point(event: { clientX: number; clientY: number }): [number, number] {
      const box = host.getBoundingClientRect();
      return [event.clientX - box.left, event.clientY - box.top];
    }

    /** The sky position at a place on the map, or null outside the sky. */
    function skyAt(x: number, y: number): SkyPosition | null {
      const sky = aladin?.pix2world(x, y) as [number, number] | undefined;
      return sky && Number.isFinite(sky[0]) && Number.isFinite(sky[1]) ? { ra: sky[0], dec: sky[1] } : null;
    }

    /** The corners of a square on screen, or null when one of them is off the map. */
    function screenCorners(center: SkyPosition, size: number): [number, number][] | null {
      const points = squareCorners(center, size).map(([ra, dec]) => aladin.world2pix(ra, dec) as [number, number] | null);
      return points.some((corner) => !corner) ? null : (points as [number, number][]);
    }

    /** Distance in screen pixels from a point to the outline of a square. */
    function outlineDistance(x: number, y: number, corners: [number, number][]): number {
      let best = Infinity;
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = corners[i];
        const [bx, by] = corners[(i + 1) % 4];
        const length = (bx - ax) ** 2 + (by - ay) ** 2;
        const along = length ? Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length)) : 0;
        best = Math.min(best, Math.hypot(x - (ax + along * (bx - ax)), y - (ay + along * (by - ay))));
      }
      return best;
    }

    /** True when a point lies inside the four-sided shape with these corners. */
    function insideCorners(x: number, y: number, corners: [number, number][]): boolean {
      let sign = 0;
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = corners[i];
        const [bx, by] = corners[(i + 1) % 4];
        const side = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
        if (side !== 0 && sign !== 0 && side !== sign) return false;
        if (side !== 0) sign = side;
      }
      return true;
    }

    /**
     * What a press at this place would take hold of: the square's edge (to resize it), its
     * inside (to move it), or nothing, which leaves the press to the map.
     * A finger on the inside still moves the map, so the map can always be panned and pinched
     * on a touch screen. A finger moves the square by tapping its new place.
     */
    function holdAt(x: number, y: number, touch: boolean): { part: "edge" | "inside"; square: Square } | null {
      if (!aladin) return null;
      const state = useStore.getState();
      for (const square of squares(state)) {
        const corners = screenCorners(square.center, state.fieldSize);
        if (!corners) continue;
        const inside = insideCorners(x, y, corners);
        const width = Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]);
        if (width < TINY_PIXELS) {
          // Too small to see, so its mark stands in for it. The mark can be dragged to a new
          // place. Resizing a square that small by hand would jump straight to a huge field.
          const middle = [(corners[0][0] + corners[2][0]) / 2, (corners[0][1] + corners[2][1]) / 2];
          if (!touch && Math.hypot(x - middle[0], y - middle[1]) <= CROSS_GAP + CROSS_ARM) return { part: "inside", square };
          continue;
        }
        // Inside a small square the edge band is thinner, so there is still an inside to grab.
        const band = inside && !touch ? Math.min(GRAB_PIXELS, width / 6) : GRAB_PIXELS;
        if (outlineDistance(x, y, corners) <= band) return { part: "edge", square };
        if (inside && !touch) return { part: "inside", square };
      }
      return null;
    }

    /**
     * A click inside the square never reaches the map. If it landed on an object, choose that
     * object, as the map would have. Otherwise do nothing: the square is already the field
     * being studied, and loading it again a few pixels off would only waste the wait.
     */
    function clickAt(x: number, y: number) {
      const state = useStore.getState();
      {
        let nearest: SkyObject | null = null;
        let reach = OBJECT_REACH;
        const shown = [...(state.map.labels ? state.map.objects : []), ...(state.map.solar ? solarNow : [])];
        for (const object of shown) {
          const at = aladin.world2pix(object.ra, object.dec) as [number, number] | null;
          if (!at) continue;
          const distance = Math.hypot(at[0] - x, at[1] - y);
          if (distance <= reach) {
            nearest = object;
            reach = distance;
          }
        }
        if (nearest) actions.chooseObject(nearest);
      }
    }

    /** Report where the pointer is on the sky, at most once per drawn frame. */
    function reportHover(position: SkyPosition | null) {
      hoverNext = position;
      if (hoverFrame) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        actions.setMapHover(hoverNext);
      });
    }

    // These run before Aladin's own handlers, so a drag that measures, resizes, or moves the
    // square does not also move the map.
    function onPointerDown(event: PointerEvent) {
      if (!aladin || drag || (event.pointerType === "mouse" && event.button !== 0)) return;
      const [x, y] = point(event);
      if (useStore.getState().map.measuring) {
        const from = skyAt(x, y);
        if (!from) return;
        drag = { kind: "measure", from, startX: x, startY: y, moved: false };
      } else {
        const hold = holdAt(x, y, event.pointerType === "touch");
        if (!hold) return;
        if (hold.part === "edge") {
          drag = { kind: "resize", square: hold.square };
        } else {
          const center = aladin.world2pix(hold.square.center.ra, hold.square.center.dec) as [number, number] | null;
          if (!center) return;
          drag = { kind: "move", offsetX: center[0] - x, offsetY: center[1] - y, startX: x, startY: y, moved: false };
        }
      }
      event.stopPropagation();
      event.preventDefault();
      host.setPointerCapture(event.pointerId);
    }
    function onPointerMove(event: PointerEvent) {
      const [x, y] = point(event);
      if (event.pointerType !== "touch") reportHover(skyAt(x, y));
      if (!drag) {
        const measuring = useStore.getState().map.measuring;
        const hold = measuring ? null : holdAt(x, y, event.pointerType === "touch");
        wantCursor(measuring ? "crosshair" : hold ? (hold.part === "edge" ? "nwse-resize" : "move") : "");
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      if (drag.kind === "resize") {
        const sky = skyAt(x, y);
        if (!sky) return;
        // The square reaches as far as the pointer is from its center, east-west or north-south.
        const [east, north] = skyOffset(sky, drag.square.center);
        actions.setFieldSize(2 * Math.max(Math.abs(east), Math.abs(north)), false);
        return;
      }
      if (!drag.moved && Math.hypot(x - drag.startX, y - drag.startY) < CLICK_SLOP) return;
      drag.moved = true;
      if (drag.kind === "move") {
        // The square keeps the same place under the pointer that it was grabbed by. While it
        // is dragged it is only a picked place. Its images load when it is let go.
        const sky = skyAt(x + drag.offsetX, y + drag.offsetY);
        if (sky) actions.pick(sky);
      } else {
        const to = skyAt(x, y);
        if (!to) return;
        const { arcsec, angle } = separation(drag.from, to);
        actions.mapReport({ measured: { from: drag.from, to, separation: arcsec, angle } });
      }
    }
    function onPointerUp(event: PointerEvent) {
      if (!drag) return;
      event.stopPropagation();
      event.preventDefault();
      const done = drag;
      drag = null;
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 50);
      if (event.type === "pointercancel") {
        // A drag that was broken off leaves the square where it was.
        if (done.kind === "move" && done.moved) actions.pick(null);
        return;
      }
      if (done.kind === "resize") {
        // The field being studied reloads at its new size once the drag ends.
        if (done.square.studied) actions.setFieldSize(useStore.getState().fieldSize, true);
        // A corner dragged past the map's edge leaves a square too large to see. Bring it back in.
        fitSquare(useStore.getState().fieldSize);
      } else if (done.kind === "move") {
        const place = useStore.getState().map.picked;
        if (!done.moved) clickAt(...point(event));
        // Let go in a new place: that place becomes the field being studied. The map stays put.
        else if (place) actions.goTo({ ra: place.ra, dec: place.dec, epoch: 2026.0 }, { fly: false });
      } else if (!done.moved) {
        // A click with the measure tool clears the last line.
        actions.mapReport({ measured: null });
      }
    }
    function onPointerLeave() {
      reportHover(null);
    }
    /**
     * Aladin sets the cursor on its own canvas as the pointer moves, which hides any cursor set
     * on the map's box. So ours is set through Aladin, after its handlers have run.
     */
    function wantCursor(cursor: string) {
      const released = cursorWanted !== "" && cursor === "";
      cursorWanted = cursor;
      if (released) setCursor("default");
    }
    function setCursor(cursor: string) {
      try {
        aladin?.view.setCursor(cursor);
      } catch {
        // An Aladin internal. Without it the tools still work, only the cursor stays an arrow.
      }
    }
    function applyCursor() {
      if (cursorWanted) setCursor(cursorWanted);
    }
    /** While a drag of ours is under way, keep the matching mouse and touch events from reaching the map. */
    function shield(event: Event) {
      if (drag || swallowClick) {
        event.stopPropagation();
        return;
      }
      if (event.type !== "mousedown") return;
      const [x, y] = point(event as MouseEvent);
      if (useStore.getState().map.measuring || holdAt(x, y, false)) event.stopPropagation();
    }
    const SHIELDED = ["mousedown", "mousemove", "mouseup", "click", "touchstart", "touchmove", "touchend"];
    host.addEventListener("pointerdown", onPointerDown, true);
    host.addEventListener("pointermove", onPointerMove, true);
    host.addEventListener("pointerup", onPointerUp, true);
    host.addEventListener("pointercancel", onPointerUp, true);
    host.addEventListener("pointerleave", onPointerLeave);
    // Bubble phase, so these run after Aladin has set its own cursor.
    host.addEventListener("pointermove", applyCursor);
    host.addEventListener("mousemove", applyCursor);
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
      for (const entry of COVERAGE) {
        if (applied[entry.key] !== map[entry.key]) {
          showCoverage(entry, map[entry.key]);
          applied[entry.key] = map[entry.key];
        }
      }
      if (applied.tiles !== map.tiles) {
        aladin.showHealpixGrid(map.tiles);
        applied.tiles = map.tiles;
      }
      if (applied.solar !== map.solar) {
        showSolar(map.solar);
        applied.solar = map.solar;
      }
      if (applied.measuring !== map.measuring) {
        wantCursor(map.measuring ? "crosshair" : "");
        applyCursor();
        applied.measuring = map.measuring;
      }
      if (applied.goal !== state.mapGoal.token) {
        aladin.gotoRaDec(state.mapGoal.ra, state.mapGoal.dec);
        if (state.mapGoal.fov) {
          aladin.setFoV(state.mapGoal.fov);
          wantedFov = state.mapGoal.fov;
        }
        applied.goal = state.mapGoal.token;
      }
      // A moving body's square goes where the image on screen was taken. If the square was in
      // sight and the film has carried it off the map, the map follows it. A map that the
      // person has turned elsewhere is left alone.
      const field = map.fieldShown ? fieldCenter(state) : null;
      const fieldMoved = field?.ra !== applied.field?.ra || field?.dec !== applied.field?.dec;
      if (fieldMoved && field && applied.field && state.target?.moving && inSight(applied.field) && !inSight(field)) {
        aladin.gotoRaDec(field.ra, field.dec);
      }
      // A new field, or a new size for it, must leave the whole square in sight. Not while the
      // square is being dragged: zooming then would pull its corner out from under the pointer.
      if (field && !drag && (applied.target !== state.target || applied.fieldSize !== state.fieldSize || !applied.field)) fitSquare(state.fieldSize);
      if (
        applied.target !== state.target || applied.fieldSize !== state.fieldSize || applied.picked !== map.picked || applied.fieldShown !== map.fieldShown ||
        applied.selected !== map.selected || applied.fov !== map.fov || applied.center !== map.center || applied.measured !== map.measured || fieldMoved
      ) {
        drawMarks(state);
        applied.field = field;
        applied.target = state.target;
        applied.fieldSize = state.fieldSize;
        applied.picked = map.picked;
        applied.fieldShown = map.fieldShown;
        applied.selected = map.selected;
        applied.fov = map.fov; // the grips are sized in screen pixels, so they follow the zoom
        applied.center = map.center; // the crosshair is laid out on screen, so it follows the view
        applied.measured = map.measured;
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
      wantedFov = state.mapGoal.fov ?? state.map.fov;
      aladin = A.aladin(host, {
        survey: layerUrl(start),
        projection: state.map.projection,
        cooFrame: "ICRSd",
        fov: wantedFov,
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
      // Aladin takes its real size a moment after it is made, and rescales the view as it does.
      // In a map narrower than the window (beside the images, when a link opens a study) the
      // width asked for above would then not hold. So take the size now and set the width again.
      try {
        aladin.view.wasm.resize(aladin.view.width, aladin.view.height);
      } catch {
        // An Aladin internal. The check a moment later still puts the width right.
      }
      aladin.setFoV(wantedFov);
      setTimeout(() => {
        if (!disposed && Math.abs(aladin.getFov()[0] - wantedFov) > 0.01 * wantedFov) aladin.setFoV(wantedFov);
      }, 80);
      // A handle for debugging in development builds only.
      if (import.meta.env.DEV) {
        (window as unknown as { spxMap?: unknown }).spxMap = aladin;
        (window as unknown as { spxMarks?: unknown }).spxMarks = marks;
      }
      applied = { projection: state.map.projection, layer: state.map.layer, grid: state.map.grid, goal: state.mapGoal.token, coverage: false, deepFields: false, tiles: false, solar: false, measuring: false };
      if (start.cube) whenReady(layer, generation, (cube) => setChannel(cube, useStore.getState().map.channel));

      const labelColor = cssVariable(host, "--map-label", "#9be8ff");
      const font = getComputedStyle(host).fontFamily || "sans-serif";
      // A click on an object makes it the study at once. The Sun and the Moon only show their card.
      const onClick = (source: { data: { object: SkyObject } }) => {
        lastObjectClick = Date.now();
        actions.chooseObject(source.data.object);
        // The yellow square and crosshair show what is selected. Aladin's own highlight on the
        // clicked mark would stay behind after the selection moves on, so it is let go at once.
        setTimeout(() => {
          try {
            aladin?.view.unselectObjects();
          } catch {
            // An Aladin internal. Without it the clicked mark only stays highlighted for a while.
          }
        }, 0);
      };
      labeled = A.catalog({ name: "Known objects", shape: "circle", sourceSize: 14, color: labelColor, displayLabel: true, labelColumn: "name", labelColor, labelFont: `13px ${font}`, onClick });
      unlabeled = A.catalog({ name: "More objects", shape: "circle", sourceSize: 9, color: labelColor, onClick });
      marks = A.graphicOverlay({ color: "#ffd24a", lineWidth: 2 });
      // The solar system wears its own color and a diamond, so it reads apart from the fixed sky.
      const solarColor = cssVariable(host, "--map-solar", "#a8e6a1");
      planets = A.catalog({ name: "Solar system", shape: "rhomb", sourceSize: 14, color: solarColor, displayLabel: true, labelColumn: "name", labelColor: solarColor, labelFont: `13px ${font}`, onClick });
      // The Sun and the Moon at their true size. Added first, so their marks and names lie on top.
      discs = A.catalog({ name: "Sun and Moon", sourceSize: 14, color: solarColor, shape: drawDisc, onClick });
      // The studied target's name. Its "shape" is a function that writes the name, so it is
      // drawn with the map and never trails behind it. A click on it does nothing.
      caption = A.catalog({ name: "Studied target", sourceSize: 1, color: cssVariable(host, "--map-field", "#ffd24a"), shape: drawCaption, onClick: () => (lastObjectClick = Date.now()) });
      aladin.addCatalog(labeled);
      aladin.addCatalog(unlabeled);
      aladin.addCatalog(discs);
      aladin.addCatalog(planets);
      aladin.addCatalog(caption);
      aladin.addOverlay(marks);

      aladin.on("positionChanged", moved);
      aladin.on("zoomChanged", moved);
      aladin.on("click", (event: { ra: number; dec: number; isDragging: boolean }) => {
        if (event.isDragging) return;
        // A click on an object fires this too. Let the object win.
        setTimeout(() => {
          if (Date.now() - lastObjectClick <= 250) return;
          // A click anywhere on the drawn Sun or Moon chooses it, as a click on its mark does.
          const body = discAt({ ra: event.ra, dec: event.dec });
          if (body) actions.chooseObject(body);
          // A click on empty sky selects that area, and its images load at once. The map stays put.
          else actions.goTo({ ra: event.ra, dec: event.dec, epoch: 2026.0 }, { fly: false });
        }, 0);
      });

      actions.mapReport({ ready: true, failure: null });
      sync(useStore.getState());
      moved();
      unsubscribe = useStore.subscribe((next, before) => {
        // A planet or comet has a new place in every image, so its square also follows the film.
        const filmChanged = next.target?.moving !== undefined && (next.player.index !== before.player.index || next.filmMoved !== before.filmMoved || next.sequence !== before.sequence || next.frames !== before.frames);
        if (next.map !== before.map || next.mapGoal !== before.mapGoal || next.target !== before.target || next.fieldSize !== before.fieldSize || filmChanged) sync(next);
      });
    })();

    return () => {
      disposed = true;
      unsubscribe();
      host.removeEventListener("pointerdown", onPointerDown, true);
      host.removeEventListener("pointermove", onPointerMove, true);
      host.removeEventListener("pointerup", onPointerUp, true);
      host.removeEventListener("pointercancel", onPointerUp, true);
      host.removeEventListener("pointerleave", onPointerLeave);
      if (solarTimer) clearInterval(solarTimer);
      host.removeEventListener("pointermove", applyCursor);
      host.removeEventListener("mousemove", applyCursor);
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      actions.setMapHover(null);
      for (const type of SHIELDED) host.removeEventListener(type, shield, true);
      request?.abort();
      if (settle) clearTimeout(settle);
      actions.mapReport({ ready: false });
      host.replaceChildren();
    };
  }, []);

  return <div ref={hostRef} className={className} style={{ width: "100%", height: "100%", position: "relative" }} />;
}
