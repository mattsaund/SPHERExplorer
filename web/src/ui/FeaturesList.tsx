// "What stands out in this spectrum": the known features the engine measured in the spectrum
// on screen, in plain words. Kept in its own file so any layout can place it.
// Austin's side owns the look. The engine pieces used here are listed in docs/ui-checklist.md.
// Written with Claude Code (Anthropic) assistance.
import { actions, describeFeature, spectrumFeatures, useStore } from "../core";
import "./styles/features.css";

/** What stands out in the spectrum, in plain words, with a button that marks those features on the plot. */
export function FeaturesList() {
  // The engine keeps the last answer, so this is cheap to ask on every change.
  const report = useStore((s) => spectrumFeatures(s));
  const loading = useStore((s) => s.framesState === "loading");
  const found = report.findings.length;

  return (
    <div className="features">
      <h3>What stands out in this spectrum</h3>
      {loading ? (
        <p className="muted">Waiting for every image to load.</p>
      ) : report.note ? (
        <p className="muted">{report.note}</p>
      ) : found === 0 ? (
        <p className="muted">Nothing stands out among the {report.checked} known features that fall on this spectrum.</p>
      ) : (
        <>
          <ul>
            {report.findings.map((finding) => (
              <li key={`${finding.familyId}:${finding.rest}:${finding.kind}`} className={finding.kind}>{describeFeature(finding)}</li>
            ))}
          </ul>
          <div className="row wrap">
            <button onClick={() => actions.markFound()}>Mark these on the plot</button>
            <span className="muted">Each one is measured against the spectrum on either side of it. A feature counts at five times its uncertainty.</span>
          </div>
        </>
      )}
    </div>
  );
}
