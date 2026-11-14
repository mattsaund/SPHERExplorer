// The only door into the engine. UI code imports from here and nothing deeper.
// A change to an exported name or type is a contract change. See docs/architecture.md.
// Written with Claude Code (Anthropic) assistance.
export type { LoadState, SkyPosition, Target } from "./types";
export type { AppState } from "./store";
export { actions, useStore } from "./store";
export { TEST_TARGETS } from "./targets";
