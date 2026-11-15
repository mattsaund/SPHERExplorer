// The walkthrough: a short tour that points at each part of the page in turn, with a real
// example loaded so that every step has something to show. It opens by itself on a first
// visit, and from the Help button after that.
// Austin's side owns the look. The engine pieces used here are listed in docs/ui-checklist.md.
// Written with Claude Code (Anthropic) assistance.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TEST_TARGETS, actions, useStore } from "../core";
import "./styles/tour.css";

/** Which of the two screens a step is about, for pages too narrow to show both. */
export type TourScreen = "map" | "images";

interface Step {
  title: string;
  /** The words of the step. `loaded` is the name of a target the person already had open, if any. */
  text: (loaded: string | null) => string;
  /** CSS selector of the part of the page this step is about. Without one the card sits in the middle. */
  anchor?: string;
  /** The screen that must be showing for this step. */
  screen?: TourScreen;
  /** True for steps that need a target loaded. The tour loads its example if there is none. */
  example?: boolean;
}

/** The target the tour loads when nothing is open: one of NASA's five, quick to load and with plenty to see. */
const EXAMPLE = TEST_TARGETS.find((target) => target.name === "Epsilon Indi B") ?? TEST_TARGETS[0];

const STEPS: Step[] = [
  {
    title: "Welcome to SPHERExplorer",
    text: () =>
      "SPHEREx is a NASA telescope that photographs the whole sky in 102 colors of infrared light. This page shows every public SPHEREx image of any place in the sky as a short film, so you can see what moves and what changes. The tour takes about a minute.",
  },
  {
    title: "Find a place",
    anchor: ".search",
    text: (loaded) =>
      `Type a name such as Vega or Jupiter, or coordinates (RA and Dec). The list under the box offers NASA's five test targets. ${
        loaded ? `The tour will use ${loaded}, which you have open.` : `For this tour we will look at ${EXAMPLE.name}, a pair of brown dwarfs 12 light-years away.`
      }`,
  },
  {
    title: "The sky map",
    anchor: ".view.map",
    screen: "map",
    example: true,
    text: () =>
      "The map went there. The yellow square is the area being studied. Drag inside the square to move it, drag its edge to resize it, or click an object or anywhere on the map to load a new area. Close on its card ends the study.",
  },
  {
    title: "The images",
    anchor: ".view.images",
    screen: "images",
    example: true,
    text: () =>
      "These are the SPHEREx images of that area. Each one is taken in a different color of infrared light. The yellow marks show where the target should be. Click any ring to learn about that object.",
  },
  {
    title: "Play them like a film",
    anchor: ".controlbar",
    screen: "images",
    example: true,
    text: () =>
      'Press Play, or step one image at a time. "By visit" adds up each visit, so faint things show and moving things step from place to place. "Deepest" adds up everything.',
  },
  {
    title: "Blink against an older picture",
    anchor: ".blink",
    screen: "images",
    example: true,
    text: () =>
      "Blink swaps the SPHEREx image with one that an earlier telescope took many years before. Anything that jumps between the two has moved. Try it on this target after the tour.",
  },
  {
    title: "Objects and details",
    anchor: ".image-cards",
    screen: "images",
    example: true,
    text: () =>
      "Objects lists everything known in the field. Open one to read its facts. Details has the coordinates, the distance, and a link to everything known about the target.",
  },
  {
    title: "Tools",
    anchor: ".dock-tabs",
    example: true,
    text: () =>
      "Graphs shows the spectrum, which tells what something is made of. Studies finds everything in the field that moved or changed brightness, with one button. Telescopes shows where SPHEREx is right now. Save and share has pictures, films, data files, and links.",
  },
  {
    title: "Settings and help",
    anchor: ".toggles",
    text: () =>
      "Settings holds the detectors, brightness, color, and what is drawn on the map. Help brings this tour back at any time. That is the whole page. Enjoy the sky.",
  },
];

const SEEN_KEY = "spherexplorer.tour";

/** True on a first visit to the plain page: nobody has seen the tour, and the address asks for nothing. */
export function tourIsDue(): boolean {
  try {
    return window.location.search === "" && window.localStorage.getItem(SEEN_KEY) === null;
  } catch {
    return false; // storage is blocked, so the tour could never be marked as seen
  }
}

/** Remember that the tour has been seen, so it does not offer itself again. */
function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "seen");
  } catch {
    // Without storage the tour simply offers itself again next time.
  }
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the part of the page a step points at is on screen, or null when it is not showing. */
function boxOf(selector: string | undefined): Box | null {
  if (!selector) return null;
  const element = document.querySelector<HTMLElement>(selector);
  if (!element || element.offsetParent === null) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

const MARGIN = 12;

/**
 * Where to put the card, given the box it points at and its own size.
 * It tries under the box, above it, right of it, and left of it, and takes the first place
 * that fits on screen. A box as large as the map leaves no room around it, so the card then
 * sits inside the box, low and in the middle.
 */
function placeCard(box: Box | null, width: number, height: number): { left: number; top: number } {
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(MARGIN, x), Math.max(MARGIN, screenW - width - MARGIN));
  const clampY = (y: number) => Math.min(Math.max(MARGIN, y), Math.max(MARGIN, screenH - height - MARGIN));
  if (!box) return { left: clampX((screenW - width) / 2), top: clampY((screenH - height) / 2) };
  // On a phone the card takes the bottom of the screen, or the top when the box is low.
  if (screenW <= 720) return { left: clampX((screenW - width) / 2), top: box.top + box.height / 2 > screenH / 2 ? MARGIN : clampY(screenH) };
  const middleX = box.left + box.width / 2 - width / 2;
  const middleY = box.top + box.height / 2 - height / 2;
  if (box.top + box.height + MARGIN + height <= screenH - MARGIN) return { left: clampX(middleX), top: box.top + box.height + MARGIN };
  if (box.top - MARGIN - height >= MARGIN) return { left: clampX(middleX), top: box.top - MARGIN - height };
  if (box.left + box.width + MARGIN + width <= screenW - MARGIN) return { left: box.left + box.width + MARGIN, top: clampY(middleY) };
  if (box.left - MARGIN - width >= MARGIN) return { left: box.left - MARGIN - width, top: clampY(middleY) };
  return { left: clampX(middleX), top: clampY(box.top + box.height - height - 2 * MARGIN) };
}

/**
 * The tour itself. `onScreen` asks the page to show the map or the images for a step, and
 * `onClose` runs when the tour is finished or skipped.
 */
export function Tour({ onScreen, onClose }: { onScreen: (screen: TourScreen) => void; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  // The target that was open when the tour began, so the words can say what it will use.
  const [loaded] = useState(() => useStore.getState().target?.name ?? null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const close = useCallback(() => {
    markSeen();
    onClose();
  }, [onClose]);

  // Entering a step: load the example if the step needs a target, and show the right screen.
  useEffect(() => {
    if (step.example && useStore.getState().target === null) actions.goTo(EXAMPLE);
    if (step.screen) onScreen(step.screen);
    card.current?.focus();
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the part of the page being pointed at. It moves as views change and images load.
  useEffect(() => {
    const measure = () => {
      const next = boxOf(step.anchor);
      setBox((before) => (before && next && before.left === next.left && before.top === next.top && before.width === next.width && before.height === next.height ? before : next));
    };
    measure();
    const timer = window.setInterval(measure, 250);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [step.anchor]);

  // Place the card once its size is known, and again whenever the box moves.
  useLayoutEffect(() => {
    const element = card.current;
    if (element) setAt(placeCard(box, element.offsetWidth, element.offsetHeight));
  }, [box, index]);

  // Keys: Escape leaves, the arrows move. Caught first, so the film player does not also act on them.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") setIndex((now) => Math.min(STEPS.length - 1, now + 1));
      else if (event.key === "ArrowLeft") setIndex((now) => Math.max(0, now - 1));
      else if (event.key !== " ") return;
      event.stopImmediatePropagation();
      if (event.key !== " ") event.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  // The dark shade is one box with a very wide flat shadow, so the part being shown stays clear.
  const spot = box
    ? { left: box.left - 4, top: box.top - 4, width: box.width + 8, height: box.height + 8 }
    : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };

  return (
    <div className="tour">
      <div className={box ? "tour-spot" : "tour-spot none"} style={spot} aria-hidden="true" />
      <div
        className="tour-card"
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        style={at ? { left: at.left, top: at.top } : { left: 0, top: 0, visibility: "hidden" }}
      >
        <p className="tour-count">Step {index + 1} of {STEPS.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.text(loaded)}</p>
        <div className="tour-buttons">
          <button className="tour-skip" onClick={close}>{last ? "Close" : "Skip the tour"}</button>
          {index > 0 && <button onClick={() => setIndex(index - 1)}>Back</button>}
          {last ? (
            <button className="primary" onClick={close}>Done</button>
          ) : (
            <button className="primary" onClick={() => setIndex(index + 1)}>{index === 0 ? "Start" : "Next"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
