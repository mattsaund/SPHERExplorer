// What the top drawer holds: the challenge test targets, and every setting for how images are drawn.
// Written with Claude Code (Anthropic) assistance.
import {
  COLOR_MAPS,
  COLOR_PRESETS,
  TEST_TARGETS,
  actions,
  useStore,
  type ColorMap,
  type Stretch,
  type Subtract,
} from "../core";

/** The curves by which brightness is drawn, with the name a newcomer would look for first. */
const STRETCHES: { value: Stretch; label: string }[] = [
  { value: "asinh", label: "Balanced (asinh)" },
  { value: "linear", label: "Straight (linear)" },
  { value: "sqrt", label: "Square root" },
  { value: "log", label: "Logarithm" },
];
const FIELD_SIZES = [120, 300, 600, 1200];

/** The test targets named in the challenge. The kind is shown in words because tooltips do not work on touch screens. */
export function Examples() {
  return (
    <div className="examples">
      <p className="muted">Test targets named in the challenge. Pick one to load its images.</p>
      <div className="example-list">
        {TEST_TARGETS.map((target) => (
          <button key={target.name} onClick={() => actions.goTo(target)}>
            <strong>{target.name}</strong>
            <small>{target.kind}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function Detectors() {
  const detectors = useStore((s) => s.filters.detectors);
  const meta = useStore((s) => s.meta);
  return (
    <fieldset>
      <legend>Detectors (wavelength bands)</legend>
      <div className="detector-grid">
        {detectors.map((on, i) => {
          const range = meta?.detectors[String(i + 1)];
          return (
            <button key={i} className={on ? "on" : ""} aria-pressed={on} onClick={() => actions.toggleDetector(i + 1)}>
              {i + 1}
              {range && <small>{range.min.toFixed(1)} to {range.max.toFixed(1)} µm</small>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Brightness() {
  const display = useStore((s) => s.display);
  return (
    <fieldset>
      <legend>Brightness and contrast</legend>
      <label className="field">
        <span>Brightness curve</span>
        <select value={display.stretch} onChange={(event) => actions.setDisplay({ stretch: event.target.value as Stretch })}>
          {STRETCHES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Black point <output>{display.lo}</output></span>
        <input type="range" min={-10} max={20} step={0.5} value={display.lo} onChange={(event) => actions.setDisplay({ lo: Number(event.target.value) })} />
      </label>
      <label className="field">
        <span>White point <output>{display.hi}</output></span>
        <input type="range" min={5} max={500} step={1} value={display.hi} onChange={(event) => actions.setDisplay({ hi: Number(event.target.value) })} />
      </label>
      <button onClick={() => actions.autoStretch()}>Auto contrast</button>
    </fieldset>
  );
}

function Color() {
  const display = useStore((s) => s.display);
  return (
    <fieldset>
      <legend>Color</legend>
      <label className="field">
        <span>Color table</span>
        <select value={display.colorMap} onChange={(event) => actions.setDisplay({ colorMap: event.target.value as ColorMap })}>
          {COLOR_MAPS.map((name) => <option key={name} value={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={display.invert} onChange={(e) => actions.setDisplay({ invert: e.target.checked })} /> Invert</label>
      <label className="check"><input type="checkbox" checked={display.color} onChange={(e) => actions.setDisplay({ color: e.target.checked })} /> Full color</label>
      {display.color && (
        <>
          <label className="field">
            <span>Color recipe</span>
            <select value={display.bands.id} onChange={(event) => actions.setDisplay({ bands: COLOR_PRESETS.find((preset) => preset.id === event.target.value) })}>
              {COLOR_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <p className="muted">{display.bands.about}</p>
        </>
      )}
    </fieldset>
  );
}

function Changes() {
  const subtract = useStore((s) => s.subtract);
  return (
    <fieldset>
      <legend>Show only changes</legend>
      <label className="field">
        <span>Subtract</span>
        <select value={subtract} onChange={(event) => actions.setSubtract(event.target.value as Subtract)}>
          <option value="none">Off</option>
          <option value="others">Minus all other images</option>
          <option value="first">Minus the first</option>
          <option value="previous">Minus the one before</option>
        </select>
      </label>
      {subtract !== "none" && <p className="muted">Unchanged sky is gray. White is brighter than before, black is fainter. A moving object shows as a white and black pair.</p>}
    </fieldset>
  );
}

function Marks() {
  const display = useStore((s) => s.display);
  return (
    <fieldset>
      <legend>On the image</legend>
      <label className="check"><input type="checkbox" checked={display.showMarker} onChange={(e) => actions.setDisplay({ showMarker: e.target.checked })} /> Mark the target</label>
      <label className="check"><input type="checkbox" checked={display.showObjects} onChange={(e) => actions.setDisplay({ showObjects: e.target.checked })} /> Label known objects</label>
      <label className="check"><input type="checkbox" checked={display.showGaia} onChange={(e) => actions.setDisplay({ showGaia: e.target.checked })} /> Mark Gaia stars</label>
      <label className="check"><input type="checkbox" checked={display.showChanges} onChange={(e) => actions.setDisplay({ showChanges: e.target.checked })} /> Mark found changes</label>
      <label className="check"><input type="checkbox" checked={display.showFlags} onChange={(e) => actions.setDisplay({ showFlags: e.target.checked })} /> Show bad pixels</label>
      <label className="check"><input type="checkbox" checked={display.smooth} onChange={(e) => actions.setDisplay({ smooth: e.target.checked })} /> Smooth pixels</label>
    </fieldset>
  );
}

function Field() {
  const fieldSize = useStore((s) => s.fieldSize);
  const follow = useStore((s) => s.follow);
  return (
    <fieldset>
      <legend>Field</legend>
      <label className="field">
        <span>Field width</span>
        <select value={fieldSize} onChange={(event) => actions.setFieldSize(Number(event.target.value))}>
          {/* The field can also be resized by dragging on the map, so the current size joins the list. */}
          {[...new Set([...FIELD_SIZES, fieldSize])].sort((a, b) => a - b).map((size) => (
            <option key={size} value={size}>{Number((size / 60).toFixed(1))} arcmin</option>
          ))}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={follow} onChange={(e) => actions.setFollow(e.target.checked)} /> Follow the target when summing</label>
      <button onClick={() => actions.resetView()}>Reset zoom</button>
    </fieldset>
  );
}

/** Every image setting, in groups laid out as columns that wrap. */
export function ImageSettings() {
  return (
    <div className="settings">
      <Detectors />
      <Brightness />
      <Color />
      <Changes />
      <Marks />
      <Field />
    </div>
  );
}
