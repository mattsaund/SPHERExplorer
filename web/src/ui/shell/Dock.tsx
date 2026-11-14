// The tools panel on the right: settings for the images and the map, facts about the target,
// and saving. Each group folds away, so a newcomer sees a short list and an expert finds everything.
// Written with Claude Code (Anthropic) assistance.
import {
  COLOR_MAPS,
  COLOR_PRESETS,
  PROJECTIONS,
  SKY_LAYERS,
  actions,
  distanceMethod,
  formatAu,
  formatDistance,
  useStore,
  type ColorMap,
  type Stretch,
  type Subtract,
} from "../../core";
import { copyText, layout, useLayout } from "../layout";
import { MODES } from "./BottomBar";

const STRETCHES: { value: Stretch; label: string }[] = [
  { value: "asinh", label: "Balanced (asinh)" },
  { value: "linear", label: "Straight (linear)" },
  { value: "sqrt", label: "Square root" },
  { value: "log", label: "Logarithm" },
];
const FIELD_SIZES = [120, 300, 600, 1200];

/** Name, kind, distance, and a link to everything known about the target. */
function About() {
  const target = useStore((s) => s.target);
  // The first image of the step on screen, for distances that change from image to image.
  const shown = useStore((s) => {
    const item = s.sequence[s.player.index];
    return item ? s.frames[item.frameIds[0]] : null;
  });
  if (!target) return null;
  return (
    <details open>
      <summary>About this target</summary>
      <p><strong>{target.name ?? "Custom position"}</strong>{target.kind ? `. ${target.kind}` : ""}</p>
      {target.distance && <p>Distance: {formatDistance(target.distance)}, {distanceMethod(target.distance.method)}.</p>}
      {target.moving && shown?.earthDistance != null && (
        <p>
          Distance at this image: {formatAu(shown.earthDistance)} from Earth
          {shown.sunDistance != null && `, ${formatAu(shown.sunDistance)} from the Sun`}.
        </p>
      )}
      {target.url && (
        <p>
          <a href={target.url} target="_blank" rel="noreferrer">Full details{target.moving ? " at NASA JPL" : " in the SIMBAD database"}</a>
          {target.moving ? " (orbit, size, and discovery)" : " (names, measurements, and research papers)"}
        </p>
      )}
    </details>
  );
}

/** What to play, which detectors take part, and how much sky is loaded. */
function WhatToPlay() {
  const mode = useStore((s) => s.mode);
  const detectors = useStore((s) => s.filters.detectors);
  const meta = useStore((s) => s.meta);
  const fieldSize = useStore((s) => s.fieldSize);
  return (
    <details open>
      <summary>What to play</summary>
      <div className="choices" role="radiogroup" aria-label="What to play">
        {MODES.map((option) => (
          <button key={option.value} role="radio" aria-checked={mode === option.value} className={mode === option.value ? "on" : ""} title={option.hint} onClick={() => actions.setMode(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      <p className="muted">{MODES.find((option) => option.value === mode)?.hint}.</p>
      <p className="group">Detectors (wavelength bands)</p>
      <div className="choices">
        {detectors.map((on, i) => {
          const range = meta?.detectors[String(i + 1)];
          return (
            <button key={i} className={on ? "on" : ""} aria-pressed={on} onClick={() => actions.toggleDetector(i + 1)}>
              {i + 1}
              {range && <small> {range.min.toFixed(1)} to {range.max.toFixed(1)} µm</small>}
            </button>
          );
        })}
      </div>
      <label>
        Field width
        <select value={fieldSize} onChange={(event) => actions.setFieldSize(Number(event.target.value))}>
          {[...new Set([...FIELD_SIZES, fieldSize])].sort((a, b) => a - b).map((size) => (
            <option key={size} value={size}>{Number((size / 60).toFixed(1))} arcmin</option>
          ))}
        </select>
      </label>
    </details>
  );
}

/** Full color, and showing only what changed. */
function ColorAndChange() {
  const display = useStore((s) => s.display);
  const subtract = useStore((s) => s.subtract);
  const follow = useStore((s) => s.follow);
  return (
    <details>
      <summary>Color and change</summary>
      <label className="check"><input type="checkbox" checked={display.color} onChange={(e) => actions.setDisplay({ color: e.target.checked })} /> Full color</label>
      {display.color && (
        <>
          <label>
            Color recipe
            <select value={display.bands.id} onChange={(event) => actions.setDisplay({ bands: COLOR_PRESETS.find((preset) => preset.id === event.target.value) })}>
              {COLOR_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <p className="muted">{display.bands.about}</p>
        </>
      )}
      <label>
        Show only changes
        <select value={subtract} onChange={(event) => actions.setSubtract(event.target.value as Subtract)}>
          <option value="none">Off</option>
          <option value="others">Minus all other images</option>
          <option value="first">Minus the first</option>
          <option value="previous">Minus the one before</option>
        </select>
      </label>
      {subtract !== "none" && <p className="muted">Unchanged sky is gray. White is brighter than before, black is fainter. A moving object shows as a white and black pair.</p>}
      <label className="check"><input type="checkbox" checked={follow} onChange={(e) => actions.setFollow(e.target.checked)} /> Follow the target when summing</label>
    </details>
  );
}

/** How brightness is drawn. */
function Brightness() {
  const display = useStore((s) => s.display);
  return (
    <details>
      <summary>Brightness and look</summary>
      <button onClick={() => actions.autoStretch()}>Auto contrast</button>
      <label>
        Black point
        <input type="range" min={-10} max={20} step={0.5} value={display.lo} onChange={(event) => actions.setDisplay({ lo: Number(event.target.value) })} />
      </label>
      <label>
        White point
        <input type="range" min={5} max={500} step={1} value={display.hi} onChange={(event) => actions.setDisplay({ hi: Number(event.target.value) })} />
      </label>
      <label>
        Brightness curve
        <select value={display.stretch} onChange={(event) => actions.setDisplay({ stretch: event.target.value as Stretch })}>
          {STRETCHES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>
        Color table
        <select value={display.colorMap} onChange={(event) => actions.setDisplay({ colorMap: event.target.value as ColorMap })}>
          {COLOR_MAPS.map((name) => <option key={name} value={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={display.invert} onChange={(e) => actions.setDisplay({ invert: e.target.checked })} /> Invert</label>
      <label className="check"><input type="checkbox" checked={display.smooth} onChange={(e) => actions.setDisplay({ smooth: e.target.checked })} /> Smooth pixels</label>
    </details>
  );
}

/** Marks drawn over the image. */
function Overlays() {
  const display = useStore((s) => s.display);
  return (
    <details>
      <summary>Marks on the image</summary>
      <label className="check"><input type="checkbox" checked={display.showMarker} onChange={(e) => actions.setDisplay({ showMarker: e.target.checked })} /> Mark the target</label>
      <label className="check"><input type="checkbox" checked={display.showObjects} onChange={(e) => actions.setDisplay({ showObjects: e.target.checked })} /> Label known objects</label>
      <label className="check"><input type="checkbox" checked={display.showGaia} onChange={(e) => actions.setDisplay({ showGaia: e.target.checked })} /> Mark Gaia stars</label>
      <label className="check"><input type="checkbox" checked={display.showChanges} onChange={(e) => actions.setDisplay({ showChanges: e.target.checked })} /> Mark found changes</label>
      <label className="check"><input type="checkbox" checked={display.showFlags} onChange={(e) => actions.setDisplay({ showFlags: e.target.checked })} /> Show bad pixels</label>
      <button onClick={() => actions.resetView()}>Reset zoom</button>
    </details>
  );
}

/** Save what is on screen, or share it. */
function SaveAndShare() {
  const count = useStore((s) => s.sequence.length);
  const exporting = useStore((s) => s.exporting);
  return (
    <details>
      <summary>Save and share</summary>
      <button onClick={() => void actions.saveImage()} disabled={!count}>Save picture</button>
      <button onClick={() => void actions.saveAnimation()} disabled={count < 2 || exporting !== null}>
        {exporting !== null ? `Saving animation ${Math.round(exporting * 100)}%` : "Save animation"}
      </button>
      <button onClick={() => actions.saveSpectrum()} disabled={!count}>Save spectrum table</button>
      <button onClick={() => void copyText(actions.shareLink(), "Link copied")} disabled={!count}>Copy link</button>
      <button onClick={() => void copyText(actions.embedCode(), "Embed code copied")} disabled={!count} title="HTML that shows this view inside another web page">
        Copy embed code
      </button>
    </details>
  );
}

/** Which survey the map shows, and how. */
function MapTools() {
  const map = useStore((s) => s.map);
  const meta = useStore((s) => s.meta);
  const current = SKY_LAYERS.find((entry) => entry.id === map.layer) ?? SKY_LAYERS[0];
  return (
    <details open>
      <summary>Sky map</summary>
      <p className="muted">Drag to move, scroll to zoom. Click a label to learn about an object, or click anywhere to study that spot.</p>
      <label>
        Show
        <select value={map.layer} onChange={(e) => actions.setMap({ layer: e.target.value })}>
          {SKY_LAYERS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
      {current.cube && (
        <label>
          Color: {meta ? `${meta.channels[map.channel].toFixed(2)} µm` : `channel ${map.channel + 1}`}
          <input type="range" min={0} max={101} value={map.channel} onChange={(e) => actions.setMap({ channel: Number(e.target.value) })} />
        </label>
      )}
      <p className="muted">{current.mission}. {current.light}. {current.about}</p>
      <label>
        Map shape
        <select value={map.projection} onChange={(e) => actions.setMap({ projection: e.target.value })}>
          {PROJECTIONS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
      <p className="muted">{PROJECTIONS.find((entry) => entry.id === map.projection)?.about}</p>
      <label className="check"><input type="checkbox" checked={map.labels} onChange={(e) => actions.setMap({ labels: e.target.checked })} /> Labels</label>
      <label className="check"><input type="checkbox" checked={map.grid} onChange={(e) => actions.setMap({ grid: e.target.checked })} /> Grid</label>
      <button onClick={() => actions.flyTo({ ra: 266.4, dec: -29 }, 200)}>Whole sky</button>
    </details>
  );
}

export function Dock() {
  const open = useLayout((s) => s.dock);
  const stage = useLayout((s) => s.stage);
  const hasTarget = useStore((s) => s.target !== null);
  if (!open) return null;
  return (
    <aside className="dock" aria-label="Tools">
      <div className="dock-head">
        <h2>Tools</h2>
        <button onClick={() => layout.closeDock()} aria-label="Close the tools panel">Close</button>
      </div>
      <About />
      {stage !== "map" && hasTarget && (
        <>
          <WhatToPlay />
          <ColorAndChange />
          <Brightness />
          <Overlays />
        </>
      )}
      {stage !== "images" && <MapTools />}
      {hasTarget && <SaveAndShare />}
      {stage === "images" && !hasTarget && <p className="muted">Choose a place to see the image tools.</p>}
    </aside>
  );
}
