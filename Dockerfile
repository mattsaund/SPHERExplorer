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
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
COPY server/pyproject.toml server/uv.lock ./
RUN uv sync --frozen --no-dev
COPY server/spherex_api ./spherex_api
COPY --from=web /web/dist ./site

# Caches live in /tmp, which is memory on Cloud Run. They refill on demand.
ENV SPX_STATIC_DIR=/app/site \
    SPX_CACHE_DIR=/tmp/spherexplorer \
    SPX_CACHE_MAX_MB=300 \
    PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "exec uv run --no-sync uvicorn spherex_api.main:app --host 0.0.0.0 --port ${PORT}"]
