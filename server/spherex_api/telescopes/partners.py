# Space Agency Partner data: visible-light images from NEOSSat, the Canadian Space Agency's
# Near-Earth Object Surveillance Satellite, served by the Canadian Astronomy Data Centre (CADC).
# NEOSSat has watched many fields for years, so it shows how a target looked before SPHEREx flew.
# License: Open Government Licence - Canada.
# Written with Claude Code (Anthropic) assistance.

import csv
import io
import time

from .. import net

CADC_TAP = "https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/argus/sync"
CADC_FILES = "https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/raven/files/cadc:NEOSSAT/"
CACHE_SECONDS = 12 * 3600
ROW_LIMIT = 3000
# Processed versions of an image, best first.
PRODUCT_RANK = {"clean": 0, "cord": 1, "cor": 2, "raw": 3}

_cache: dict[tuple, tuple[float, dict]] = {}


def shape(rows: list[dict]) -> dict:
    """One entry per NEOSSat image, newest first, keeping the best processed version of each."""
    best: dict[str, dict] = {}
    for row in rows:
        ident = row["observationID"]
        product = row["productID"]
        held = best.get(ident)
        if held is None or PRODUCT_RANK.get(product, 9) < PRODUCT_RANK.get(held["product"], 9):
            try:
                best[ident] = {
                    "id": ident,
                    "product": product,
                    "mjd": float(row["time_bounds_lower"]),
                    "exposure": float(row["time_exposure"]) if row["time_exposure"] else None,
                    "target": row["target_name"] or None,
                }
            except ValueError:
                continue
    images = sorted(best.values(), key=lambda image: -image["mjd"])
    for image in images:
        stem = f"{image['id']}_{image['product']}_prev"
        image["thumbnail"] = f"{CADC_FILES}{stem}_256.png"
        image["preview"] = f"{CADC_FILES}{stem}.png"
        suffix = "" if image["product"] == "raw" else f"_{image['product']}"
        image["fits"] = f"{CADC_FILES}NEOS_SCI_{image['id']}{suffix}.fits"
    return {
        "mission": "NEOSSat",
        "agency": "Canadian Space Agency",
        "credit": "Contains information licensed under the Open Government Licence - Canada.",
        "count": len(images),
        "first": images[-1]["mjd"] if images else None,
        "last": images[0]["mjd"] if images else None,
        "images": images,
    }


async def neossat(ra: float, dec: float, radius: float = 0.02) -> dict:
    """NEOSSat images whose field holds a position. radius is in degrees."""
    token = (round(ra, 3), round(dec, 3), round(radius, 3))
    now = time.monotonic()
    hit = _cache.get(token)
    if hit and now - hit[0] < CACHE_SECONDS:
        return hit[1]
    adql = (
        f"SELECT TOP {ROW_LIMIT} o.observationID, p.productID, p.time_bounds_lower, p.time_exposure, o.target_name "
        "FROM caom2.Observation AS o JOIN caom2.Plane AS p ON p.obsID = o.obsID "
        f"WHERE o.collection = 'NEOSSAT' AND INTERSECTS(p.position_bounds, CIRCLE('ICRS', {ra:.6f}, {dec:.6f}, {radius:.4f})) = 1 "
        "ORDER BY p.time_bounds_lower DESC"
    )
    try:
        response = await net.client().get(CADC_TAP, params={"LANG": "ADQL", "FORMAT": "csv", "QUERY": adql}, timeout=45)
        response.raise_for_status()
    except Exception as error:  # noqa: BLE001
        raise net.UpstreamError(f"The Canadian Astronomy Data Centre did not answer: {error}") from error
    answer = shape(list(csv.DictReader(io.StringIO(response.text))))
    _cache[token] = (now, answer)
    if len(_cache) > 300:
        for old in sorted(_cache, key=lambda k: _cache[k][0])[:100]:
            _cache.pop(old, None)
    return answer
