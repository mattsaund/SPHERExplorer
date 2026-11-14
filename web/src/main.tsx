// App entry. Mounts the UI shell. Shared file: announce changes in the pull request.
// Written with Claude Code (Anthropic) assistance.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles/tokens.css";
import "./ui/styles/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
