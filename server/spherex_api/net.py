# Shared HTTP client, plus byte-range reads from the SPHEREx S3 bucket with retries.
# Written with Claude Code (Anthropic) assistance.

import asyncio

import httpx

from . import config

_client: httpx.AsyncClient | None = None
_s3_gate: asyncio.Semaphore | None = None

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
            limits=httpx.Limits(
                max_connections=config.S3_CONCURRENCY + 32,
                max_keepalive_connections=config.S3_CONCURRENCY + 32,
                keepalive_expiry=90,
            ),
            headers={"User-Agent": config.USER_AGENT},
            follow_redirects=True,
        )
    return _client


async def close():
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _gate() -> asyncio.Semaphore:
    global _s3_gate
    if _s3_gate is None:
        _s3_gate = asyncio.Semaphore(config.S3_CONCURRENCY)
    return _s3_gate


async def s3_range(key: str, start: int, end: int) -> tuple[bytes, int]:
    """Read bytes [start, end) of a bucket object. Returns the bytes and the object's total size."""
    url = config.S3_BASE + key
    headers = {"Range": f"bytes={start}-{end - 1}"}
    last: Exception | None = None
    for attempt in range(5):
        try:
            async with _gate():
                response = await client().get(url, headers=headers)
            if response.status_code == 206:
                total = int(response.headers["content-range"].rsplit("/", 1)[1])
                return response.content, total
            if response.status_code == 200:
                # The server ignored the Range header and sent the whole object.
                body = response.content
                return body[start:end], len(body)
            if response.status_code not in RETRYABLE:
                raise UpstreamError(f"S3 answered {response.status_code} for {key}")
            last = UpstreamError(f"S3 answered {response.status_code} for {key}")
        except httpx.TransportError as error:
            last = error
        await asyncio.sleep(0.15 * 2**attempt)
    raise UpstreamError(f"S3 read failed for {key}: {last}")


async def s3_bytes(key: str, start: int, end: int) -> bytes:
    """Read bytes [start, end) of a bucket object."""
    data, _ = await s3_range(key, start, end)
    return data
