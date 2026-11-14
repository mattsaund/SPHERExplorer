// Vite build and dev-server config for the SPHERExplorer web app.
// Written with Claude Code (Anthropic) assistance.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The dev server forwards /api to the Python API so the browser sees one origin.
const apiTarget = process.env.API_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
  build: { target: "es2022", sourcemap: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
