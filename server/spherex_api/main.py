# FastAPI app for SPHERExplorer. Routes live under /api.
# Written with Claude Code (Anthropic) assistance.

from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import __version__

app = FastAPI(
    title="SPHERExplorer API",
    version=__version__,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# The data is public and the API holds no secrets, so any site may embed it.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.get("/api/health")
async def health():
    """Liveness check with the API version and server time."""
    return {
        "status": "ok",
        "version": __version__,
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
