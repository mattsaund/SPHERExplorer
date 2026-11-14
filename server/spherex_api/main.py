# FastAPI app for SPHERExplorer. Routes live under /api.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import re
import zlib
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import __version__, cache, catalogs, colorhips, config, cutout, exposures, instrument, missions, net, partners, resolve, sia, solarsystem, spacecraft, suggest

SWEEP_SECONDS = 600


async def _warm_up() -> None:
    """Load the exposure index and Astropy's machinery before the first visitor needs them."""
    try:
        await exposures.get_index()
        await resolve.warm()
    except Exception:  # noqa: BLE001 (a slow start beats a failed one)
        pass


async def _sweep() -> None:
    """Keep the cache folder under its ceiling. The walk runs in a thread so requests are not held up."""
    while True:
        try:
            await asyncio.to_thread(cache.prune, config.CACHE_MAX_MB * 1_000_000)
        except Exception:  # noqa: BLE001 (a failed sweep only costs disk space)
            pass
        await asyncio.sleep(SWEEP_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    jobs = [asyncio.ensure_future(_warm_up()), asyncio.ensure_future(_sweep())]
    yield
    for job in jobs:
        job.cancel()
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
MAX_BATCH_PIXELS = 2.5e8   # about four times what the web app asks for


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
        "frames": cutout.cache_stats(),
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
    # "asteroid Ceres" or "comet 67P" says outright that this is a solar system body.
    if solarsystem.PREFIX.match(name.strip()):
        body = await solarsystem.lookup(name)
        if body is not None:
            return {**body, "moving": True}
    found = await resolve.resolve(name)
    if found is None:
        # Not a star or galaxy. It may be a planet, an asteroid, or a comet.
        body = await solarsystem.lookup(name)
        if body is not None:
            return {**body, "moving": True}
        raise HTTPException(404, f'No object named "{name.strip()}" was found. Check the spelling, or enter coordinates.')
    return found


@app.get("/api/suggest")
async def suggestions(q: str = Query(min_length=3, max_length=60, description="What the person has typed so far")):
    """Names that fit what has been typed: the text itself when it is a known name, then asteroids and comets."""
    return {"suggestions": await suggest.remote(q)}


@app.get("/api/moving")
async def moving(command: str = Query(min_length=3, max_length=60, description="Body identifier from /api/resolve")):
    """Every SPHEREx image that caught a solar system body, with its position at each exposure."""
    index = await exposures.get_index()
    if index is None:
        raise HTTPException(503, "The exposure index is not loaded yet. Try again in a moment.")
    try:
        path = await solarsystem.ephemeris(command, float(index.rows["mjd"].max()))
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    except net.UpstreamError as error:
        raise HTTPException(502, str(error)) from error
    return await sia.search_moving(index, path)


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


@app.get("/api/missions")
async def other_missions(
    ra: float = Query(ge=0, lt=360),
    dec: float = Query(ge=-90, le=90),
    radius: float = Query(180, gt=0, le=1800, description="Arcseconds"),
):
    """Gaia DR3 sources and 2MASS and WISE brightness near a position."""
    return await missions.nearby(ra, dec, radius)


@app.get("/api/spacecraft")
async def spacecraft_status():
    """Orbital elements of SPHEREx for a live position, plus how fresh the public archive is."""
    index = await exposures.get_index()
    return {
        **spacecraft.FACTS,
        "elements": await spacecraft.elements(),
        "archive": index.summary() if index else None,
        "recent": spacecraft.recent_pointings(index),
    }


@app.get("/api/neossat")
async def neossat(
    ra: float = Query(ge=0, lt=360),
    dec: float = Query(ge=-90, le=90),
):
    """Visible-light images of a position from Canada's NEOSSat, newest first."""
    try:
        return await partners.neossat(ra, dec)
    except net.UpstreamError as error:
        raise HTTPException(502, str(error)) from error


@app.get("/api/hips/spherex-color/{recipe}/properties")
async def color_properties(recipe: str):
    """HiPS properties of the full-color SPHEREx sky for one choice of three channels."""
    try:
        text = colorhips.properties(recipe)
    except ValueError as error:
        raise HTTPException(404, str(error)) from error
    return Response(text, media_type="text/plain", headers={"Cache-Control": "public, max-age=3600"})


@app.get("/api/hips/spherex-color/{recipe}/Norder{order}/Dir{folder}/Npix{npix}.png")
async def color_tile(recipe: str, order: int, folder: int, npix: int):
    """One tile of the full-color SPHEREx sky. Built from three IRSA tiles the first time."""
    try:
        data = await colorhips.tile(recipe, order, npix)
    except ValueError as error:
        raise HTTPException(404, str(error)) from error
    except net.UpstreamError as error:
        raise HTTPException(502, str(error)) from error
    return Response(data, media_type="image/png", headers={"Cache-Control": "public, max-age=31536000, immutable"})


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
    # A moving body has its own position in every frame. delta is its distance from Earth in au.
    ra: float | None = Field(None, ge=0, lt=360)
    dec: float | None = Field(None, ge=-90, le=90)
    delta: float | None = Field(None, gt=0)


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
    # Guard the server's memory and the archive: frames times pixels has a ceiling.
    pixels = len(body.frames) * (body.size / config.PIXEL_SCALE) ** 2 * 2
    if pixels > MAX_BATCH_PIXELS:
        raise HTTPException(413, "That is too many images for a field this wide. Ask for a smaller field or fewer images.")
    gate = asyncio.Semaphore(config.FRAME_CONCURRENCY)

    async def build(frame: FrameRequest) -> bytes:
        async with gate:
            phot = (frame.pra, frame.pdec) if frame.pra is not None and frame.pdec is not None else None
            own = frame.ra is not None and frame.dec is not None
            return await cutout.make_cutout(
                frame.key, frame.ra if own else body.ra, frame.dec if own else body.dec, body.size,
                phot=phot, sigma_plane=body.sigma, dtype=body.dtype, delta=frame.delta if own else None,
            )

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


# ---- The web app itself, when a built copy is present ------------------------------------------

_static = Path(config.STATIC_DIR) if config.STATIC_DIR else None
if _static and (_static / "index.html").is_file():
    app.mount("/assets", StaticFiles(directory=_static / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def site(path: str):
        """Serve a file of the built site, or the app shell for any other address."""
        if path.startswith("api/"):
            raise HTTPException(404, "No such API route")
        candidate = (_static / path).resolve()
        if path and candidate.is_file() and _static.resolve() in candidate.parents:
            return FileResponse(candidate)
        # Hashed assets are cached for good. The shell is always fetched fresh.
        return FileResponse(_static / "index.html", headers={"Cache-Control": "no-cache"})
