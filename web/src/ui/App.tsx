// The page: one full-page view between a top bar and a bottom bar. Both bars expand.
// Top bar: search, the switch between the sky map and the images, and a drawer for test targets or image settings.
// Middle: the sky map or the image viewer, with a label and messages laid over it.
// Bottom bar: a status line with the pointer readout, the player or the map controls, and a dock of tools that opens upward.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  FrameView,
  PROJECTIONS,
  SKY_LAYERS,
  SkyMap,
  actions,
  distanceMethod,
  formatAu,
  formatDec,
  formatDistance,
  formatFlux,
  formatRa,
  useStore,
  type SequenceMode,
} from "../core";
import { Embed } from "./Embed";
import { Examples, ImageSettings } from "./settings";
import { TOOLS } from "./tools";
import "./styles/app.css";

type ViewId = "map" | "images";
type TopDrawer = "examples" | "settings";

const MODES: { value: SequenceMode; label: string; hint: string }[] = [
  { value: "exposures", label: "Every image", hint: "Each exposure in time order" },
  { value: "visits", label: "By visit", hint: "One summed image per visit. Best for spotting motion" },
  { value: "channels", label: "By wavelength", hint: "One summed image per wavelength channel" },
  { value: "deep", label: "Deepest", hint: "Every image summed into one" },
];

/** Points down. Turns up while its drawer is open (see app.css). */
function Chevron() {
  return (
    <svg className="chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

function SearchBar() {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) {
      setProblem('Enter a name such as "Vega", or J2000 coordinates such as "133.76 -7.24" or "08h55m10.8s -07d14m42s".');
      return;
    }
    setProblem(null);
    void actions.search(text);
  }

  return (
    <form className="search" onSubmit={submit} role="search">
      <label htmlFor="search-input">Find</label>
      <input
        id="search-input"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setProblem(null);
        }}
        placeholder="Object name, or RA and Dec (J2000), for example Vega or 08h55m10.8s -07d14m42s"
        autoComplete="off"
        spellCheck={false}
        aria-describedby={problem ? "search-problem" : undefined}
      />
      <button type="submit" className="primary">Go</button>
      {/* Laid over the page below the search box, so the top bar never changes height. */}
      {problem && <p id="search-problem" className="problem popover" role="alert">{problem}</p>}
    </form>
  );
}

function ViewSwitch({ view, onChange }: { view: ViewId; onChange: (view: ViewId) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="What to show">
      <button role="radio" aria-checked={view === "map"} onClick={() => onChange("map")}>Sky map</button>
      <button role="radio" aria-checked={view === "images"} onClick={() => onChange("images")}>Images</button>
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

/** Upper left of the image viewer: what is on screen. */
function ImageLabel() {
  const target = useStore((s) => s.target);
  const fieldSize = useStore((s) => s.fieldSize);
  const item = useStore((s) => s.sequence[s.player.index]);
  const frame = useStore((s) => {
    const step = s.sequence[s.player.index];
    return step && step.frameIds.length === 1 ? s.frames[step.frameIds[0]] : null;
  });
  // The first image of the step on screen, for distances that change from image to image.
  const shown = useStore((s) => {
    const step = s.sequence[s.player.index];
    return step ? s.frames[step.frameIds[0]] : null;
  });
  if (!target) return null;
  const facts = [`${fieldSize / 60} arcmin field`];
  if (frame) facts.push(`Detector ${frame.detector}`);
  if (frame?.phot?.flux != null && frame.phot.err != null) facts.push(`Brightness ${formatFlux(frame.phot.flux)} ± ${formatFlux(frame.phot.err)}`);
  if (target.moving && shown?.earthDistance != null) facts.push(`${formatAu(shown.earthDistance)} from Earth`);
  return (
    <div className="stage-label">
      <p>
        <strong>{target.name ?? "Custom position"}</strong>
        {target.kind && <span className="muted kind">. {target.kind}</span>}
      </p>
      {item && <p>{item.label}</p>}
      <p className="muted">{facts.join(". ")}</p>
    </div>
  );
}

/** Upper left of the sky map: which survey is showing. */
function MapLabel() {
  const layerId = useStore((s) => s.map.layer);
  const layer = SKY_LAYERS.find((entry) => entry.id === layerId) ?? SKY_LAYERS[0];
  return (
    <div className="stage-label">
      <p><strong>{layer.name}</strong></p>
      <p className="muted">{layer.mission}. {layer.light}. {layer.about}</p>
    </div>
  );
}

/** Facts about an object clicked on the map or in a frame, or a spot of sky clicked in either. */
function InfoBox({ view, openTool, showImages }: { view: ViewId; openTool: (id: string) => void; showImages: () => void }) {
  const chosen = useStore((s) => s.map.selected);
  const picked = useStore((s) => s.map.picked);
  const target = useStore((s) => s.target);
  const fieldSize = useStore((s) => s.fieldSize);
  if (chosen) {
    return (
      <section className="box" aria-label={`About ${chosen.name}`}>
        <h2>{chosen.name}</h2>
        <p>{chosen.kind ?? "Known object"}{chosen.spectralType ? `, type ${chosen.spectralType}` : ""}</p>
        <p className="mono">{formatRa(chosen.ra)} {formatDec(chosen.dec)}</p>
        {chosen.distance && <p>Distance: {formatDistance(chosen.distance)}, {distanceMethod(chosen.distance.method)}</p>}
        {chosen.refs != null && <p className="muted">Mentioned in {chosen.refs.toLocaleString("en-US")} papers</p>}
        <div className="row wrap">
          <button className="primary" onClick={() => { actions.studyObject(chosen); showImages(); }}>Study in SPHEREx</button>
          <a className="button" href={chosen.url} target="_blank" rel="noreferrer">Full details</a>
          <button onClick={() => actions.selectObject(null)}>Close</button>
        </div>
      </section>
    );
  }
  if (picked && view === "map") {
    // On the map the pick is an area the size of the field, drawn as a square with grips.
    return (
      <section className="box" aria-label="Selected area">
        <h2>Selected area</h2>
        <p className="mono">{formatRa(picked.ra)} {formatDec(picked.dec)}</p>
        <p>{(fieldSize / 60).toFixed(1)} arcminutes across. Drag the edge of the red square to resize it.</p>
        <div className="row wrap">
          <button className="primary" onClick={() => { actions.goTo({ ...picked, epoch: 2026.0 }); showImages(); }}>Study this area</button>
          <button onClick={() => actions.pick(null)}>Close</button>
        </div>
      </section>
    );
  }
  if (picked) {
    // In the frames, a spot can be measured in place. A planet or comet has no fixed field to measure in.
    const canMeasure = target !== null && !target.moving;
    return (
      <section className="box" aria-label="Selected spot">
        <h2>Selected spot</h2>
        <p className="mono">{formatRa(picked.ra)} {formatDec(picked.dec)}</p>
        <div className="row wrap">
          {canMeasure && (
            <button className="primary" onClick={() => { actions.probe(picked); openTool("spectrum"); }}>Spectrum here</button>
          )}
          <button className={canMeasure ? "" : "primary"} onClick={() => actions.goTo({ ...picked, epoch: 2026.0 })}>Study this spot</button>
          <button onClick={() => actions.pick(null)}>Close</button>
        </div>
      </section>
    );
  }
  return null;
}

/** Problems and notes from the engine, laid over the stage so the layout never shifts. */
function Messages({ view, showImages }: { view: ViewId; showImages: () => void }) {
  const error = useStore((s) => s.error);
  const notice = useStore((s) => s.notice);
  const movers = useStore((s) => (s.movers.length ? s.movers : null));
  const mapFailure = useStore((s) => s.map.failure);
  const [showError, closeError] = useClosable(error);
  const [showNotice, closeNotice] = useClosable(notice);
  const [showMovers, closeMovers] = useClosable(movers);
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
      {view === "map" && mapFailure && (
        <div className="box alert" role="alert"><p>{mapFailure}</p></div>
      )}
      {showMovers && movers && (
        <div className="box hint">
          {movers.slice(0, 2).map((mover) => (
            <p key={mover.id}>
              {mover.name}{mover.kind ? ` (${mover.kind.toLowerCase()})` : ""} moves quickly across the sky and is near these coordinates. It may have moved since they were measured.{" "}
              <button onClick={() => { actions.studyObject(mover); showImages(); }}>Follow {mover.name}</button>
            </p>
          ))}
          <div className="row"><button onClick={closeMovers}>Close</button></div>
        </div>
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

/** One line under the stage: progress on the left, the pointer readout or map help on the right. Its height is fixed. */
function StatusBar({ view }: { view: ViewId }) {
  const targetState = useStore((s) => s.targetState);
  const framesState = useStore((s) => s.framesState);
  // Images skipped on purpose (off the detector edge, or thinned for speed) are not waited for.
  const total = useStore((s) => s.frames.filter((f) => f.status !== "outside").length);
  const loaded = useStore((s) => s.loaded);
  const failed = useStore((s) => s.failed);

  let text = "Pick a target or enter coordinates to begin.";
  if (targetState === "loading") text = "Searching the SPHEREx archive…";
  else if (targetState === "ready" && total === 0) text = "SPHEREx has no public images of this spot yet.";
  else if (framesState === "loading") text = `Loading images: ${loaded + failed} of ${total}`;
  else if (framesState === "ready") text = `${loaded} images loaded${failed ? `, ${failed} could not be read` : ""}.`;

  return (
    <div className="statusbar">
      <p className="status" aria-live="polite">
        <span>{text}</span>
        {framesState === "loading" && <progress max={total} value={loaded + failed} />}
      </p>
      {view === "images" ? (
        <Readout />
      ) : (
        <p className="hint-text">Drag to move, scroll to zoom. Click a label to learn about an object, or click anywhere to study that spot.</p>
      )}
    </div>
  );
}

function PlayerBar() {
  const count = useStore((s) => s.sequence.length);
  const index = useStore((s) => s.player.index);
  const playing = useStore((s) => s.player.playing);
  const fps = useStore((s) => s.player.fps);
  const mode = useStore((s) => s.mode);
  return (
    <div className="controlbar" role="group" aria-label="Player">
      <div className="transport">
        <button className="icon" onClick={() => actions.step(-1)} disabled={count < 2} aria-label="Previous image"><Arrow back /></button>
        <button className="primary play" onClick={() => actions.togglePlay()} disabled={count < 2}>
          {playing ? "Pause" : "Play"}
        </button>
        <button className="icon" onClick={() => actions.step(1)} disabled={count < 2} aria-label="Next image"><Arrow /></button>
        <input
          type="range"
          min={0}
          max={Math.max(0, count - 1)}
          value={Math.min(index, Math.max(0, count - 1))}
          onChange={(event) => actions.seek(Number(event.target.value))}
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
          <button key={option.value} role="radio" aria-checked={mode === option.value} title={option.hint} onClick={() => actions.setMode(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MapBar() {
  const layerId = useStore((s) => s.map.layer);
  const projection = useStore((s) => s.map.projection);
  const labels = useStore((s) => s.map.labels);
  const grid = useStore((s) => s.map.grid);
  const channel = useStore((s) => s.map.channel);
  const meta = useStore((s) => s.meta);
  const layer = SKY_LAYERS.find((entry) => entry.id === layerId) ?? SKY_LAYERS[0];
  return (
    <div className="controlbar" role="group" aria-label="Sky map controls">
      <label className="inline">
        Show
        <select value={layerId} onChange={(e) => actions.setMap({ layer: e.target.value })}>
          {SKY_LAYERS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
      <label className="inline">
        Map shape
        <select value={projection} onChange={(e) => actions.setMap({ projection: e.target.value })}>
          {PROJECTIONS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={labels} onChange={(e) => actions.setMap({ labels: e.target.checked })} /> Labels</label>
      <label className="check"><input type="checkbox" checked={grid} onChange={(e) => actions.setMap({ grid: e.target.checked })} /> Grid</label>
      <button onClick={() => actions.flyTo({ ra: 266.4, dec: -29 }, 200)}>Whole sky</button>
      {layer.cube && (
        <label className="inline channel">
          <span className="channel-name">Color: {meta ? `${meta.channels[channel].toFixed(2)} µm` : `channel ${channel + 1}`}</span>
          <input type="range" min={0} max={101} value={channel} onChange={(e) => actions.setMap({ channel: Number(e.target.value) })} />
        </label>
      )}
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
  const [top, setTop] = useState<TopDrawer | null>("examples");
  const [tool, setTool] = useState(TOOLS[0].id);
  const [dockOpen, setDockOpen] = useState(false);
  const [dockTall, setDockTall] = useState(false);
  const hasTarget = useStore((s) => s.target !== null);
  const embed = useStore((s) => s.embed);

  useEffect(() => {
    actions.init();
    // A link that names a target opens on its images, with the drawer closed.
    if (useStore.getState().targetState === "loading") {
      setView("images");
      setTop(null);
    }
    // A new search puts the test target list away but leaves the view alone. On the map,
    // the map moves to the target while its images load. Only the Study buttons switch views.
    return useStore.subscribe((next, before) => {
      if (next.targetState === "loading" && before.targetState !== "loading") setTop((open) => (open === "examples" ? null : open));
    });
  }, []);

  function chooseTool(id: string) {
    if (dockOpen && id === tool) {
      setDockOpen(false);
    } else {
      setTool(id);
      setDockOpen(true);
    }
  }

  const toggleTop = (drawer: TopDrawer) => setTop((open) => (open === drawer ? null : drawer));

  // A page opened with embed=1 sits inside another site, so it gets the compact layout.
  if (embed) return <Embed />;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">SPHERExplorer</h1>
        <SearchBar />
        <ViewSwitch view={view} onChange={setView} />
        <div className="toggles">
          <DrawerToggle open={top === "examples"} onClick={() => toggleTop("examples")}>Examples</DrawerToggle>
          <DrawerToggle open={top === "settings"} onClick={() => toggleTop("settings")}>Image settings</DrawerToggle>
        </div>
      </header>

      <section id="top-drawer" className="drawer" hidden={top === null} aria-label={top === "settings" ? "Image settings" : "Test targets"}>
        {top === "examples" && <Examples />}
        {top === "settings" && <ImageSettings />}
      </section>

      {/* Both views stay mounted and keep their size. The hidden one is only made invisible,
          so the map keeps its place and "Save picture" works from either view. */}
      <main className="stage" aria-label={view === "map" ? "Sky map" : "Image viewer"}>
        <div className={view === "map" ? "view" : "view off"}><SkyMap /></div>
        <div className={view === "images" ? "view" : "view off"}>{hasTarget ? <FrameView /> : <EmptyImages />}</div>
        {view === "images" ? <ImageLabel /> : <MapLabel />}
        <div className="overlay">
          <InfoBox view={view} openTool={(id) => { setTool(id); setDockOpen(true); }} showImages={() => setView("images")} />
          <Messages view={view} showImages={() => setView("images")} />
        </div>
      </main>

      <StatusBar view={view} />
      {view === "images" ? <PlayerBar /> : <MapBar />}
      <Dock
        tool={tool}
        open={dockOpen}
        tall={dockTall}
        onTool={chooseTool}
        onTall={() => setDockTall((tall) => !tall)}
        onClose={() => setDockOpen(false)}
        showMap={() => setView("map")}
        showImages={() => setView("images")}
      />
    </div>
  );
}
