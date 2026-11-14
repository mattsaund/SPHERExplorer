// Starter app shell. It wires every engine feature to plain controls so the tool works end to end.
// Austin's side owns everything under ui/ and is free to rebuild it.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useState, type FormEvent } from "react";
import {
  COLOR_MAPS,
  COLOR_PRESETS,
  FrameView,
  LINE_FAMILIES,
  LightCurvePlot,
  OrbitView,
  PROJECTIONS,
  SKY_LAYERS,
  SkyMap,
  SpectrumPlot,
  TEST_TARGETS,
  Timeline,
  actions,
  distanceMethod,
  formatAu,
  formatDate,
  formatDec,
  formatDistance,
  formatFlux,
  formatRa,
  formatWavelength,
  useStore,
  type ColorMap,
  type SequenceMode,
  type Stretch,
  type Subtract,
} from "../core";
import "./styles/app.css";

const MODES: { value: SequenceMode; label: string; hint: string }[] = [
  { value: "exposures", label: "Every image", hint: "Each exposure in time order" },
  { value: "visits", label: "By visit", hint: "One summed image per visit. Best for spotting motion" },
  { value: "channels", label: "By wavelength", hint: "One summed image per wavelength channel" },
  { value: "deep", label: "Deepest", hint: "Every image summed into one" },
];
const STRETCHES: Stretch[] = ["linear", "sqrt", "log", "asinh"];
const FIELD_SIZES = [120, 300, 600, 1200];

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
        onChange={(event) => setText(event.target.value)}
        placeholder="Object name, or RA and Dec (J2000), for example Vega or 08h55m10.8s -07d14m42s"
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit">Go</button>
      {problem && <p className="problem" role="alert">{problem}</p>}
    </form>
  );
}

function Status() {
  const targetState = useStore((s) => s.targetState);
  const framesState = useStore((s) => s.framesState);
  // Images skipped on purpose (off the detector edge, or thinned for speed) are not waited for.
  const total = useStore((s) => s.frames.filter((f) => f.status !== "outside").length);
  const loaded = useStore((s) => s.loaded);
  const failed = useStore((s) => s.failed);
  const error = useStore((s) => s.error);
  const notice = useStore((s) => s.notice);

  let text = "Pick a target or enter coordinates to begin.";
  if (targetState === "loading") text = "Searching the SPHEREx archive…";
  else if (targetState === "ready" && total === 0) text = "SPHEREx has no public images of this spot yet.";
  else if (framesState === "loading") text = `Loading images: ${loaded + failed} of ${total}`;
  else if (framesState === "ready") text = `${loaded} images loaded${failed ? `, ${failed} could not be read` : ""}.`;

  return (
    <div className="status" aria-live="polite">
      <p>{text}</p>
      {framesState === "loading" && <progress max={total} value={loaded + failed} />}
      {notice && <p className="notice">{notice}</p>}
      {error && (
        <p className="problem" role="alert">
          {error} <button onClick={() => actions.reload()}>Try again</button>
        </p>
      )}
    </div>
  );
}

function PlayerControls() {
  const count = useStore((s) => s.sequence.length);
  const index = useStore((s) => s.player.index);
  const playing = useStore((s) => s.player.playing);
  const fps = useStore((s) => s.player.fps);
  const item = useStore((s) => s.sequence[s.player.index]);
  const mode = useStore((s) => s.mode);
  const exporting = useStore((s) => s.exporting);

  return (
    <div className="player">
      <div className="row">
        <button onClick={() => actions.step(-1)} disabled={count < 2} aria-label="Previous image">◀</button>
        <button className="primary" onClick={() => actions.togglePlay()} disabled={count < 2}>
          {playing ? "Pause" : "Play"}
        </button>
        <button onClick={() => actions.step(1)} disabled={count < 2} aria-label="Next image">▶</button>
        <input
          className="grow"
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
      <div className="row">
        <span className="label">{item ? item.label : "No images yet"}</span>
        <label>
          Speed
          <input type="range" min={1} max={20} step={1} value={fps} onChange={(event) => actions.setSpeed(Number(event.target.value))} />
        </label>
      </div>
      <div className="row wrap">
        <button onClick={() => void actions.saveImage()} disabled={!count}>Save picture</button>
        <button onClick={() => void actions.saveAnimation()} disabled={count < 2 || exporting !== null}>
          {exporting !== null ? `Saving animation ${Math.round(exporting * 100)}%` : "Save animation"}
        </button>
        <button onClick={() => actions.saveSpectrum()} disabled={!count}>Save spectrum table</button>
        <button onClick={() => void navigator.clipboard?.writeText(actions.shareLink())} disabled={!count}>Copy link</button>
      </div>
      <div className="row" role="radiogroup" aria-label="What to play">
        {MODES.map((option) => (
          <button key={option.value} role="radio" aria-checked={mode === option.value} className={mode === option.value ? "on" : ""} title={option.hint} onClick={() => actions.setMode(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BandControls() {
  const detectors = useStore((s) => s.filters.detectors);
  const meta = useStore((s) => s.meta);
  return (
    <fieldset>
      <legend>Detectors (wavelength bands)</legend>
      <div className="row wrap">
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
    </fieldset>
  );
}

function DisplayControls() {
  const display = useStore((s) => s.display);
  const fieldSize = useStore((s) => s.fieldSize);
  const follow = useStore((s) => s.follow);
  const subtract = useStore((s) => s.subtract);
  return (
    <fieldset>
      <legend>Display</legend>
      <label>
        Field width
        <select value={fieldSize} onChange={(event) => actions.setFieldSize(Number(event.target.value))}>
          {FIELD_SIZES.map((size) => (
            <option key={size} value={size}>{size / 60} arcmin</option>
          ))}
        </select>
      </label>
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
      <label>
        Brightness curve
        <select value={display.stretch} onChange={(event) => actions.setDisplay({ stretch: event.target.value as Stretch })}>
          {STRETCHES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>
        Colors
        <select value={display.colorMap} onChange={(event) => actions.setDisplay({ colorMap: event.target.value as ColorMap })}>
          {COLOR_MAPS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>
        Black point
        <input type="range" min={-10} max={20} step={0.5} value={display.lo} onChange={(event) => actions.setDisplay({ lo: Number(event.target.value) })} />
      </label>
      <label>
        White point
        <input type="range" min={5} max={500} step={1} value={display.hi} onChange={(event) => actions.setDisplay({ hi: Number(event.target.value) })} />
      </label>
      <button onClick={() => actions.autoStretch()}>Auto contrast</button>
      <label className="check"><input type="checkbox" checked={display.invert} onChange={(e) => actions.setDisplay({ invert: e.target.checked })} /> Invert</label>
      <label className="check"><input type="checkbox" checked={display.smooth} onChange={(e) => actions.setDisplay({ smooth: e.target.checked })} /> Smooth pixels</label>
      <label className="check"><input type="checkbox" checked={display.showFlags} onChange={(e) => actions.setDisplay({ showFlags: e.target.checked })} /> Show bad pixels</label>
      <label className="check"><input type="checkbox" checked={display.showMarker} onChange={(e) => actions.setDisplay({ showMarker: e.target.checked })} /> Mark the target</label>
      <label className="check"><input type="checkbox" checked={display.showObjects} onChange={(e) => actions.setDisplay({ showObjects: e.target.checked })} /> Label known objects</label>
      <label className="check"><input type="checkbox" checked={display.showGaia} onChange={(e) => actions.setDisplay({ showGaia: e.target.checked })} /> Mark Gaia stars</label>
      <label className="check"><input type="checkbox" checked={follow} onChange={(e) => actions.setFollow(e.target.checked)} /> Follow the target when summing</label>
      <button onClick={() => actions.resetView()}>Reset zoom</button>
    </fieldset>
  );
}

function Readout() {
  const hover = useStore((s) => s.hover);
  const target = useStore((s) => s.target);
  const frame = useStore((s) => {
    const item = s.sequence[s.player.index];
    return item && item.frameIds.length === 1 ? s.frames[item.frameIds[0]] : null;
  });
  const flags = useStore((s) => s.meta?.flags);
  const movers = useStore((s) => s.movers);
  const chosen = useStore((s) => s.map.selected);
  // The first image of the step on screen, for distances that change from image to image.
  const shown = useStore((s) => {
    const item = s.sequence[s.player.index];
    return item ? s.frames[item.frameIds[0]] : null;
  });
  const names = hover && flags ? flags.filter((f) => hover.bits & (1 << f.bit)).map((f) => f.name) : [];
  return (
    <fieldset>
      <legend>Details</legend>
      {target && <p><strong>{target.name ?? "Custom position"}</strong>{target.kind ? `. ${target.kind}` : ""}</p>}
      {target?.distance && <p>Distance: {formatDistance(target.distance)}, {distanceMethod(target.distance.method)}.</p>}
      {target?.moving && shown?.earthDistance != null && (
        <p>
          Distance at this image: {formatAu(shown.earthDistance)} from Earth
          {shown.sunDistance != null && `, ${formatAu(shown.sunDistance)} from the Sun`}.
        </p>
      )}
      {target?.url && (
        <p>
          <a href={target.url} target="_blank" rel="noreferrer">Full details{target.moving ? " at NASA JPL" : " in the SIMBAD database"}</a>
          {target.moving ? " (orbit, size, and discovery)" : " (names, measurements, and research papers)"}
        </p>
      )}
      {movers.slice(0, 2).map((mover) => (
        <p key={mover.id} className="hint">
          {mover.name}{mover.kind ? ` (${mover.kind.toLowerCase()})` : ""} moves quickly across the sky and is near these coordinates. It may have moved since they were measured.{" "}
          <button onClick={() => actions.studyObject(mover)}>Follow {mover.name}</button>
        </p>
      ))}
      {chosen && (
        <div className="card">
          <strong>{chosen.name}</strong>
          <span>{chosen.kind ?? "Known object"}{chosen.spectralType ? `, type ${chosen.spectralType}` : ""}</span>
          {chosen.distance && <span>Distance: {formatDistance(chosen.distance)}</span>}
          <div className="row wrap">
            <button onClick={() => actions.studyObject(chosen)}>Study in SPHEREx</button>
            <a href={chosen.url} target="_blank" rel="noreferrer">Full details</a>
          </div>
        </div>
      )}
      {frame && (
        <p>
          {formatDate(frame.mjd)}. Detector {frame.detector}. {formatWavelength(frame.wavelength)}.
          {frame.phot?.flux != null && frame.phot.err != null && ` Brightness ${formatFlux(frame.phot.flux)} ± ${formatFlux(frame.phot.err)}.`}
        </p>
      )}
      {hover ? (
        <p className="mono">
          {formatRa(hover.ra)} {formatDec(hover.dec)}
          <br />
          {hover.value != null ? `${hover.value.toFixed(3)} MJy/sr` : "no data"}
          {hover.wavelength != null && `, ${hover.wavelength.toFixed(3)} µm`}
          {names.length > 0 && <><br />{names.join(", ")}</>}
        </p>
      ) : (
        <p className="muted">Move the pointer over the image for values.</p>
      )}
    </fieldset>
  );
}

function MapPanel() {
  const map = useStore((s) => s.map);
  const meta = useStore((s) => s.meta);
  const layer = SKY_LAYERS.find((entry) => entry.id === map.layer) ?? SKY_LAYERS[0];
  const chosen = map.selected;
  const picked = map.picked;

  return (
    <section className="panel" aria-label="Sky map">
      <h2>Sky map</h2>
      <p className="muted">Drag to move, scroll to zoom. Click a label to learn about an object, or click anywhere to study that spot.</p>
      <div className="row wrap">
        <label>
          Show
          <select value={map.layer} onChange={(e) => actions.setMap({ layer: e.target.value })}>
            {SKY_LAYERS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <label>
          Map shape
          <select value={map.projection} onChange={(e) => actions.setMap({ projection: e.target.value })}>
            {PROJECTIONS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={map.labels} onChange={(e) => actions.setMap({ labels: e.target.checked })} /> Labels</label>
        <label className="check"><input type="checkbox" checked={map.grid} onChange={(e) => actions.setMap({ grid: e.target.checked })} /> Grid</label>
        <button onClick={() => actions.flyTo({ ra: 266.4, dec: -29 }, 200)}>Whole sky</button>
      </div>
      {layer.cube && (
        <label>
          Color: {meta ? `${meta.channels[map.channel].toFixed(2)} µm` : `channel ${map.channel + 1}`}
          <input className="grow" type="range" min={0} max={101} value={map.channel} onChange={(e) => actions.setMap({ channel: Number(e.target.value) })} />
        </label>
      )}
      <p className="muted">{layer.mission}. {layer.light}. {layer.about}</p>
      <div className="map">
        <SkyMap />
        {map.failure && <p className="problem" role="alert">{map.failure}</p>}
      </div>
      {chosen && (
        <div className="card">
          <strong>{chosen.name}</strong>
          <span>{chosen.kind ?? "Known object"}{chosen.spectralType ? `, type ${chosen.spectralType}` : ""}</span>
          <span className="mono">{formatRa(chosen.ra)} {formatDec(chosen.dec)}</span>
          {chosen.distance && <span>Distance: {formatDistance(chosen.distance)}, {distanceMethod(chosen.distance.method)}</span>}
          {chosen.refs != null && <span className="muted">Mentioned in {chosen.refs.toLocaleString("en-US")} papers</span>}
          <div className="row wrap">
            <button className="primary" onClick={() => actions.studyObject(chosen)}>Study in SPHEREx</button>
            <a href={chosen.url} target="_blank" rel="noreferrer">Full details</a>
            <button onClick={() => actions.selectObject(null)}>Close</button>
          </div>
        </div>
      )}
      {picked && (
        <div className="card">
          <strong>Selected spot</strong>
          <span className="mono">{formatRa(picked.ra)} {formatDec(picked.dec)}</span>
          <div className="row wrap">
            <button className="primary" onClick={() => actions.goTo({ ...picked, epoch: 2026.0 })}>Study this spot</button>
            <button onClick={() => actions.pick(null)}>Close</button>
          </div>
        </div>
      )}
    </section>
  );
}

function SpectrumPanel() {
  const settings = useStore((s) => s.spectrum);
  return (
    <section className="panel" aria-label="Spectrum">
      <h2>Spectrum</h2>
      <p className="muted">Brightness of the target at each wavelength. Dips and bumps reveal what it is made of.</p>
      <div className="plot"><SpectrumPlot /></div>
      <div className="row wrap">
        <label className="check"><input type="checkbox" checked={settings.perVisit} onChange={(e) => actions.setSpectrum({ perVisit: e.target.checked })} /> Compare visits</label>
        <label className="check"><input type="checkbox" checked={settings.showPoints} onChange={(e) => actions.setSpectrum({ showPoints: e.target.checked })} /> Every measurement</label>
        <label className="check"><input type="checkbox" checked={settings.log} onChange={(e) => actions.setSpectrum({ log: e.target.checked })} /> Log scale</label>
        <label className="check"><input type="checkbox" checked={settings.showSurveys} onChange={(e) => actions.setSpectrum({ showSurveys: e.target.checked })} /> 2MASS and WISE</label>
        <label>
          Redshift {settings.redshift.toFixed(2)}
          <input type="range" min={0} max={8} step={0.01} value={settings.redshift} onChange={(e) => actions.setSpectrum({ redshift: Number(e.target.value) })} />
        </label>
      </div>
      <div className="row wrap" aria-label="Mark features of">
        {LINE_FAMILIES.map((family) => (
          <button key={family.id} className={settings.families.includes(family.id) ? "on" : ""} aria-pressed={settings.families.includes(family.id)} title={family.about} onClick={() => actions.toggleFamily(family.id)}>
            {family.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function LightCurvePanel() {
  return (
    <section className="panel" aria-label="Brightness over time">
      <h2>Brightness over time</h2>
      <p className="muted">Is it getting brighter or fainter? Each point compares one image with the target's usual brightness at that wavelength.</p>
      <div className="plot short"><LightCurvePlot /></div>
    </section>
  );
}

/** Up to `count` items taken evenly across a list, so a long run of one night does not fill the row. */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, i) => items[Math.round((i * (items.length - 1)) / (count - 1))]);
}

function SpacecraftPanel() {
  const info = useStore((s) => s.spacecraft);
  const now = useStore((s) => s.spacecraftNow);
  const newest = info?.archive?.newest;
  return (
    <section className="panel" aria-label="The spacecraft">
      <h2>Where is SPHEREx right now?</h2>
      <p className="muted">
        The telescope circles the Earth from pole to pole about every 98 minutes, riding the line between day and night.
      </p>
      <div className="orbit"><OrbitView /></div>
      {now && (
        <p>
          Over latitude {now.latitude.toFixed(1)}°, longitude {now.longitude.toFixed(1)}°. {Math.round(now.altitude)} km up, moving at{" "}
          {now.speed.toFixed(2)} km per second. One lap takes {now.period.toFixed(1)} minutes. {now.sunlit ? "In sunlight." : "In the Earth's shadow."}
        </p>
      )}
      {info?.archive && (
        <p className="muted">
          {info.archive.exposures.toLocaleString("en-US")} exposures are public
          {newest != null && `. The newest is from ${formatDate(newest)}`}. Launched {info.launched}.
        </p>
      )}
      {info && info.recent.length > 0 && (
        <button onClick={() => actions.flyTo(info.recent[0], 25)}>Show where the newest public image looked</button>
      )}
    </section>
  );
}

function PartnerPanel() {
  const partner = useStore((s) => s.partner);
  if (!partner || partner.count === 0) return null;
  return (
    <section className="panel" aria-label="Other telescopes">
      <h2>Seen in visible light by {partner.mission}</h2>
      <p className="muted">
        {partner.agency}. {partner.count.toLocaleString("en-US")} images of this field
        {partner.first != null && partner.last != null && `, from ${formatDate(partner.first)} to ${formatDate(partner.last)}`}. Each covers 0.85 degrees.
      </p>
      <div className="thumbs">
        {spread(partner.images, 12).map((image) => (
          <a key={image.id} href={image.preview} target="_blank" rel="noreferrer" title={`Open the full picture from ${formatDate(image.mjd)}`}>
            <img src={image.thumbnail} alt={`NEOSSat image from ${formatDate(image.mjd)}`} loading="lazy" width={128} height={128} />
            <span>{formatDate(image.mjd)}</span>
          </a>
        ))}
      </div>
      <p className="muted">{partner.credit}</p>
    </section>
  );
}

function TimelinePanel() {
  return (
    <section className="panel" aria-label="Timeline">
      <h2>When SPHEREx looked</h2>
      <p className="muted">Each dot is one image. On every visit the telescope steps the target through all its colors.</p>
      <div className="plot short"><Timeline /></div>
    </section>
  );
}

export function App() {
  useEffect(() => actions.init(), []);
  const hasTarget = useStore((s) => s.target !== null);

  return (
    <div className="app">
      <header>
        <h1>SPHERExplorer</h1>
        <SearchBar />
      </header>
      <nav aria-label="Test targets">
        {TEST_TARGETS.map((t) => (
          <button key={t.name} onClick={() => actions.goTo(t)} title={t.kind}>{t.name}</button>
        ))}
      </nav>
      <Status />
      <MapPanel />
      <SpacecraftPanel />
      <main>
        <section className="stage" aria-label="Image viewer">
          <div className="frame">{hasTarget && <FrameView />}</div>
          <PlayerControls />
          {hasTarget && <TimelinePanel />}
          {hasTarget && <SpectrumPanel />}
          {hasTarget && <LightCurvePanel />}
          {hasTarget && <PartnerPanel />}
        </section>
        <aside>
          <Readout />
          <BandControls />
          <DisplayControls />
        </aside>
      </main>
    </div>
  );
}
