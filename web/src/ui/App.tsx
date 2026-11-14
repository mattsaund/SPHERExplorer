// Starter app shell. It wires every engine feature to plain controls so the tool works end to end.
// Austin's side owns everything under ui/ and is free to rebuild it.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useState, type FormEvent } from "react";
import {
  COLOR_MAPS,
  FrameView,
  LINE_FAMILIES,
  SpectrumPlot,
  TEST_TARGETS,
  Timeline,
  actions,
  formatDate,
  formatDec,
  formatRa,
  formatWavelength,
  useStore,
  type ColorMap,
  type SequenceMode,
  type Stretch,
} from "../core";
import "./styles/app.css";

const MODES: { value: SequenceMode; label: string; hint: string }[] = [
  { value: "exposures", label: "Every image", hint: "Each exposure in time order" },
  { value: "visits", label: "By visit", hint: "One summed image per visit. Best for spotting motion" },
  { value: "channels", label: "By color", hint: "One summed image per wavelength channel" },
];
const STRETCHES: Stretch[] = ["linear", "sqrt", "log", "asinh"];
const FIELD_SIZES = [120, 300, 600, 1200];

function SearchBar() {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) {
      setProblem('Enter a name such as "Vega", or coordinates such as "133.76 -7.24".');
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
        placeholder="Object name or coordinates, for example Vega or 133.76 -7.24"
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
  const total = useStore((s) => s.frames.length);
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
  const names = hover && flags ? flags.filter((f) => hover.bits & (1 << f.bit)).map((f) => f.name) : [];
  return (
    <fieldset>
      <legend>Details</legend>
      {target && <p><strong>{target.name ?? "Custom position"}</strong>{target.kind ? `. ${target.kind}` : ""}</p>}
      {frame && (
        <p>
          {formatDate(frame.mjd)}. Detector {frame.detector}. {formatWavelength(frame.wavelength)}.
          {frame.phot?.flux != null && frame.phot.err != null && ` Brightness ${frame.phot.flux.toFixed(0)} ± ${frame.phot.err.toFixed(0)} µJy.`}
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
      <main>
        <section className="stage" aria-label="Image viewer">
          <div className="frame">{hasTarget && <FrameView />}</div>
          <PlayerControls />
          {hasTarget && <TimelinePanel />}
          {hasTarget && <SpectrumPanel />}
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
