// The app shell: a full-screen layout with a top bar, a stage for the map and the images,
// a tools panel, a tray for charts, and a bottom bar for playback.
// Austin's side owns everything under ui/. Every engine piece in docs/ui-checklist.md is wired here
// or in the files this one brings in.
// Written with Claude Code (Anthropic) assistance.
import { useEffect } from "react";
import { actions, useStore } from "../core";
import { Embed } from "./Embed";
import { layout, useLayout } from "./layout";
import { BottomBar } from "./shell/BottomBar";
import { Dock } from "./shell/Dock";
import { Stage } from "./shell/Stage";
import { TopBar } from "./shell/TopBar";
import { Tray } from "./shell/Tray";
import "./styles/app.css";

/** Notices and errors, in a strip under the top bar. */
function Messages() {
  const error = useStore((s) => s.error);
  const notice = useStore((s) => s.notice);
  if (!error && !notice) return null;
  return (
    <div className="messages">
      {notice && <p className="notice">{notice}</p>}
      {error && (
        <p className="problem" role="alert">
          {error} <button onClick={() => actions.reload()}>Try again</button>
        </p>
      )}
    </div>
  );
}

export function App() {
  useEffect(() => actions.init(), []);
  const embed = useStore((s) => s.embed);
  const toast = useLayout((s) => s.toast);

  // Choosing a place brings its images forward, beside the map, and opens the spectrum the first time.
  useEffect(() => {
    let first = true;
    return useStore.subscribe((state, before) => {
      if (state.target === before.target || !state.target) return;
      // With room for both, the map and the images share the stage, so a search shows in each.
      if (useLayout.getState().stage === "map") layout.setStage(window.innerWidth >= 1200 ? "both" : "images");
      // On a small screen the charts would crowd out the images, so they wait to be asked for.
      if (first && useLayout.getState().tray === null && window.innerWidth >= 900 && window.innerHeight >= 720) layout.openTray("spectrum");
      first = false;
    });
  }, []);

  // Keys for the film: space plays and pauses, the arrows step. Not while typing or on a control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName ?? "";
      if (event.ctrlKey || event.metaKey || event.altKey || ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A", "SUMMARY"].includes(tag)) return;
      if (event.key === " ") actions.togglePlay();
      else if (event.key === "ArrowRight") actions.step(1);
      else if (event.key === "ArrowLeft") actions.step(-1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A page opened with embed=1 sits inside another site, so it gets the compact layout.
  if (embed) return <Embed />;

  return (
    <div className="app">
      <TopBar />
      <Messages />
      <div className="middle">
        <Stage />
        <Dock />
      </div>
      <Tray />
      <BottomBar />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
