// Starter app shell. It proves the engine wiring end to end.
// Austin's side owns everything under ui/ and is free to rebuild it.
// Written with Claude Code (Anthropic) assistance.
import { TEST_TARGETS, actions, useStore } from "../core";

export function App() {
  const target = useStore((s) => s.target);

  return (
    <main style={{ padding: "var(--space-6)", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>SPHERExplorer</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        Explore NASA SPHEREx images of the sky and how they change over time.
      </p>

      <h2>Try a target</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {TEST_TARGETS.map((t) => (
          <button key={t.name} onClick={() => actions.setTarget(t)}>
            {t.name}
          </button>
        ))}
      </div>

      {target && (
        <p>
          {target.name}. {target.kind}. RA {target.ra.toFixed(5)}, Dec {target.dec.toFixed(5)}.
        </p>
      )}
    </main>
  );
}
