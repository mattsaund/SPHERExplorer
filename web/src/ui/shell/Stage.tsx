// The stage: the sky map, the image viewer, or both. Small cards float over it for whatever
// was just clicked, and a readout shows what is under the pointer.
// Both views stay mounted while hidden, so the map keeps its place and the images keep playing.
// Written with Claude Code (Anthropic) assistance.
import {
  FrameView,
  SkyMap,
  TEST_TARGETS,
  actions,
  distanceMethod,
  formatDate,
  formatDec,
  formatDistance,
  formatFlux,
  formatRa,
  formatWavelength,
  useStore,
} from "../../core";
import { layout, useLayout } from "../layout";

/** Shown over the map until a first target is chosen. */
function Welcome() {
  return (
    <div className="welcome card">
      <h2>See the sky change</h2>
      <p>
        SPHEREx photographs the whole sky in 102 infrared colors, again and again. Type a name or coordinates above, click anywhere on the map, or start with
        one of NASA's test targets.
      </p>
      <div className="row wrap">
        {TEST_TARGETS.map((target) => (
          <button key={target.name} onClick={() => actions.goTo(target)} title={target.kind}>{target.name}</button>
        ))}
      </div>
    </div>
  );
}

/** What is under the pointer in the image, and the facts of the image on screen. */
function Readout() {
  const hover = useStore((s) => s.hover);
  const flags = useStore((s) => s.meta?.flags);
  const frame = useStore((s) => {
    const item = s.sequence[s.player.index];
    return item && item.frameIds.length === 1 ? s.frames[item.frameIds[0]] : null;
  });
  const names = hover && flags ? flags.filter((flag) => hover.bits & (1 << flag.bit)).map((flag) => flag.name) : [];
  if (!hover && !frame) return null;
  return (
    <div className="readout">
      {frame && (
        <span>
          {formatDate(frame.mjd)}. Detector {frame.detector}. {formatWavelength(frame.wavelength)}.
          {frame.phot?.flux != null && frame.phot.err != null && ` Brightness ${formatFlux(frame.phot.flux)} ± ${formatFlux(frame.phot.err)}.`}
        </span>
      )}
      {hover && (
        <span className="mono">
          {formatRa(hover.ra)} {formatDec(hover.dec)}
          {"  "}
          {hover.value != null ? `${hover.value.toFixed(3)} MJy/sr` : "no data"}
          {hover.wavelength != null && `, ${hover.wavelength.toFixed(3)} µm`}
          {names.length > 0 && `  ${names.join(", ")}`}
        </span>
      )}
    </div>
  );
}

/**
 * Cards for what was just clicked: a known object, a spot of sky, or a fast mover nearby.
 * They sit at the top of the tools panel when it is open, and float over the stage when it is not.
 */
export function Cards() {
  const chosen = useStore((s) => s.map.selected);
  const picked = useStore((s) => s.map.picked);
  const target = useStore((s) => s.target);
  const movers = useStore((s) => s.movers);
  const fieldSize = useStore((s) => s.fieldSize);
  const failure = useStore((s) => s.map.failure);
  const stage = useLayout((s) => s.stage);
  if (!chosen && !picked && !movers.length && !(failure && stage !== "images")) return null;
  return (
    <div className="cards">
      {failure && stage !== "images" && <p className="card problem" role="alert">{failure}</p>}
      {movers.slice(0, 2).map((mover) => (
        <div key={mover.id} className="card hint">
          <span>
            <strong>{mover.name}</strong>{mover.kind ? ` (${mover.kind.toLowerCase()})` : ""} moves quickly across the sky and is near these coordinates. It may have
            moved since they were measured.
          </span>
          <div className="row wrap">
            <button className="primary" onClick={() => actions.studyObject(mover)}>Follow {mover.name}</button>
          </div>
        </div>
      ))}
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
          <span className="muted">{(fieldSize / 60).toFixed(1)} arcminutes across. On the map, drag the edge of the red square to resize it.</span>
          <div className="row wrap">
            {target && !target.moving && (
              <button
                onClick={() => {
                  actions.probe(picked);
                  layout.openTray("spectrum");
                }}
              >
                Spectrum here
              </button>
            )}
            <button className="primary" onClick={() => actions.goTo({ ...picked, epoch: 2026.0 })}>Study this area</button>
            <button onClick={() => actions.pick(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Stage() {
  const stage = useLayout((s) => s.stage);
  const dock = useLayout((s) => s.dock);
  const hasTarget = useStore((s) => s.target !== null);
  return (
    <div className={`stage stage-${stage}`}>
      <section className="pane pane-map" aria-label="Sky map" aria-hidden={stage === "images"}>
        <div className="map"><SkyMap /></div>
        {!hasTarget && <Welcome />}
      </section>
      <section className="pane pane-images" aria-label="Image viewer" aria-hidden={stage === "map"}>
        <div className="frame">
          {hasTarget ? (
            <FrameView />
          ) : (
            <p className="empty">Choose a place first. Type a name or coordinates above, or pick a spot on the sky map.</p>
          )}
        </div>
        {hasTarget && <Readout />}
      </section>
      {!dock && <Cards />}
    </div>
  );
}
