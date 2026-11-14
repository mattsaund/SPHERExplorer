// The bottom bar: playback of the image sequence, what to play, and what the app is doing.
// Written with Claude Code (Anthropic) assistance.
import { actions, useStore, type SequenceMode } from "../../core";

export const MODES: { value: SequenceMode; label: string; hint: string }[] = [
  { value: "exposures", label: "Every image", hint: "Each exposure in time order" },
  { value: "visits", label: "By visit", hint: "One summed image per visit. Best for spotting motion" },
  { value: "channels", label: "By wavelength", hint: "One summed image per wavelength channel" },
  { value: "deep", label: "Deepest", hint: "Every image summed into one" },
];

/** What the app is doing, in one line, with a progress bar while images load. */
function Status() {
  const targetState = useStore((s) => s.targetState);
  const framesState = useStore((s) => s.framesState);
  // Images skipped on purpose (off the detector edge, or thinned for speed) are not waited for.
  const total = useStore((s) => s.frames.filter((f) => f.status !== "outside").length);
  const loaded = useStore((s) => s.loaded);
  const failed = useStore((s) => s.failed);

  let text = "Pick a target or enter coordinates to begin.";
  if (targetState === "loading") text = "Searching the SPHEREx archive…";
  else if (targetState === "ready" && total === 0) text = "SPHEREx has no public images of this spot yet.";
  else if (framesState === "loading") text = `Loading images: ${loaded + failed} of ${total}`;
  else if (framesState === "ready") text = `${loaded} images loaded${failed ? `, ${failed} could not be read` : ""}.`;

  return (
    <div className="status" aria-live="polite">
      <span>{text}</span>
      {framesState === "loading" && <progress max={total} value={loaded + failed} />}
    </div>
  );
}

export function BottomBar() {
  const count = useStore((s) => s.sequence.length);
  const index = useStore((s) => s.player.index);
  const playing = useStore((s) => s.player.playing);
  const fps = useStore((s) => s.player.fps);
  const item = useStore((s) => s.sequence[s.player.index]);
  const mode = useStore((s) => s.mode);

  return (
    <footer className="bottombar">
      <div className="transport">
        <button onClick={() => actions.step(-1)} disabled={count < 2} aria-label="Previous image">◀</button>
        <button className="primary play" onClick={() => actions.togglePlay()} disabled={count < 2}>
          {playing ? "Pause" : "Play"}
        </button>
        <button onClick={() => actions.step(1)} disabled={count < 2} aria-label="Next image">▶</button>
      </div>
      <input
        className="scrub"
        type="range"
        min={0}
        max={Math.max(0, count - 1)}
        value={Math.min(index, Math.max(0, count - 1))}
        onChange={(event) => actions.seek(Number(event.target.value))}
        aria-label="Position in the sequence"
        disabled={count < 2}
      />
      <div className="step">
        <span className="count">{count ? `${index + 1} / ${count}` : "0 / 0"}</span>
        <span className="label">{item ? item.label : "No images yet"}</span>
      </div>
      <label className="compact">
        Sequence
        <select value={mode} onChange={(event) => actions.setMode(event.target.value as SequenceMode)} title={MODES.find((option) => option.value === mode)?.hint}>
          {MODES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="compact speed">
        Speed
        <input type="range" min={1} max={20} step={1} value={fps} onChange={(event) => actions.setSpeed(Number(event.target.value))} />
      </label>
      <Status />
    </footer>
  );
}
