# FastAPI app for SPHERExplorer. Routes live under /api.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import re
import time
import zlib
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from . import __version__, cache, config, exposures, net, site
from .images import cutout, fitsout, instrument, layout, sia
from .objects import catalogs, resolve, skybot, solarsystem, suggest
from .skymap import colorhips, coverage
from .telescopes import missions, partners, spacecraft

SWEEP_SECONDS = 600


async def _warm_up() -> None:
    """Load the exposure index and Astropy's machinery before the first visitor needs them.

    This runs after the server is up, so the page itself is served without waiting for it.
    Astropy loads on a thread, in the order a first study needs it: the decoder for the
    flags, then the coordinate tools.
    """
    try:
        await exposures.get_index()
        await asyncio.to_thread(cutout.rice_decoder)
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


# Start the background jobs when the server starts, and stop them when it stops.
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

class SafeHeaders:
    """
    Adds a few protective headers to every answer. Written as plain ASGI, not as an
    @app.middleware function, so that streamed answers pass straight through.
    There is no X-Frame-Options on purpose: other sites are meant to embed this one.
    """

    EXTRA = (
        # Browsers must not guess a file's type from its content.
        (b"x-content-type-options", b"nosniff"),
        # Other sites learn which site a visitor came from, not which page.
        (b"referrer-policy", b"strict-origin-when-cross-origin"),
        # Once seen over HTTPS, always use HTTPS. Browsers ignore this over plain HTTP.
        (b"strict-transport-security", b"max-age=31536000"),
        # The page uses none of these device features, so no script may ask for them.
        (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=(), usb=()"),
    )

    # `inner` is the app this wraps.
    def __init__(self, inner):
        self.inner = inner

    # Pass the request on, and add the headers to the start of the answer.
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.inner(scope, receive, send)
            return

        # Add any of the headers the answer does not already carry.
        async def add(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {name.lower() for name, _ in headers}
                headers += [(name, value) for name, value in self.EXTRA if name not in present]
                message = {**message, "headers": headers}
            await send(message)

        await self.inner(scope, receive, add)


app.add_middleware(SafeHeaders)
# The data is public and the API holds no secrets, so any site may embed it.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*"])


class GZipExceptFrames:
    """
    GZip for every answer except the stream of frames. That stream is either packed frame by
    frame already, or compressed by its own route, so a second pass would only burn processor time.
    """

    # `inner` is the app this wraps. The other settings go to GZipMiddleware.
    def __init__(self, inner, **settings):
        self.inner = inner
        self.zipped = GZipMiddleware(inner, **settings)

    # Send the frame stream straight through, and everything else through GZip.
    async def __call__(self, scope, receive, send):
        plain = scope["type"] == "http" and scope.get("path") == "/api/cutouts"
        await (self.inner if plain else self.zipped)(scope, receive, send)


# Level 5 is nearly as small as the default 9 and several times cheaper. The site's own files arrive already compressed.
app.add_middleware(GZipExceptFrames, minimum_size=1024, compresslevel=5)

# Only Level 2 image files inside the SPHEREx bucket may be read.
KEY_PATTERN = re.compile(r"^[a-z0-9_]+/level2/[A-Za-z0-9_\-./]+\.fits$")
MAX_BATCH = 6000
MAX_BATCH_PIXELS = 2.5e8   # about four times what the web app asks for
MAX_FITS_PIXELS = 2.5e7    # about 300 MB of FITS files in one zip


# Refuse any file key that is not a Level 2 image in the SPHEREx bucket.
def check_key(key: str) -> str:
    if not KEY_PATTERN.match(key) or ".." in key:
        raise HTTPException(400, "Not a SPHEREx Level 2 file key")
    return key


@app.get("/api/health")
async def health():
    """Liveness check with the API version and server time, plus counters for tuning the server.

    `reads` counts reads from the bucket since the server started, `tails` how file layouts were
    found (predicted or read), and `cpu_seconds` the processor time used so far on `cpus` processors.
    """
    return {
        "status": "ok",
        "version": __version__,
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "frames": cutout.cache_stats(),
        "reads": dict(net.read_stats),
        "tails": dict(layout.tail_counts),
        "cpus": config.CPUS,
        "cpu_seconds": round(time.process_time(), 1),
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
    busy = HTTPException(503, "The name service for planets, asteroids, and comets is not answering. Try again in a moment, or enter coordinates.")
    # "asteroid Ceres", "comet 67P", or "Halley's Comet" says outright that this is a solar system body.
    text = name.strip()
    if solarsystem.PREFIX.match(text) or solarsystem.COMET_SUFFIX.search(text) or solarsystem.DESIGNATION.match(text):
        try:
            body = await solarsystem.lookup(name)
        except net.UpstreamError as error:
            raise busy from error
        if body is not None:
            return {**body, "moving": True}
    found = await resolve.resolve(name)
    if found is None:
        # Not a star or galaxy. It may be a planet, an asteroid, or a comet.
        try:
            body = await solarsystem.lookup(name)
        except net.UpstreamError as error:
            raise busy from error
        if body is not None:
            return {**body, "moving": True}
        raise HTTPException(404, f'No object named "{text}" was found. Check the spelling, or enter coordinates.')
    return found


@app.get("/api/suggest")
async def suggestions(q: str = Query(min_length=3, max_length=60, description="What the person has typed so far")):
    """Names that fit what has been typed: the text itself when it is a known name, then asteroids and comets."""
    return {"suggestions": await suggest.remote(q)}


@app.get("/api/moving")
async def moving(command: str = Query(min_length=2, max_length=60, description="Body identifier from /api/resolve")):
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


@app.get("/api/known")
async def known_bodies(
    ra: float = Query(ge=0, lt=360),
    dec: float = Query(ge=-90, le=90),
    mjd: float = Query(ge=40000, le=80000, description="The moment to ask about, Modified Julian Date (UTC)"),
    radius: float = Query(120, gt=0, le=2700, description="Arcseconds. Up to the corners of the largest field"),
):
    """Known asteroids, comets, and planets near a position at a moment. From IMCCE SkyBoT. Slow: about twenty seconds."""
    try:
        found = await skybot.known_at(ra, dec, mjd, radius)
    except net.UpstreamError as error:
        raise HTTPException(502, str(error)) from error
    return {"source": "IMCCE SkyBoT", "radius": radius, "count": len(found), "bodies": found}


@app.get("/api/objects")
async def objects(
    response: Response,
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
    # The best-known objects of a patch of sky change slowly, so a browser may keep the answer
    # for an hour. A return visit to the same view then costs nothing.
    response.headers["Cache-Control"] = "public, max-age=3600"
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
        "telescopes": await spacecraft.telescopes(),
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


@app.get("/api/coverage/{name}")
async def coverage_map(name: str):
    """A coverage map of the SPHEREx archive as a FITS MOC file: "spectral-images" or "deep-fields"."""
    try:
        data = await coverage.moc(name)
    except KeyError as error:
        raise HTTPException(404, "There is no coverage map by that name.") from error
    except net.UpstreamError as error:
        raise HTTPException(502, str(error)) from error
    return Response(data, media_type="application/fits", headers={"Cache-Control": "public, max-age=3600"})


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
    # True asks for packed frames, which cost the server far less. The web app asks for them
    # when the browser can unpack them. Without it the stream is the older gzip one.
    pack: bool = False
    dtype: str = Field("f2", pattern="^f[24]$")


@app.post("/api/cutouts")
async def many_cutouts(body: BatchRequest):
    """Stream many frames. Each is sent as a uint32 length followed by the frame bytes.

    Frames arrive as they finish, not in request order. With `pack`, each frame is packed on
    its own (see cutout.pack) and the stream is sent as it is. Without it, frames are plain
    and the whole stream is gzip-compressed.
    """
    for frame in body.frames:
        check_key(frame.key)
    # Guard the server's memory and the archive: frames times pixels has a ceiling.
    pixels = len(body.frames) * (body.size / config.PIXEL_SCALE) ** 2 * 2
    if pixels > MAX_BATCH_PIXELS:
        raise HTTPException(413, "That is too many images for a field this wide. Ask for a smaller field or fewer images.")
    gate = asyncio.Semaphore(config.FRAME_CONCURRENCY)
    packed = body.pack and not body.sigma and body.dtype == "f2"

    # Build one frame, with a limit on how many are built at once.
    async def build(frame: FrameRequest) -> bytes:
        async with gate:
            phot = (frame.pra, frame.pdec) if frame.pra is not None and frame.pdec is not None else None
            own = frame.ra is not None and frame.dec is not None
            ra, dec, delta = (frame.ra, frame.dec, frame.delta) if own else (body.ra, body.dec, None)
            if packed:
                return await cutout.make_packed(frame.key, ra, dec, body.size, phot=phot, delta=delta)
            return await cutout.make_cutout(frame.key, ra, dec, body.size, phot=phot, sigma_plane=body.sigma, dtype=body.dtype, delta=delta)

    # Send each packed frame as soon as it is finished. Nothing more is done to it.
    async def stream_packed():
        tasks = [asyncio.ensure_future(build(frame)) for frame in body.frames]
        try:
            for finished in asyncio.as_completed(tasks):
                data = await finished
                yield len(data).to_bytes(4, "little") + data
        finally:
            # The client went away or the stream ended. Stop any work still running.
            for task in tasks:
                task.cancel()

    # Send each plain frame as soon as it is finished, compressed as one gzip stream.
    async def stream_gzip():
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
            for task in tasks:
                task.cancel()

    headers = {"Cache-Control": "no-store", "X-Accel-Buffering": "no"}
    if packed:
        return StreamingResponse(stream_packed(), media_type="application/octet-stream", headers=headers)
    return StreamingResponse(stream_gzip(), media_type="application/octet-stream", headers={**headers, "Content-Encoding": "gzip"})


@app.get("/api/fits")
async def fits_cutout(
    key: str,
    ra: float = Query(ge=0, lt=360),
    dec: float = Query(ge=-90, le=90),
    size: float = Query(300, ge=30, le=3600, description="Arcseconds"),
    delta: float | None = Query(None, gt=0, description="Distance in au of a solar system body"),
):
    """One Level 2 image cut out around a position, as a FITS file: image, flags, and variance, with its own WCS."""
    check_key(key)
    try:
        name, data = await fitsout.cutout(key, ra, dec, size, delta)
    except fitsout.Outside as error:
        raise HTTPException(404, "The position is off this detector.") from error
    except net.UpstreamError as error:
        raise HTTPException(502, str(error)) from error
    headers = {"Content-Disposition": f'attachment; filename="{name}"', "Cache-Control": "public, max-age=86400"}
    return Response(data, media_type="application/fits", headers=headers)


@app.post("/api/fits")
async def fits_archive(body: BatchRequest):
    """Many FITS cutouts in one zip file, streamed as it is written. Same request as /api/cutouts."""
    for frame in body.frames:
        check_key(frame.key)
    # Three planes of four bytes each, so the ceiling on pixels is a ceiling on the download.
    pixels = len(body.frames) * (body.size / config.PIXEL_SCALE) ** 2 * 2
    if pixels > MAX_FITS_PIXELS:
        raise HTTPException(413, "That is too much data for one download. Choose a smaller field, or save the image on screen by itself.")

    # The FITS cutout of one frame, around its own position when it has one.
    def job(frame: FrameRequest):
        own = frame.ra is not None and frame.dec is not None
        return fitsout.cutout(frame.key, frame.ra if own else body.ra, frame.dec if own else body.dec, body.size, frame.delta if own else None)

    headers = {"Content-Disposition": 'attachment; filename="spherex_cutouts.zip"', "Cache-Control": "no-store", "X-Accel-Buffering": "no"}
    return StreamingResponse(fitsout.zip_stream([job(frame) for frame in body.frames]), media_type="application/zip", headers=headers)


# ---- The web app itself, when a built copy is present ------------------------------------------

_static = Path(config.STATIC_DIR) if config.STATIC_DIR else None
if _static and (_static / "index.html").is_file():

    @app.get("/{path:path}", include_in_schema=False)
    async def serve_site(path: str, request: Request):
        """Serve a file of the built site, or the app shell for any other address."""
        if path.startswith("api/"):
            raise HTTPException(404, "No such API route")
        coding = request.headers.get("accept-encoding", "")
        # Any address that is not a file is a view of the app, so it gets the shell.
        return site.respond(_static, path, coding) or site.respond(_static, "index.html", coding)
