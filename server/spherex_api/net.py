# Shared HTTP clients, plus byte-range reads from the SPHEREx S3 bucket with retries.
#
# There are two clients. Everything except the bucket goes through httpx, which is pleasant
# and well tested. The bucket is read thousands of times for one target, and there the cost
# of each request in processor time decides how fast a first load is. Measured on 334 frames:
# httpx spent about 1.8 ms of processor time per request, most of it rescanning its
# connection pool. aiohttp does the same reads for a fraction of that.
# Written with Claude Code (Anthropic) assistance.

import asyncio

import aiohttp
import httpx

from . import config

_client: httpx.AsyncClient | None = None
_bucket: aiohttp.ClientSession | None = None

# Status codes worth a retry. S3 answers 503 "Slow Down" under bursts.
RETRYABLE = {429, 500, 502, 503, 504}


class UpstreamError(Exception):
    """An upstream service failed after retries."""


def client() -> httpx.AsyncClient:
    """One pooled client for the whole process. Connections stay warm between requests."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            # Catalogs, name lookups, and other services. A small pool is plenty for them.
            limits=httpx.Limits(max_connections=32, max_keepalive_connections=32, keepalive_expiry=90),
            headers={"User-Agent": config.USER_AGENT},
            follow_redirects=True,
        )
    return _client


def bucket() -> aiohttp.ClientSession:
    """One pooled session for the SPHEREx bucket. Its connection limit is the ceiling on parallel reads."""
    global _bucket
    if _bucket is None or _bucket.closed:
        _bucket = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(limit=config.S3_CONCURRENCY, keepalive_timeout=90, ttl_dns_cache=600),
            timeout=aiohttp.ClientTimeout(total=30, connect=10),
            headers={"User-Agent": config.USER_AGENT},
            auto_decompress=False,
        )
    return _bucket


# Close both clients when the server stops.
async def close():
    global _client, _bucket
    if _client is not None:
        await _client.aclose()
        _client = None
    if _bucket is not None:
        await _bucket.close()
        _bucket = None


async def s3_range(key: str, start: int, end: int) -> tuple[bytes, int]:
    """Read bytes [start, end) of a bucket object. Returns the bytes and the object's total size."""
    url = config.S3_BASE + key
    headers = {"Range": f"bytes={start}-{end - 1}"}
    last: Exception | None = None
    for attempt in range(5):
        try:
            async with bucket().get(url, headers=headers) as response:
                status = response.status
                if status == 206:
                    total = int(response.headers["Content-Range"].rsplit("/", 1)[1])
                    return await response.read(), total
                if status == 200:
                    # The server ignored the Range header and sent the whole object.
                    body = await response.read()
                    return body[start:end], len(body)
            if status not in RETRYABLE:
                raise UpstreamError(f"S3 answered {status} for {key}")
            last = UpstreamError(f"S3 answered {status} for {key}")
        except (aiohttp.ClientError, asyncio.TimeoutError) as error:
            last = error
        await asyncio.sleep(0.15 * 2**attempt)
    raise UpstreamError(f"S3 read failed for {key}: {last}")


async def s3_bytes(key: str, start: int, end: int) -> bytes:
    """Read bytes [start, end) of a bucket object."""
    data, _ = await s3_range(key, start, end)
    return data
