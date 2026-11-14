#!/usr/bin/env bash
# Runs every check that CI runs, and stops at the first failure.
# Use before each commit: scripts/check_all.sh
# Written with Claude Code (Anthropic) assistance.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== writing rules"
python3 scripts/check_text.py

echo "== UI coverage"
python3 scripts/check_ui_coverage.py

echo "== API tests"
(cd server && uv run pytest -q | tail -1)

echo "== web typecheck"
(cd web && npx tsc --noEmit)

echo "== web tests"
(cd web && npx vitest run 2>&1 | grep -E "Tests|FAIL" ; test "${PIPESTATUS[0]}" -eq 0)

echo "== web build"
(cd web && npx vite build >/dev/null 2>&1) || { echo "The web build failed. Run: cd web && npm run build"; exit 1; }

echo "All checks passed."
