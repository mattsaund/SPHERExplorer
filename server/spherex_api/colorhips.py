# A full-color all-sky SPHEREx map, built on demand. IRSA publishes the all-sky cube as one
# gray tile set per channel. This module merges three channels into red, green, and blue and
# serves the result as an ordinary HiPS tile set that any HiPS viewer can show.
# Finished tiles are kept on disk, so IRSA is asked for each source tile only once.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import io
import re

import numpy as np
from PIL import Image

from . import config, net

CUBE = "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube"
MAX_ORDER = 5       # deepest level of the cube
TILE_COUNT = 12     # HEALPix base tiles. Level k has 12 * 4**k tiles.
CHANNELS = 102
BLANK = (50, 51)    # the cube has no image in these two channels

# Brightness factors for red, green, and blue. The cube's tiles share one brightness scale,
# on which starlight is several times stronger at short wavelengths. These bring an average
# star close to white, so color differences between objects stand out.
BALANCE = (1.9, 1.0, 1.05)

RECIPE = re.compile(r"^(\d{1,3})-(\d{1,3})-(\d{1,3})$")

_inflight: dict[str, asyncio.Future] = {}


def parse_recipe(recipe: str) -> tuple[int, int, int]:
    """Channels for red, green, and blue from a name like "90-47-22"."""
    match = RECIPE.match(recipe)
    if not match:
        raise ValueError("A color recipe looks like 90-47-22: three channel numbers from 0 to 101")
    channels = tuple(int(part) for part in match.groups())
    if any(c >= CHANNELS or c in BLANK for c in channels):
        raise ValueError("Channels run from 0 to 101, and 50 and 51 hold no image")
    return channels


def properties(recipe: str) -> str:
    """The HiPS properties file for one recipe."""
    red, green, blue = parse_recipe(recipe)
    lines = {
        "creator_did": f"ivo://spherexplorer/P/SPHEREx/DR1/color/{recipe}",
        "obs_title": f"SPHEREx DR1 all-sky color (channels {red}, {green}, {blue} as red, green, blue)",
        "obs_description": "Three channels of the SPHEREx DR1 all-sky cube from NASA/IPAC IRSA, merged into one color image by SPHERExplorer.",
        "obs_copyright": "NASA/SPHEREx",
        "prov_progenitor": "SPHEREx / IPAC, DOI 10.26131/IRSA679",
        "obs_regime": "Infrared",
        "dataproduct_type": "image",
        "hips_version": "1.4",
        "hips_frame": "equatorial",
        "hips_order": str(MAX_ORDER),
        "hips_order_min": "0",
        "hips_tile_width": "512",
        "hips_tile_format": "png",
        "hips_status": "public mirror unclonable",
        "hips_initial_fov": "180",
        "hips_initial_ra": "266.4",
        "hips_initial_dec": "-29.0",
        "moc_sky_fraction": "1",
    }
    return "".join(f"{key:<20} = {value}\n" for key, value in lines.items())


def _path(recipe: str, order: int, npix: int):
    return config.CACHE_DIR / "hips" / recipe / f"Norder{order}" / f"Npix{npix}.png"


async def _source(order: int, npix: int, channel: int) -> np.ndarray:
    """One gray tile of the cube as a float array."""
    suffix = "" if channel == 0 else f"_{channel}"
    url = f"{CUBE}/Norder{order}/Dir{(npix // 10000) * 10000}/Npix{npix}{suffix}.png"
    last: Exception | None = None
    for attempt in range(3):
        try:
            response = await net.client().get(url, timeout=30)
            response.raise_for_status()
            return np.asarray(Image.open(io.BytesIO(response.content)).convert("L"), dtype=np.float32)
        except Exception as error:  # noqa: BLE001
            last = error
            await asyncio.sleep(0.4 * (attempt + 1))
    raise net.UpstreamError(f"IRSA did not send a sky tile: {last}")


async def _build(recipe: str, order: int, npix: int) -> bytes:
    channels = parse_recipe(recipe)
    planes = await asyncio.gather(*(_source(order, npix, channel) for channel in channels))
    rgb = np.stack([plane * gain for plane, gain in zip(planes, BALANCE)], axis=-1)
    image = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    out = io.BytesIO()
    image.save(out, "PNG", compress_level=6)
    data = out.getvalue()
    path = _path(recipe, order, npix)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(".tmp")
        temp.write_bytes(data)
        temp.replace(path)
    except OSError:
        pass  # serving still works without the disk copy
    return data


async def tile(recipe: str, order: int, npix: int) -> bytes:
    """One color tile as PNG bytes, from disk when it was built before."""
    if not 0 <= order <= MAX_ORDER or not 0 <= npix < TILE_COUNT * 4**order:
        raise ValueError("No such tile")
    parse_recipe(recipe)
    path = _path(recipe, order, npix)
    try:
        return path.read_bytes()
    except OSError:
        pass
    token = f"{recipe}/{order}/{npix}"
    pending = _inflight.get(token)
    if pending is None:
        pending = asyncio.ensure_future(_build(recipe, order, npix))
        _inflight[token] = pending
        pending.add_done_callback(lambda _: _inflight.pop(token, None))
    return await asyncio.shield(pending)
