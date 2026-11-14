// Vite build and dev-server config for the SPHERExplorer web app.
// Written with Claude Code (Anthropic) assistance.
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The engine (src/core) keeps state outside React: the store, the pixel planes, cached sums.
 * Swapping one engine file into a running page leaves some parts on the old copy of that state
 * and some on the new, so the map can stop following a search while the viewer still does.
 * Reload the whole page when an engine file changes. UI files still swap in place.
 */
function reloadOnEngineChange(): Plugin {
  return {
    name: "spherexplorer-reload-on-engine-change",
    handleHotUpdate({ file, server }) {
      if (!file.replace(/\\/g, "/").includes("/src/core/")) return;
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}

// The dev server forwards /api to the Python API so the browser sees one origin.
const apiTarget = process.env.API_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), reloadOnEngineChange()],
  server: {
    port: 5173,
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
  build: { target: "es2022", sourcemap: true },
  // satellite.js ships an optional multi-threaded build that uses top-level await in a worker.
  // Workers must be emitted as ES modules for that to compile.
  worker: { format: "es" },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
