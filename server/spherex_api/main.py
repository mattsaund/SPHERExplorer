# FastAPI app for SPHERExplorer. Routes live under /api.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import re
import zlib
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from . import __version__, catalogs, config, cutout, exposures, instrument, net, resolve, sia


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await net.close()


app = FastAPI(
    title="SPHERExplorer API",
    version=__version__,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# The data is public and the API holds no secrets, so any site may embed it.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Only Level 2 image files inside the SPHEREx bucket may be read.
KEY_PATTERN = re.compile(r"^[a-z0-9_]+/level2/[A-Za-z0-9_\-./]+\.fits$")
MAX_BATCH = 6000


def check_key(key: str) -> str:
    if not KEY_PATTERN.match(key) or ".." in key:
        raise HTTPException(400, "Not a SPHEREx Level 2 file key")
    return key


@app.get("/api/health")
async def health():
    """Liveness check with the API version and server time."""
    return {
        "status": "ok",
        "version": __version__,
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


@app.get("/api/meta")
async def meta():
    """Instrument facts and the live data collections. The web app loads this once."""
    index = await exposures.get_index()
    return {
        "version": __version__,
        # With an index, the collection list comes from it and IRSA is not contacted.
        "collections": index.collections if index else await sia.collections(),
        "index": index.summary() if index else None,
        "pixelScale": config.PIXEL_SCALE,
        "detectors": instrument.DETECTORS,
        "channels": instrument.CHANNELS.tolist(),
        "flags": instrument.FLAG_BITS,
        "badMask": instrument.BAD_MASK,
        "stackMask": instrument.STACK_MASK,
    }


@app.get("/api/search")
async def search(
    ra: float = Query(ge=0, lt=360, description="Right ascension, ICRS degrees"),
    dec: float = Query(ge=-90, le=90, description="Declination, ICRS degrees"),
    radius: float = Query(0.001, gt=0, le=0.5, description="Search radius in degrees"),
):
    """Every SPHEREx image that covers a position, across all live collections."""
    try:
        return await sia.search(ra, dec, radius)
    except net.UpstreamError as error:
        raise HTTPException(502, str(error)) from error


@app.get("/api/resolve")
async def resolve_name(name: str = Query(min_length=1, max_length=120)):
    """Look up an object by name. Positions come back at epoch 2026.0 with motion."""
    found = await resolve.resolve(name)
    if found is None:
        raise HTTPException(404, f'No object named "{name.strip()}" was found. Check the spelling, or enter coordinates.')
    return found


@app.get("/api/objects")
async def objects(
    ra: float = Query(ge=0, lt=360),
    dec: float = Query(ge=-90, le=90),
    radius: float = Query(gt=0, le=180, description="Degrees. 90 or more means the whole sky"),
    limit: int = Query(200, ge=1, le=1000),
):
    """Known objects near a position, best known first. From SIMBAD."""
    try:
        found = await catalogs.simbad_cone(ra, dec, radius, limit)
    except net.UpstreamError as error:
        raise HTTPException(502, str(error)) from error
    return {"source": "SIMBAD", "count": len(found), "objects": found}


@app.get("/api/cutout")
async def one_cutout(
    key: str,
    ra: float = Query(ge=0, lt=360),
    dec: float = Query(ge=-90, le=90),
    size: float = Query(300, ge=30, le=3600, description="Field width in arcseconds"),
    pra: float | None = Query(None, description="Photometry position, if not the center"),
    pdec: float | None = None,
    sigma: bool = False,
    dtype: str = Query("f2", pattern="^f[24]$"),
):
    """One frame as a binary blob. See cutout.py for the format."""
    phot = (pra, pdec) if pra is not None and pdec is not None else None
    frame = await cutout.make_cutout(check_key(key), ra, dec, size, phot=phot, sigma_plane=sigma, dtype=dtype)
    # Level 2 files never change under a given key, so a frame can be cached for good.
    return Response(frame, media_type="application/octet-stream", headers={"Cache-Control": "public, max-age=31536000, immutable"})


class FrameRequest(BaseModel):
    key: str
    pra: float | None = None
    pdec: float | None = None


class BatchRequest(BaseModel):
    ra: float = Field(ge=0, lt=360)
    dec: float = Field(ge=-90, le=90)
    size: float = Field(300, ge=30, le=3600)
    frames: list[FrameRequest] = Field(max_length=MAX_BATCH)
    sigma: bool = False
    dtype: str = Field("f2", pattern="^f[24]$")


@app.post("/api/cutouts")
async def many_cutouts(body: BatchRequest):
    """Stream many frames. Each is sent as a uint32 length followed by the frame bytes.

    Frames arrive as they finish, not in request order. The stream is gzip-compressed.
    """
    for frame in body.frames:
        check_key(frame.key)
    gate = asyncio.Semaphore(config.FRAME_CONCURRENCY)

    async def build(frame: FrameRequest) -> bytes:
        async with gate:
            phot = (frame.pra, frame.pdec) if frame.pra is not None and frame.pdec is not None else None
            return await cutout.make_cutout(frame.key, body.ra, body.dec, body.size, phot=phot, sigma_plane=body.sigma, dtype=body.dtype)

    async def stream():
        tasks = [asyncio.ensure_future(build(frame)) for frame in body.frames]
        packer = zlib.compressobj(5, zlib.DEFLATED, 31)  # 31 selects the gzip container
        try:
            for finished in asyncio.as_completed(tasks):
                data = await finished
                chunk = packer.compress(len(data).to_bytes(4, "little") + data)
                # A sync flush pushes the frame out now, so the browser can show it at once.
                yield chunk + packer.flush(zlib.Z_SYNC_FLUSH)
            yield packer.flush()
        finally:
            # The client went away or the stream ended. Stop any work still running.
            for task in tasks:
                task.cancel()

    headers = {"Content-Encoding": "gzip", "Cache-Control": "no-store", "X-Accel-Buffering": "no"}
    return StreamingResponse(stream(), media_type="application/octet-stream", headers=headers)
