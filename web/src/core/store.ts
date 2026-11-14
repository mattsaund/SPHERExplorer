// Central app state. UI components read slices with useStore and change state through actions.
// Written with Claude Code (Anthropic) assistance.
import { create } from "zustand";
import type { LoadState, Target } from "./types";

export interface AppState {
  /** The place being studied, or null before the first search. */
  target: Target | null;
  /** Progress of the current search. */
  targetState: LoadState;
  /** Plain-language reason when something failed. */
  error: string | null;
  /** Width of the studied field in arcseconds. */
  fieldSize: number;
}

export const useStore = create<AppState>(() => ({
  target: null,
  targetState: "idle",
  error: null,
  fieldSize: 300,
}));

/** Every state change goes through here so the UI never touches the engine internals. */
export const actions = {
  /** Study a known target. */
  setTarget(target: Target) {
    useStore.setState({ target, targetState: "ready", error: null });
  },
  /** Change the field width in arcseconds. */
  setFieldSize(arcsec: number) {
    useStore.setState({ fieldSize: Math.min(3600, Math.max(30, arcsec)) });
  },
};
