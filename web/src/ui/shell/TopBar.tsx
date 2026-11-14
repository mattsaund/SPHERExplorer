// The top bar: the name, the search box, the switch between map and images, and sharing.
// Written with Claude Code (Anthropic) assistance.
import { actions, useStore } from "../../core";
import { copyText, layout, useLayout, type StageMode } from "../layout";
import { SearchBox } from "../SearchBox";

const STAGES: { value: StageMode; label: string; hint: string }[] = [
  { value: "map", label: "Sky map", hint: "The whole sky, with every known object labeled" },
  { value: "images", label: "Images", hint: "Every SPHEREx image of the place you chose, as a short film" },
  { value: "both", label: "Side by side", hint: "The map and the images together" },
];

export function TopBar() {
  const stage = useLayout((s) => s.stage);
  const dock = useLayout((s) => s.dock);
  const hasTarget = useStore((s) => s.target !== null);

  return (
    <header className="topbar">
      <h1 className="brand">SPHERExplorer</h1>
      <SearchBox />
      <div className="segmented" role="radiogroup" aria-label="What to show">
        {STAGES.map((option) => (
          <button
            key={option.value}
            role="radio"
            aria-checked={stage === option.value}
            className={`${stage === option.value ? "on" : ""} stage-${option.value}`}
            title={option.hint}
            onClick={() => layout.setStage(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button className={dock ? "on" : ""} aria-pressed={dock} onClick={() => layout.toggleDock()} title="Settings for the map and the images">
        Tools
      </button>
      <button onClick={() => void copyText(actions.shareLink(), "Link copied")} disabled={!hasTarget} title="Copy a link that reopens this view">
        Share
      </button>
    </header>
  );
}
