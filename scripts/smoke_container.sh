#!/usr/bin/env bash
# Builds the production container, starts it, and checks that the site and the API answer.
# Needs Docker. CI runs this on every push, so a broken deploy shows up before deploy day.
# Written with Claude Code (Anthropic) assistance.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=spherexplorer-smoke
PORT=18080

docker build -t "$IMAGE" .
ID=$(docker run -d -p "$PORT:8080" "$IMAGE")
# Always show the log and remove the container, pass or fail.
trap 'docker logs "$ID" 2>&1 | tail -30; docker rm -f "$ID" >/dev/null' EXIT

# Wait for the API to come up.
for _ in $(seq 60); do
  curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break
  sleep 1
done

echo "== health"
curl -fsS "http://127.0.0.1:$PORT/api/health" | grep -q '"ok"'

echo "== the built site is served"
curl -fsS "http://127.0.0.1:$PORT/" | grep -qi '<div id="root"'

echo "== other sites may frame it"
if curl -fsS -D - -o /dev/null "http://127.0.0.1:$PORT/" | grep -qi '^x-frame-options\|frame-ancestors'; then
  echo "The site sends a header that blocks embedding."; exit 1
fi

echo "== a deep link falls back to the site"
curl -fsS "http://127.0.0.1:$PORT/?target=WISE%200855-0714" | grep -qi '<div id="root"'

echo "== static assets are served"
ASSET=$(curl -fsS "http://127.0.0.1:$PORT/" | grep -o '/assets/[^"]*\.js' | head -1)
curl -fsS -o /dev/null "http://127.0.0.1:$PORT$ASSET"

echo "== instrument facts"
curl -fsS "http://127.0.0.1:$PORT/api/meta" | grep -q '"channels"'

echo "Container smoke test passed."
