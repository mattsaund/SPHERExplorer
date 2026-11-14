// The cards laid over the stage: the selected area on the sky map, a chosen object, a spot
// picked in the images, and the one list of every object in the field being studied.
// Austin's side owns the look. The engine pieces used here are listed in docs/ui-checklist.md.
// Written with Claude Code (Anthropic) assistance.
import { useEffect, useRef, useState } from "react";
import { actions, compass, distanceMethod, formatDate, formatDec, formatDistance, formatRa, useStore, type SkyObject } from "../core";
import { copyText } from "./copy";

/** Points down. Turns up while the thing it belongs to is open (see app.css). */
export function Chevron() {
  return (
    <svg className="chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A small button that copies a piece of text and says so for a moment. */
export function CopyButton({ text, label = "Copy", title }: { text: string; label?: string; title?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    setState((await copyText(text)) ? "copied" : "failed");
    setTimeout(() => setState("idle"), 1600);
  }
  return (
    <button onClick={() => void copy()} title={title} aria-live="polite">
      {state === "copied" ? "Copied" : state === "failed" ? "Could not copy" : label}
    </button>
  );
}

/** Right ascension and declination in the form the Find box and other archives read. */
export function coordinates(position: { ra: number; dec: number }): string {
  return `${formatRa(position.ra)} ${formatDec(position.dec)}`;
}

/** True while the sky map shows its yellow square: a place just picked, or the field being studied. */
export function useAreaShown(): boolean {
  return useStore((s) => s.map.picked !== null || (s.map.fieldShown && s.target !== null && !s.target.moving));
}

/**
 * The selected area on the sky map, which is the yellow square. It is a place just picked, or
 * the field being studied, which appears with every search. "Select" loads the images of a
 * picked place. "Close" takes the square off the map until the next click or search.
 */
export function AreaCard() {
  const picked = useStore((s) => s.map.picked);
  const fieldShown = useStore((s) => s.map.fieldShown);
  const target = useStore((s) => s.target);
  const fieldSize = useStore((s) => s.fieldSize);
  const area = picked ?? (fieldShown && target && !target.moving ? target : null);
  if (!area) return null;
  return (
    <section className="box" aria-label="Selected area">
      <h2>Selected area</h2>
      <p className="mono">{coordinates(area)}</p>
      <p>{Number((fieldSize / 60).toFixed(1))} arcminutes across</p>
      <div className="row wrap">
        {/* With nothing newly picked, the square is the field whose images are already loaded. */}
        <button
          className="primary"
          disabled={!picked}
          onClick={() => picked && actions.goTo({ ...picked, epoch: 2026.0 })}
          title={picked ? "Load the SPHEREx images of this area" : "The images of this area are the ones loaded"}
        >
          {picked ? "Select" : "Selected"}
        </button>
        <CopyButton text={coordinates(area)} label="Copy Coordinates" />
        <button onClick={() => actions.closeArea()}>Close</button>
      </div>
    </section>
  );
}

/** Facts about an object chosen on the sky map. `onStudy` runs after its images are asked for. */
export function ObjectCard({ object, onStudy }: { object: SkyObject; onStudy: () => void }) {
  return (
    <section className="box" aria-label={`About ${object.name}`}>
      <h2>{object.name}</h2>
      <p>{object.kind ?? "Known object"}{object.spectralType ? `, type ${object.spectralType}` : ""}</p>
      <p className="mono">{coordinates(object)}</p>
      {object.distance && <p>Distance: {formatDistance(object.distance)}, {distanceMethod(object.distance.method)}</p>}
      {object.refs != null && <p className="muted">Mentioned in {object.refs.toLocaleString("en-US")} papers</p>}
      <div className="row wrap">
        <button className="primary" onClick={() => { actions.studyObject(object); onStudy(); }}>Study in SPHEREx</button>
        <a className="button" href={object.url} target="_blank" rel="noreferrer">Full details</a>
        <button onClick={() => actions.selectObject(null)}>Close</button>
      </div>
    </section>
  );
}

/** A spot picked by a click in the images. It can be measured in place, or studied as a new field. */
export function SpotCard({ openTool }: { openTool: (id: string) => void }) {
  const picked = useStore((s) => s.map.picked);
  // A planet or comet has no fixed field to measure a spot in.
  const canMeasure = useStore((s) => s.target !== null && !s.target.moving);
  if (!picked) return null;
  return (
    <section className="box" aria-label="Selected spot">
      <h2>Selected spot</h2>
      <p className="mono">{coordinates(picked)}</p>
      <div className="row wrap">
        {canMeasure && (
          <button className="primary" onClick={() => { actions.probe(picked); openTool("graphs"); }}>Spectrum here</button>
        )}
        <button className={canMeasure ? "" : "primary"} onClick={() => actions.goTo({ ...picked, epoch: 2026.0 })}>Study this spot</button>
        <CopyButton text={coordinates(picked)} label="Copy Coordinates" />
        <button onClick={() => actions.pick(null)}>Close</button>
      </div>
    </section>
  );
}

/** The facts shown when a row of the objects list is open. */
function ObjectFacts({ object, fast }: { object: SkyObject; fast: boolean }) {
  return (
    <div className="object-facts">
      <p className="mono">{coordinates(object)}</p>
      {object.spectralType && <p>Type {object.spectralType}</p>}
      {object.distance && <p>Distance: {formatDistance(object.distance)}, {distanceMethod(object.distance.method)}</p>}
      {fast && <p>It moves quickly across the sky, so it may have left the place where its coordinates were measured.</p>}
      {object.refs != null && <p className="muted">Mentioned in {object.refs.toLocaleString("en-US")} papers</p>}
      <div className="row wrap">
        <button className="primary" onClick={() => actions.studyObject(object)}>{fast ? `Follow ${object.name}` : "Study in SPHEREx"}</button>
        <a className="button" href={object.url} target="_blank" rel="noreferrer">Full details</a>
      </div>
    </div>
  );
}

/**
 * Which known asteroids, comets, and planets were in the field when the image on screen was
 * taken. Asked only when the person presses the button, because the answer takes a few seconds
 * and belongs to one moment.
 */
function SolarBodies() {
  const known = useStore((s) => (s.known?.field ? s.known : null));
  const item = useStore((s) => s.sequence[s.player.index]);
  if (!item) return <div className="object-facts"><p className="muted">Waiting for the first image.</p></div>;
  const current = known !== null && known.mjd === item.mjd;
  return (
    <div className="object-facts" aria-live="polite">
      {!known ? (
        <p>Which known asteroids, comets, and planets were in this field when the image on screen was taken?</p>
      ) : known.status === "loading" ? (
        <p className="muted">Asking where every known asteroid and comet was at that moment. This takes a few seconds.</p>
      ) : known.status === "failed" ? (
        <p className="problem" role="alert">{known.error}</p>
      ) : known.bodies.length === 0 ? (
        <p>None was in this field on {formatDate(known.mjd)}.</p>
      ) : (
        <>
          <p>In this field on {formatDate(known.mjd)}:</p>
          {known.bodies.slice(0, 8).map((body) => (
            <p key={body.name}>
              <strong>{body.name}</strong>. {body.kind}
              {body.magnitude != null && `, magnitude ${body.magnitude.toFixed(1)}`}, moving {body.rate.toFixed(0)} arcsec per hour to the {compass(body.angle)}.{" "}
              <button onClick={() => void actions.search(body.query)}>Follow it</button>
            </p>
          ))}
          {known.bodies.length > 8 && <p className="muted">And {known.bodies.length - 8} more, farther from the middle.</p>}
        </>
      )}
      {known?.status === "ready" && known.summed && (
        <p className="muted">That image is a sum of many, so the moment is only its middle. Choose "Every image" to check one moment.</p>
      )}
      {!current && known?.status !== "loading" && (
        <div className="row">
          <button className="primary" onClick={() => void actions.identify("field")}>{known ? "Check the image now on screen" : "Check this image"}</button>
        </div>
      )}
      <p className="muted">From the SkyBoT service of IMCCE, Paris Observatory.</p>
    </div>
  );
}

/**
 * Every object in the field being studied, in one card on the image side.
 * Everything in it can be hidden. The heading folds the whole list away. Each row opens to
 * show that object's facts and closes again. A checkbox takes the objects' marks off the image.
 * Fast movers come first, because they are why typed coordinates can miss their object. The
 * last row asks which asteroids, comets, and planets were in the field when the image on
 * screen was taken. A click on a labeled object in the image opens its row here.
 *
 * The page keeps this card mounted while the sky map alone is showing, so what was hidden
 * stays hidden when the view changes.
 */
export function ObjectsCard() {
  const hasTarget = useStore((s) => s.target !== null);
  const fixed = useStore((s) => s.target !== null && !s.target.moving);
  const inField = useStore((s) => s.fieldObjects);
  const movers = useStore((s) => s.movers);
  const chosen = useStore((s) => s.map.selected);
  const marked = useStore((s) => s.display.showObjects);
  const [open, setOpen] = useState(false);
  const [solar, setSolar] = useState(false);
  const openRow = useRef<HTMLLIElement>(null);

  const fast = new Set(movers.map((object) => object.id));
  const listed = [...movers, ...inField.filter((object) => !fast.has(object.id))];
  const chosenHere = chosen !== null && listed.some((object) => object.id === chosen.id);
  const chosenId = chosenHere ? chosen.id : null;
  // An object chosen on the sky map gets the map's own card, so it does not open this list.
  const clickedHere = useStore((s) => s.map.selectedIn === "images");

  // The list opens by itself only when something new calls for it: a search that finds a
  // fast mover near the coordinates, or an object newly chosen by a click in the image.
  // Once the person hides it, it stays hidden until one of those happens again.
  useEffect(() => {
    if (movers.length > 0) setOpen(true);
  }, [movers]);
  useEffect(() => {
    if (chosenId !== null && clickedHere) setOpen(true);
  }, [chosenId, clickedHere]);
  useEffect(() => {
    if (open && chosenId !== null) openRow.current?.scrollIntoView({ block: "nearest" });
  }, [open, chosenId]);

  if (!hasTarget) return null;
  return (
    <section className={open ? "stage-label objects open" : "stage-label objects"} aria-label="Objects in this field">
      {/* The whole heading is one switch: it hides or shows every object in the list. */}
      <button className="objects-head" aria-expanded={open} onClick={() => setOpen((now) => !now)} title={open ? "Hide all the objects" : "Show all the objects"}>
        <Chevron />
        <strong>Objects<span className="not-narrow"> in this field</span></strong>
        {fixed && <span className="muted">({listed.length})</span>}
        <span className="objects-word">{open ? "Hide" : "Show"}</span>
      </button>
      {open && fixed && (
        <label className="check objects-mark" title="The rings and names drawn on the image">
          <input type="checkbox" checked={marked} onChange={(event) => actions.setDisplay({ showObjects: event.target.checked })} /> Mark them on the image
        </label>
      )}
      {open && (
        <ul className="object-list">
          {listed.map((object) => {
            const shown = chosen?.id === object.id;
            // A fast mover is said in plain words, unless its kind already says so.
            const quick = fast.has(object.id) && !/fast|high proper/i.test(object.kind ?? "");
            const note = [object.kind, quick ? "moves fast" : null].filter(Boolean).join(", ");
            return (
              <li key={object.id} ref={shown ? openRow : undefined}>
                <button className="object-row" aria-expanded={shown} onClick={() => actions.selectObject(shown ? null : object, "images")} title={shown ? "Hide its facts" : "Show its facts"}>
                  <Chevron />
                  <span className="object-name">{object.name}</span>
                  {note && <span className="object-kind">{note}</span>}
                </button>
                {shown && <ObjectFacts object={object} fast={fast.has(object.id)} />}
              </li>
            );
          })}
          {fixed && listed.length === 0 && <li className="object-none">No cataloged object lies in this field.</li>}
          <li>
            <button className="object-row" aria-expanded={solar} onClick={() => setSolar((now) => !now)}>
              <Chevron />
              <span className="object-name">Asteroids, comets, and planets</span>
              <span className="object-kind">at the time of the image</span>
            </button>
            {solar && <SolarBodies />}
          </li>
        </ul>
      )}
    </section>
  );
}
