# Coverage maps of the SPHEREx archive: where spectral images exist, and where the deep fields are.
# These are the two maps the IRSA SPHEREx Data Explorer lays over its sky view. Each is a small
# FITS file in the MOC format (Multi-Order Coverage map, an IVOA standard).
# IRSA serves them without CORS headers, so browsers get them through this server.
# Written with Claude Code (Anthropic) assistance.

import time

import httpx

from . import net

MAPS = {
    "spectral-images": "https://irsa.ipac.caltech.edu/data/MOC/spherex.obscore.moc.fits",
    "deep-fields": "https://irsa.ipac.caltech.edu/data/MOC/spherex.deep_field.moc.fits",
}
# IRSA renews the spectral image map with each data release, so a day is fresh enough.
TTL = 24 * 3600.0
# The real files are under 200 kB. Anything far larger is not what was asked for.
MAX_BYTES = 4_000_000

# name -> (time fetched, file bytes). Two small files, kept in memory and shared by all visitors.
_kept: dict[str, tuple[float, bytes]] = {}


async def moc(name: str) -> bytes:
    """
    The FITS file of one coverage map.
    Raises KeyError for a name that is not in MAPS, and net.UpstreamError when IRSA
    can't be read and no earlier copy is kept.
    """
    url = MAPS[name]
    kept = _kept.get(name)
    if kept and time.time() - kept[0] < TTL:
        return kept[1]
    try:
        response = await net.client().get(url)
        response.raise_for_status()
        data = response.content
        if not data.startswith(b"SIMPLE") or len(data) > MAX_BYTES:
            raise ValueError("not a FITS file of the expected size")
    except (httpx.HTTPError, ValueError) as error:
        if kept:
            return kept[1]  # an older map is better than none
        raise net.UpstreamError("The coverage map could not be read from IRSA. Try again in a minute.") from error
    _kept[name] = (time.time(), data)
    return data
