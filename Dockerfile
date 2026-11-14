# One container for the whole of SPHERExplorer: the API plus the built web app.
# Build:  docker build -t spherexplorer .
# Run:    docker run -p 8080:8080 spherexplorer
# Written with Claude Code (Anthropic) assistance.

# Stage 1: build the web app.
FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: the API, with the built site beside it.
FROM python:3.13-slim
# A fixed version of the installer, so every build uses the same one.
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /usr/local/bin/uv
WORKDIR /app
COPY server/pyproject.toml server/uv.lock ./
# Compile the libraries to bytecode now. Otherwise every new instance compiles them again
# on its first start, which adds seconds to a cold start.
ENV UV_COMPILE_BYTECODE=1
RUN uv sync --frozen --no-dev
COPY server/spherex_api ./spherex_api
RUN /app/.venv/bin/python -m compileall -q spherex_api
COPY --from=web /web/dist ./site

# Ship a copy of the exposure index, so a new instance can search at once instead of
# downloading 12 MB first. If the download fails here, the server fetches it at start as before.
RUN uv run --no-sync python -c "import urllib.request, spherex_api.config as c; urllib.request.urlretrieve(c.INDEX_URL, '/app/exposures.seed.npz')" \
    || echo "No index seed. The server will download the index when it starts."

# Caches live in /tmp, which is memory on Cloud Run. They refill on demand.
ENV SPX_STATIC_DIR=/app/site \
    SPX_INDEX_SEED=/app/exposures.seed.npz \
    SPX_CACHE_DIR=/tmp/spherexplorer \
    SPX_CACHE_MAX_MB=300 \
    HOME=/tmp \
    PORT=8080
EXPOSE 8080
# Run as a user with no rights over the system. Everything it writes goes to /tmp.
USER 65534:65534
# Start straight from the virtual environment, so nothing is resolved or installed at start.
CMD ["sh", "-c", "exec /app/.venv/bin/uvicorn spherex_api.main:app --host 0.0.0.0 --port ${PORT}"]
