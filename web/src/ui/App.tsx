// The page: one full-page view between a top bar and a bottom bar. Both bars expand.
// Top bar: search with suggestions, the switch between the sky map and the images, and a drawer for test targets or settings.
// Middle: the sky map or the image viewer, or both side by side on a wide screen, with a label and messages laid over it.
// Bottom bar: a status line with the pointer readout, the player, and a dock of tools that opens upward.
// Every setting, for the images and for the map, lives in the one settings drawer, and the player
// is always in the bottom bar. Nothing changes place when the view changes.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  FrameView,
  SKY_LAYERS,
  SkyMap,
  actions,
  compass,
  distanceMethod,
  formatAngle,
  formatAu,
  formatDec,
  formatDistance,
  formatFlux,
  formatRa,
  useStore,
  type SequenceMode,
} from "../core";
import { AreaCard, Chevron, CopyButton, ObjectCard, ObjectsCard, SpotCard, coordinates, useAreaShown } from "./cards";
import { Embed } from "./Embed";
import { SearchBox } from "./SearchBox";
import { Examples, Settings } from "./settings";
import { TOOLS } from "./tools";
import "./styles/app.css";

/** What fills the stage. "both" puts the map and the images side by side, on screens wide enough. */
type ViewId = "map" | "images" | "both";
/** Narrower than this, the stage shows one view at a time. */
const WIDE = 1100;

/**
 * The view after the player is used. Playing a film nobody can see would be confusing, so
 * from the map alone the images come into view: beside the map on a wide screen, in its
 * place on a narrow one.
 */
function withImages(now: ViewId): ViewId {
  if (now !== "map" || useStore.getState().target === null) return now;
  return window.innerWidth >= WIDE ? "both" : "images";
}

const MODES: { value: SequenceMode; label: string; hint: string }[] = [
  { value: "exposures", label: "Every image", hint: "Each exposure in time order" },
  { value: "visits", label: "By visit", hint: "One summed image per visit. Best for spotting motion" },
  { value: "channels", label: "By wavelength", hint: "One summed image per wavelength channel" },
  { value: "deep", label: "Deepest", hint: "Every image summed into one" },
];

/** Step arrows drawn as shapes. Arrow characters render as emoji on some phones. */
function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d={back ? "M11 2 3 7l8 5z" : "M3 2l8 5-8 5z"} fill="currentColor" />
    </svg>
  );
}

/** A message the reader can close. It comes back if the store clears it and later sets it again. */
function useClosable<T>(value: T | null): [boolean, () => void] {
  const [closed, setClosed] = useState<T | null>(null);
  useEffect(() => {
    if (value === null) setClosed(null);
  }, [value]);
  return [value !== null && value !== closed, () => setClosed(value)];
}

function ViewSwitch({ view, onChange }: { view: ViewId; onChange: (view: ViewId) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="What to show">
      <button role="radio" aria-checked={view === "map"} onClick={() => onChange("map")}>Sky map</button>
      <button role="radio" aria-checked={view === "images"} onClick={() => onChange("images")}>Images</button>
      <button className="only-wide" role="radio" aria-checked={view === "both"} title="The map and the images side by side" onClick={() => onChange("both")}>Both</button>
    </div>
  );
}

function DrawerToggle({ open, onClick, children }: { open: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="toggle" aria-expanded={open} aria-controls="top-drawer" onClick={onClick}>
      {children} <Chevron />
    </button>
  );
}

/**
 * The details box, in the upper right corner of the image viewer: what the target is, where
 * its field is centered, how far it is, which image is on screen, and where to read
 * everything known about it. It has the look of the coordinates box on the sky map: each row
 * is a label, a value, and a small button. It folds down to its first row.
 */
function DetailsCard() {
  const target = useStore((s) => s.target);
  const fieldSize = useStore((s) => s.fieldSize);
  const item = useStore((s) => s.sequence[s.player.index]);
  const frame = useStore((s) => {
    const step = s.sequence[s.player.index];
    return step && step.frameIds.length === 1 ? s.frames[step.frameIds[0]] : null;
  });
  // The first image of the step on screen, for what changes from image to image.
  const shown = useStore((s) => {
    const step = s.sequence[s.player.index];
    return step ? s.frames[step.frameIds[0]] : null;
  });
  // On a phone the image is small, so the box starts folded to its first row.
  const [open, setOpen] = useState(() => window.innerWidth >= 720);
  if (!target) return null;
  // A planet or comet has a new place in every image. A fixed field has one center.
  const center = target.moving ? shown?.center ?? null : target;
  const facts = [`${Number((fieldSize / 60).toFixed(1))} arcmin`];
  if (frame) facts.push(`Detector ${frame.detector}`);
  if (frame?.phot?.flux != null && frame.phot.err != null) facts.push(`Brightness ${formatFlux(frame.phot.flux)} ± ${formatFlux(frame.phot.err)}`);
  return (
    <section className={open ? "stage-label place details open" : "stage-label place details"} aria-label="Details">
      <p className="place-row">
        <span className="muted">Target</span>
        <span>
          <strong>{target.name ?? "Custom position"}</strong>
          {target.kind && <span className="muted kind">, {target.kind}</span>}
        </span>
        <button aria-expanded={open} onClick={() => setOpen((now) => !now)} title={open ? "Fold the details away" : "Show the details"}>
          {open ? "Hide" : "Details"}
        </button>
      </p>
      {open && (
        <>
          {center && (
            <p className="place-row">
              <span className="muted">Center</span>
              <span className="mono">{coordinates(center)}</span>
              <CopyButton text={coordinates(center)} title="Copy the coordinates at the center of the images" />
            </p>
          )}
          {target.distance && (
            <p className="place-row">
              <span className="muted">Distance</span>
              <span>{formatDistance(target.distance)}, {distanceMethod(target.distance.method)}</span>
              <span />
            </p>
          )}
          {target.moving && shown?.earthDistance != null && (
            <p className="place-row">
              <span className="muted">Distance</span>
              <span>
                {formatAu(shown.earthDistance)} from Earth
                {shown.sunDistance != null && `, ${formatAu(shown.sunDistance)} from the Sun`}, at this image
              </span>
              <span />
            </p>
          )}
          {item && (
            <p className="place-row">
              <span className="muted">Image</span>
              <span>{item.label}</span>
              <span />
            </p>
          )}
          <p className="place-row">
            <span className="muted">Field</span>
            <span>{facts.join(". ")}</span>
            <span />
          </p>
          {target.url && (
            <p className="place-row">
              <span className="muted">More</span>
              <span>
                <a href={target.url} target="_blank" rel="noreferrer" title={target.moving ? "Orbit, size, and discovery" : "Names, measurements, and research papers"}>
                  Full details{target.moving ? " at NASA JPL" : " in the SIMBAD database"}
                </a>
              </span>
              <span />
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Upper left of the sky map: which survey is showing. */
function MapLabel() {
  const layerId = useStore((s) => s.map.layer);
  const layer = SKY_LAYERS.find((entry) => entry.id === layerId) ?? SKY_LAYERS[0];
  return (
    <div className="stage-label layer">
      <p><strong>{layer.name}</strong></p>
      <p className="muted">{layer.mission}. {layer.light}. {layer.about}</p>
    </div>
  );
}

/**
 * Lower left of the sky map: the coordinates under the pointer and at the middle of the map,
 * with a button that copies the middle. Both are right ascension and declination, J2000.
 * While the measure tool is on, the measured angle shows here too.
 */
function MapPlace() {
  const ready = useStore((s) => s.map.ready);
  const center = useStore((s) => s.map.center);
  const hover = useStore((s) => s.mapHover);
  const measuring = useStore((s) => s.map.measuring);
  const measured = useStore((s) => s.map.measured);
  if (!ready) return null;
  const middle = `${formatRa(center.ra)} ${formatDec(center.dec)}`;
  return (
    <div className="stage-label place" aria-label="Coordinates on the sky map, J2000" title="Right ascension and declination, J2000">
      {measuring && (
        <p className="place-row">
          <span className="muted">Measure</span>
          <span aria-live="polite">{measured ? `${formatAngle(measured.separation)}, toward the ${compass(measured.angle)}` : "Drag on the map"}</span>
          <button onClick={() => actions.setMap({ measuring: false })}>Done</button>
        </p>
      )}
      {/* Kept even when empty, so the box does not change height as the pointer comes and goes. */}
      <p className="place-row pointer">
        <span className="muted">Pointer</span>
        <span className="mono">{hover ? `${formatRa(hover.ra)} ${formatDec(hover.dec)}` : ""}</span>
        <span />
      </p>
      <p className="place-row">
        <span className="muted">Center</span>
        <span className="mono">{middle}</span>
        <CopyButton text={middle} title="Copy the coordinates at the center of the map" />
      </p>
    </div>
  );
}

/**
 * The card for the sky map: an object chosen on the map, or else the selected area.
 * An object chosen on the image side is shown there, in the list of objects.
 * `onClose` runs when the selected area is closed, which also closes the image study.
 */
function MapCards({ showImages, onClose }: { showImages: () => void; onClose: () => void }) {
  const chosen = useStore((s) => (s.map.selectedIn === "map" ? s.map.selected : null));
  if (chosen) return <ObjectCard object={chosen} onStudy={showImages} />;
  return <AreaCard onClose={onClose} />;
}

/**
 * The card for the image side, beside the list of objects: a spot picked in the images.
 * With the images alone on screen, an object chosen earlier on the map that is not in the
 * list still gets its card.
 */
function ImageCards({ both, openTool, showImages }: { both: boolean; openTool: (id: string) => void; showImages: () => void }) {
  const chosen = useStore((s) => s.map.selected);
  const listed = useStore((s) => {
    const id = s.map.selected?.id;
    return id !== undefined && (s.fieldObjects.some((object) => object.id === id) || s.movers.some((object) => object.id === id));
  });
  const fromImages = useStore((s) => s.map.pickedIn === "images");
  const picked = useStore((s) => s.map.picked !== null);
  if (chosen) return both || listed ? null : <ObjectCard object={chosen} onStudy={showImages} />;
  if (picked && (!both || fromImages)) return <SpotCard openTool={openTool} />;
  return null;
}

/** Problems and notes from the engine, laid over the stage so the layout never shifts. */
function Messages({ view }: { view: ViewId }) {
  const error = useStore((s) => s.error);
  const notice = useStore((s) => s.notice);
  const mapFailure = useStore((s) => s.map.failure);
  const [showError, closeError] = useClosable(error);
  const [showNotice, closeNotice] = useClosable(notice);
  return (
    <>
      {showError && (
        <div className="box alert" role="alert">
          <p>{error}</p>
          <div className="row wrap">
            <button className="primary" onClick={() => actions.reload()}>Try again</button>
            <button onClick={closeError}>Close</button>
          </div>
        </div>
      )}
      {view !== "images" && mapFailure && (
        <div className="box alert" role="alert"><p>{mapFailure}</p></div>
      )}
      {showNotice && (
        <div className="box">
          <p>{notice}</p>
          <div className="row"><button onClick={closeNotice}>Close</button></div>
        </div>
      )}
    </>
  );
}

/** The image viewer before any target is chosen. */
function EmptyImages() {
  const searching = useStore((s) => s.targetState === "loading");
  if (searching) return null;
  return (
    <div className="empty-stage">
      <p>Type a name or coordinates in the Find box, or pick a test target.</p>
      <Examples />
    </div>
  );
}

function Readout() {
  const hover = useStore((s) => s.hover);
  const flags = useStore((s) => s.meta?.flags);
  if (!hover) return <p className="hint-text">Move the pointer over the image for values.</p>;
  const names = flags ? flags.filter((f) => hover.bits & (1 << f.bit)).map((f) => f.name) : [];
  return (
    <p className="readout">
      <span>{formatRa(hover.ra)} {formatDec(hover.dec)}</span>
      <span>
        {hover.value != null ? `${hover.value.toFixed(3)} MJy/sr` : "no data"}
        {hover.wavelength != null && `, ${hover.wavelength.toFixed(3)} µm`}
      </span>
      {names.length > 0 && <span>{names.join(", ")}</span>}
    </p>
  );
}

/**
 * A small ring that fills as work is done. `value` runs from 0 to 1.
 * With null the ring turns instead, for work whose length is not known yet.
 */
function ProgressRing({ value, label }: { value: number | null; label: string }) {
  const size = 18;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const around = 2 * Math.PI * radius;
  const share = value === null ? 0.25 : Math.min(1, Math.max(0, value));
  return (
    <svg
      className={value === null ? "ring turning" : "ring"}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(share * 100)}
    >
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
      {/* The arc starts at the top and runs clockwise. */}
      <circle
        className="ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeDasharray={around}
        strokeDashoffset={around * (1 - share)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/** One line under the stage: progress on the left, the pointer readout or map help on the right. Its height is fixed. */
function StatusBar({ view }: { view: ViewId }) {
  const targetState = useStore((s) => s.targetState);
  const framesState = useStore((s) => s.framesState);
  // Images skipped on purpose (off the detector edge, or thinned for speed) are not waited for.
  const total = useStore((s) => s.frames.filter((f) => f.status !== "outside").length);
  const loaded = useStore((s) => s.loaded);
  const failed = useStore((s) => s.failed);
  const leftOut = useStore((s) => s.leftOut);
  const areaShown = useAreaShown();
  const count = (n: number) => n.toLocaleString("en-US");

  let text = "Pick a target or enter coordinates to begin.";
  // The ring: null turns while the archive is searched, a number fills while images arrive.
  let progress: number | null | undefined;
  if (targetState === "loading") {
    text = "Searching the SPHEREx archive…";
    progress = null;
  } else if (targetState === "ready" && total === 0) {
    text = "SPHEREx has no public images of this spot yet.";
  } else if (framesState === "loading") {
    text = `Loading images ${count(loaded + failed)}/${count(total)}`;
    progress = total ? (loaded + failed) / total : 0;
  } else if (framesState === "ready") {
    text = leftOut > 0 ? `${count(loaded)} of ${count(loaded + failed + leftOut)} images loaded` : `${count(loaded)} images loaded`;
    text += failed ? `, ${count(failed)} could not be read.` : ".";
    // A very large field holds more pixels than a page can keep in memory. Said here, not in a message box.
    if (leftOut > 0) text += " A field this large is sampled evenly over time to keep the page fast. A smaller field loads every image.";
    // With the map alone on screen, say where the images are. A narrow screen has no Both view.
    else if (view === "map" && loaded > 0) text += window.innerWidth >= WIDE ? " Choose Images or Both to see them." : " Choose Images to see them.";
  }
  const why = leftOut > 0 ? `Every image is kept in memory so that playing, summing, and measuring are instant. ${count(leftOut)} images were left out. Choose a smaller field to load them all.` : undefined;

  return (
    <div className="statusbar">
      <p className="status" aria-live="polite" title={why}>
        {progress !== undefined && <ProgressRing value={progress} label={progress === null ? "Searching" : "Images loaded"} />}
        <span>{text}</span>
      </p>
      {view !== "map" ? (
        <Readout />
      ) : (
        <p className="hint-text">
          {areaShown
            ? "Drag the square to move it, or drag its edge to resize it. Click anywhere else to load a new area."
            : "Drag to move, scroll to zoom. Click a label to learn about an object, or click anywhere to load that area."}
        </p>
      )}
    </div>
  );
}

/** onUse runs whenever the player is used, so the page can bring the images into view. */
function PlayerBar({ onUse }: { onUse: () => void }) {
  const count = useStore((s) => s.sequence.length);
  const index = useStore((s) => s.player.index);
  const playing = useStore((s) => s.player.playing);
  const fps = useStore((s) => s.player.fps);
  const mode = useStore((s) => s.mode);
  return (
    <div className="controlbar" role="group" aria-label="Player">
      <div className="transport">
        <button className="icon" onClick={() => { actions.step(-1); onUse(); }} disabled={count < 2} aria-label="Previous image"><Arrow back /></button>
        <button className="primary play" onClick={() => { actions.togglePlay(); onUse(); }} disabled={count < 2}>
          {playing ? "Pause" : "Play"}
        </button>
        <button className="icon" onClick={() => { actions.step(1); onUse(); }} disabled={count < 2} aria-label="Next image"><Arrow /></button>
        <input
          type="range"
          min={0}
          max={Math.max(0, count - 1)}
          value={Math.min(index, Math.max(0, count - 1))}
          onChange={(event) => { actions.seek(Number(event.target.value)); onUse(); }}
          aria-label="Position in the sequence"
          disabled={count < 2}
        />
        <span className="count">{count ? `${index + 1} / ${count}` : "0 / 0"}</span>
      </div>
      <label className="inline">
        Speed
        <input type="range" min={1} max={20} step={1} value={fps} onChange={(event) => actions.setSpeed(Number(event.target.value))} />
      </label>
      <div className="segmented" role="radiogroup" aria-label="What to play">
        {MODES.map((option) => (
          <button key={option.value} role="radio" aria-checked={mode === option.value} title={option.hint} onClick={() => { actions.setMode(option.value); onUse(); }}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface DockProps {
  tool: string;
  open: boolean;
  tall: boolean;
  onTool: (id: string) => void;
  onTall: () => void;
  onClose: () => void;
  showMap: () => void;
  showImages: () => void;
}

/** The tool tabs. A tab opens the dock upward. The open tool is the only one on the page, so hidden plots cost nothing. */
function Dock({ tool, open, tall, onTool, onTall, onClose, showMap, showImages }: DockProps) {
  const Panel = (TOOLS.find((entry) => entry.id === tool) ?? TOOLS[0]).Panel;
  return (
    <section className="dock" aria-label="Tools">
      <div className="dock-head">
        <div className="dock-tabs">
          {TOOLS.map((entry) => (
            <button key={entry.id} aria-expanded={open && entry.id === tool} aria-controls="dock-body" onClick={() => onTool(entry.id)}>
              {entry.label}
            </button>
          ))}
        </div>
        {open && (
          <div className="dock-actions">
            <button aria-pressed={tall} onClick={onTall}>{tall ? "Shrink" : "Expand"}</button>
            <button onClick={onClose}>Close <Chevron /></button>
          </div>
        )}
      </div>
      <div id="dock-body" className={tall ? "dock-body tall" : "dock-body"} hidden={!open}>
        {open && <Panel showMap={showMap} showImages={showImages} />}
      </div>
    </section>
  );
}

export function App() {
  const [view, setView] = useState<ViewId>("map");
  // The view as the engine's listeners see it, without waiting for a render.
  const viewNow = useRef(view);
  viewNow.current = view;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tool, setTool] = useState(TOOLS[0].id);
  const [dockOpen, setDockOpen] = useState(false);
  const [dockTall, setDockTall] = useState(false);
  const hasTarget = useStore((s) => s.target !== null);
  const embed = useStore((s) => s.embed);

  useEffect(() => {
    actions.init();
    // A link that names a target opens on its images.
    if (useStore.getState().targetState === "loading") setView("images");
    // A new study, from a search or a click on the map, brings the image study up beside the
    // map (Matt's decision): on a wide screen the view goes from the map alone to both.
    // Closing the selected area puts the image study away again. A narrow screen has no room
    // for both, so its view stays put and the status line says where the images are.
    // `session` counts studies, so a name that is not found changes nothing.
    return useStore.subscribe((next, before) => {
      if (next.session === before.session || next.target === null) return;
      if (window.innerWidth < WIDE || viewNow.current !== "map") return;
      // The map is about to shrink to the left half of the page. Center it on the new field,
      // so the selected area is still in sight. The zoom is left as it is.
      if (!next.target.moving) actions.flyTo(next.target);
      setView("both");
    });
  }, []);

  // Side by side needs room. If the window is made narrow, fall back to the images alone.
  useEffect(() => {
    const onResize = () => setView((now) => (now === "both" && window.innerWidth < WIDE ? "images" : now));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Keys for the film: space plays and pauses, the arrows step. Not while typing or on a control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName ?? "";
      if (event.ctrlKey || event.metaKey || event.altKey || ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A", "SUMMARY"].includes(tag)) return;
      if (event.key === " ") actions.togglePlay();
      else if (event.key === "ArrowRight") actions.step(1);
      else if (event.key === "ArrowLeft") actions.step(-1);
      else return;
      event.preventDefault();
      setView(withImages);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // With both on screen, nothing needs to come to the front.
  const showImages = () => setView((now) => (now === "both" ? now : "images"));
  const showMap = () => setView((now) => (now === "both" ? now : "map"));

  function chooseTool(id: string) {
    if (dockOpen && id === tool) {
      setDockOpen(false);
    } else {
      setTool(id);
      setDockOpen(true);
    }
  }

  // A page opened with embed=1 sits inside another site, so it gets the compact layout.
  if (embed) return <Embed />;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">SPHERExplorer</h1>
        <SearchBox />
        <ViewSwitch view={view} onChange={setView} />
        <div className="toggles">
          <DrawerToggle open={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}>Settings</DrawerToggle>
        </div>
      </header>

      <section id="top-drawer" className="drawer split" hidden={!settingsOpen} aria-label="Settings">
        {settingsOpen && <Settings />}
      </section>

      {/* Both views stay mounted and keep their size. The hidden one is only made invisible,
          so the map keeps its place and "Save picture" works from either view. */}
      <main className={`stage ${view}`} aria-label={view === "map" ? "Sky map" : view === "images" ? "Image viewer" : "Sky map and image viewer"}>
        <div className={view === "images" ? "view map off" : "view map"}><SkyMap /></div>
        <div className={view === "map" ? "view images off" : "view images"}>{hasTarget ? <FrameView /> : <EmptyImages />}</div>
        {view !== "images" && <MapLabel />}
        {view !== "images" && <MapPlace />}
        {/* The image side's own cards, along its top: every object in the field on the left,
            the details of the target on the right. They stay mounted while the map alone is
            showing, so a card the person folded away is still folded when the images come back. */}
        <div className="image-cards" hidden={view === "map"}>
          <ObjectsCard />
          <DetailsCard />
        </div>
        {/* With both views up, the map's card sits over the map and the image side's over the images. */}
        {view === "both" && (
          <div className="overlay beside-map"><MapCards showImages={showImages} onClose={() => setView("map")} /></div>
        )}
        <div className="overlay">
          {view === "map" && <MapCards showImages={showImages} onClose={() => setView("map")} />}
          {view !== "map" && <ImageCards both={view === "both"} openTool={(id) => { setTool(id); setDockOpen(true); }} showImages={showImages} />}
          <Messages view={view} />
        </div>
      </main>

      <StatusBar view={view} />
      <PlayerBar onUse={() => setView(withImages)} />
      <Dock
        tool={tool}
        open={dockOpen}
        tall={dockTall}
        onTool={chooseTool}
        onTall={() => setDockTall((tall) => !tall)}
        onClose={() => setDockOpen(false)}
        showMap={showMap}
        showImages={showImages}
      />
    </div>
  );
}
