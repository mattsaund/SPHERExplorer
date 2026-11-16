// "Measure Changes": runs the change finder over the whole loaded field and lists what moved
// or changed brightness. Kept in its own file so any layout can place it.
// Austin's side owns the look. The engine pieces used here are listed in docs/ui-checklist.md.
// Written with Claude Code (Anthropic) assistance.
import { actions, describeChange, formatDec, formatRa, useStore } from "../core";
import "./styles/changes.css";

/** "A, B and C" for a list of names. */
function list(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** onShow runs when "Show" is pressed, so the page can bring the images to the front. */
export function ChangesPanel({ onShow }: { onShow?: () => void }) {
  const report = useStore((s) => s.changes);
  const finding = useStore((s) => s.finding);
  const ready = useStore((s) => s.framesState === "ready" && s.loaded > 0);
  const marked = useStore((s) => s.display.showChanges);
  const targetName = useStore((s) => s.target?.name);
  // A cold object shows only in detectors 5 and 6. With the others switched on too, their noise hides it.
  const shortOn = useStore((s) => s.filters.detectors.slice(0, 4).some(Boolean));
  const found = report?.changes.length ?? 0;
  // How steady the field is, which sets how large a change must be. Said in plain words.
  const yardstick = (count: number, value: string) => (count > 0 ? `${value}, from ${count} steady sources` : `${value}, a cautious standard value because this field has too few steady sources`);

  return (
    <section className="panel" aria-label="Measure changes">
      <h2>Measure Changes</h2>
      <p className="muted">
        Checks every source in the field, not only the target. It finds anything that moved, brightened, or faded between visits. The field's own steady
        stars are the yardstick.
      </p>
      <div className="row wrap">
        <button className="primary" onClick={() => void actions.findChanges()} disabled={!ready || finding !== null}>
          {finding !== null ? "Searching…" : report ? "Search again" : "Find changes"}
        </button>
        {finding !== null && <progress max={1} value={finding} aria-label="Search progress" />}
        <label className="check">
          <input type="checkbox" checked={marked} onChange={(event) => actions.setDisplay({ showChanges: event.target.checked })} /> Mark them on the image
        </label>
      </div>
      {report?.note && <p>{report.note}</p>}
      {report && !report.note && (
        <>
          <p>
            <strong>{found === 0 ? "Nothing changed" : found === 1 ? "1 change found" : `${found} changes found`}</strong> among {report.sources}{" "}
            {report.sources === 1 ? "source" : "sources"}, comparing {list(report.visits)}.
            {report.skipped.length > 0 && ` Left out for now, with too few images or wavelengths: ${list(report.skipped)}.`}
          </p>
          {found === 0 && shortOn && (
            <p className="muted">
              Cold objects such as brown dwarfs show only at the longest wavelengths. To look for one, switch on only detectors 5 and 6 in Settings and
              search again.
            </p>
          )}
          <ul className="changes">
            {report.changes.map((change, index) => (
              <li key={index}>
                <div className="row wrap">
                  <strong>{change.target && targetName ? targetName : change.object?.name ?? (change.target ? "The target" : `${formatRa(change.ra)} ${formatDec(change.dec)}`)}</strong>
                  {change.object?.kind && <span className="muted">{change.object.kind}</span>}
                  <button
                    onClick={() => {
                      actions.showChange(change);
                      onShow?.();
                    }}
                  >
                    Show
                  </button>
                  {change.object && <a href={change.object.url} target="_blank" rel="noreferrer">Details</a>}
                </div>
                <p>{describeChange(change)}</p>
                {change.caution && <p className="muted">A very bright star is close by. Its glare can mimic change, so this needed twice the usual certainty.</p>}
              </li>
            ))}
          </ul>
          <p className="muted">
            Yardstick between visits. Position: {yardstick(report.positionReferences, `${report.positionScatter.toFixed(2)} arcsec`)}. Brightness:{" "}
            {yardstick(report.brightnessReferences, `${(report.brightnessScatter * 100).toFixed(1)} percent`)}. A change counts when it is at least five times its
            uncertainty.
          </p>
        </>
      )}
    </section>
  );
}
