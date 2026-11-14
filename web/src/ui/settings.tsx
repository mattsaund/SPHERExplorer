// What the top drawer holds: the challenge test targets, and every setting for the sky map and the image study.
// Written with Claude Code (Anthropic) assistance.
import {
  COLOR_MAPS,
  COLOR_PRESETS,
  PROJECTIONS,
  SKY_LAYERS,
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
      <legend>Detectors</legend>
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
      <label className="check" title="When images are summed, keep a moving target in the middle, so it stays sharp while the stars trail">
        <input type="checkbox" checked={follow} onChange={(e) => actions.setFollow(e.target.checked)} /> Follow the target in sums
      </label>
      <button onClick={() => actions.resetView()}>Reset zoom</button>
    </fieldset>
  );
}

/** Which survey the sky map shows, and in which shape. */
function MapSurvey() {
  const layerId = useStore((s) => s.map.layer);
  const projection = useStore((s) => s.map.projection);
  const channel = useStore((s) => s.map.channel);
  const meta = useStore((s) => s.meta);
  const layer = SKY_LAYERS.find((entry) => entry.id === layerId) ?? SKY_LAYERS[0];
  return (
    <fieldset>
      <legend>Survey and shape</legend>
      <label className="field">
        <span>Show</span>
        <select value={layerId} onChange={(e) => actions.setMap({ layer: e.target.value })}>
          {SKY_LAYERS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
      {layer.cube && (
        <label className="field">
          <span>Color <output>{meta ? `${meta.channels[channel].toFixed(2)} µm` : `channel ${channel + 1}`}</output></span>
          <input type="range" min={0} max={101} value={channel} onChange={(e) => actions.setMap({ channel: Number(e.target.value) })} />
        </label>
      )}
      <label className="field">
        <span>Map shape</span>
        <select value={projection} onChange={(e) => actions.setMap({ projection: e.target.value })}>
          {PROJECTIONS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
    </fieldset>
  );
}

/**
 * What is drawn over the sky map. The two coverage maps and the tile grid are the ones the
 * IRSA SPHEREx Data Explorer offers. A swatch shows the color each coverage map is drawn in.
 */
function MapOverlays() {
  const labels = useStore((s) => s.map.labels);
  const grid = useStore((s) => s.map.grid);
  const coverage = useStore((s) => s.map.coverage);
  const deepFields = useStore((s) => s.map.deepFields);
  const tiles = useStore((s) => s.map.tiles);
  return (
    <fieldset>
      <legend>On the map</legend>
      <label className="check"><input type="checkbox" checked={labels} onChange={(e) => actions.setMap({ labels: e.target.checked })} /> Object labels</label>
      <label className="check" title="Every part of the sky that has SPHEREx spectral images in the archive">
        <input type="checkbox" checked={coverage} onChange={(e) => actions.setMap({ coverage: e.target.checked })} /> SPHEREx spectral images
        <span className="swatch coverage" aria-hidden="true" />
      </label>
      <label className="check" title="The two patches near the ecliptic poles that SPHEREx images on nearly every orbit">
        <input type="checkbox" checked={deepFields} onChange={(e) => actions.setMap({ deepFields: e.target.checked })} /> SPHEREx deep fields
        <span className="swatch deep" aria-hidden="true" />
      </label>
      <label className="check" title="Lines of right ascension and declination">
        <input type="checkbox" checked={grid} onChange={(e) => actions.setMap({ grid: e.target.checked })} /> Coordinate grid
      </label>
      <label className="check" title="The numbered tiles (HEALPix) that all-sky maps are cut into">
        <input type="checkbox" checked={tiles} onChange={(e) => actions.setMap({ tiles: e.target.checked })} /> Tile grid (HEALPix)
      </label>
    </fieldset>
  );
}

/** The measure tool, and places the map can jump to. */
function MapTools() {
  const target = useStore((s) => s.target);
  const fieldSize = useStore((s) => s.fieldSize);
  const measuring = useStore((s) => s.map.measuring);
  return (
    <fieldset>
      <legend>Tools</legend>
      <button
        className={measuring ? "on" : ""}
        aria-pressed={measuring}
        onClick={() => actions.setMap({ measuring: !measuring })}
        title="Switch on, then drag on the map to measure the angle between two points"
      >
        {measuring ? "Measuring: drag on the map" : "Measure a distance"}
      </button>
      <button onClick={() => actions.flyTo({ ra: 266.4, dec: -29 }, 200)}>Whole sky</button>
      {target && (
        <button onClick={() => actions.flyTo(target, (fieldSize / 3600) * 1.6)} title="Zoom the map to the patch of sky the images show, to compare the two">
          The images' field
        </button>
      )}
    </fieldset>
  );
}

/**
 * Every setting in one place, in two halves: the sky map's on the left and the image study's on
 * the right. The line between the halves sits where the line between the two views is, so each
 * half lies under the view it controls. Nothing moves when the view changes.
 */
export function Settings() {
  return (
    <div className="settings">
      <section className="settings-side" aria-labelledby="settings-map">
        <h2 id="settings-map">Sky map</h2>
        <div className="settings-groups">
          <MapSurvey />
          <MapOverlays />
          <MapTools />
        </div>
      </section>
      <section className="settings-side" aria-labelledby="settings-images">
        <h2 id="settings-images">Image study</h2>
        {/* Paired so that three columns come out about equally tall. Each group keeps its place. */}
        <div className="settings-groups paired">
          <div className="settings-column"><Detectors /><Field /></div>
          <div className="settings-column"><Brightness /><Changes /></div>
          <div className="settings-column"><Color /><Marks /></div>
        </div>
      </section>
    </div>
  );
}
