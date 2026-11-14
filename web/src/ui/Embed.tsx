// Compact layout for a viewer placed inside another web page. The address holds embed=1.
// It keeps to the essentials: the images, playback, what to play, and a way into the whole tool.
// Austin's side owns the look. The engine pieces used here are listed in docs/ui-checklist.md.
// Written with Claude Code (Anthropic) assistance.
import { DATA_CREDIT, FrameView, actions, formatDec, formatRa, useStore, type SequenceMode } from "../core";
import "./styles/embed.css";

const MODES: { value: SequenceMode; label: string }[] = [
  { value: "exposures", label: "Every image" },
  { value: "visits", label: "By visit" },
  { value: "channels", label: "By wavelength" },
  { value: "deep", label: "Deepest" },
];

/** The compact layout for a page opened with embed=1: the images, a player, and a link to the full tool. */
export function Embed() {
  const target = useStore((s) => s.target);
  const targetState = useStore((s) => s.targetState);
  const framesState = useStore((s) => s.framesState);
  // Images skipped on purpose (off the detector edge, or thinned for speed) are not waited for.
  const total = useStore((s) => s.frames.filter((f) => f.status !== "outside").length);
  const loaded = useStore((s) => s.loaded);
  const failed = useStore((s) => s.failed);
  const error = useStore((s) => s.error);
  const count = useStore((s) => s.sequence.length);
  const index = useStore((s) => s.player.index);
  const playing = useStore((s) => s.player.playing);
  const item = useStore((s) => s.sequence[s.player.index]);
  const mode = useStore((s) => s.mode);

  let status: string | null = null;
  if (!target && targetState !== "loading") status = "Add a place to the address, for example ?ra=133.76&dec=-7.24&embed=1";
  else if (targetState === "loading") status = "Searching the SPHEREx archive…";
  else if (targetState === "ready" && total === 0) status = "SPHEREx has no public images of this spot yet.";
  else if (framesState === "loading") status = `Loading images: ${loaded + failed} of ${total}`;

  const title = target ? target.name ?? `${formatRa(target.ra)} ${formatDec(target.dec)}` : "SPHERExplorer";

  return (
    <div className="embed">
      <div className="embed-view">
        {target && <FrameView />}
        <div className="embed-top">
          <span className="embed-title" title={title}>{title}</span>
          {/* The address is filled in at click time, so it always matches the view. */}
          <a
            href={actions.shareLink()}
            target="_blank"
            rel="noopener"
            onClick={(event) => { event.currentTarget.href = actions.shareLink(); }}
          >
            Open in SPHERExplorer
          </a>
        </div>
        {(status || error) && (
          <div className="embed-status" aria-live="polite">
            {error ? (
              <p role="alert">{error} <button onClick={() => actions.reload()}>Try again</button></p>
            ) : (
              <p>{status}</p>
            )}
            {framesState === "loading" && <progress max={total} value={loaded + failed} />}
          </div>
        )}
      </div>
      <div className="embed-bar">
        <button onClick={() => actions.step(-1)} disabled={count < 2} aria-label="Previous image">◀</button>
        <button className="primary" onClick={() => actions.togglePlay()} disabled={count < 2}>{playing ? "Pause" : "Play"}</button>
        <button onClick={() => actions.step(1)} disabled={count < 2} aria-label="Next image">▶</button>
        <input
          type="range"
          min={0}
          max={Math.max(0, count - 1)}
          value={Math.min(index, Math.max(0, count - 1))}
          onChange={(event) => actions.seek(Number(event.target.value))}
          aria-label="Position in the sequence"
          disabled={count < 2}
        />
        <select value={mode} onChange={(event) => actions.setMode(event.target.value as SequenceMode)} aria-label="What to play">
          {MODES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
        </select>
        <p className="embed-note">
          <span>{item ? `${item.label} (${index + 1} of ${count})` : "No images yet"}</span>
          <span>{DATA_CREDIT}</span>
        </p>
      </div>
    </div>
  );
}
