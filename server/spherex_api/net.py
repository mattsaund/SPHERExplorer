# Shared HTTP client, plus byte-range reads from the SPHEREx S3 bucket with retries.
# Written with Claude Code (Anthropic) assistance.
#
# Everything except the bucket goes through httpx.
# The bucket is read thousands of times per target, and that intake is most of the processor
# time of a first load. So each read is a blocking request on a worker thread with its own
# kept-alive connection. Receiving and decrypting release Python's lock, so the reads spread
# over every processor and the event loop only hands them out.
# The exchange is written and read directly on the socket, at half the processor cost of
# http.client (0.15 ms against 0.30 ms for a small read). An answer in a form this does not
# read falls back to http.client. The bucket closes each connection after 100 requests.

import asyncio
import http.client
import socket
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

import httpx

from . import config

_client: httpx.AsyncClient | None = None

# The threads that read the bucket, one connection each. Their number is the ceiling on parallel reads.
_readers: ThreadPoolExecutor | None = None
_local = threading.local()
_tls = ssl.create_default_context()
# Seconds a connect or a single receive may take before the read is tried again.
READ_TIMEOUT = 20.0
# Totals since the server started, for /api/health. Changed under the lock, since many threads count.
read_stats = {"reads": 0, "bytes": 0, "retries": 0}
_stats_lock = threading.Lock()


def _count(reads: int = 0, size: int = 0, retries: int = 0) -> None:
    """Add to the totals."""
    with _stats_lock:
        read_stats["reads"] += reads
        read_stats["bytes"] += size
        read_stats["retries"] += retries

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


def _reader_pool() -> ThreadPoolExecutor:
    """The threads that read the bucket. Made on first use."""
    global _readers
    if _readers is None:
        _readers = ThreadPoolExecutor(max_workers=config.S3_CONCURRENCY, thread_name_prefix="bucket")
    return _readers


# Close the client and stop the reader threads when the server stops.
async def close():
    global _client, _readers
    if _client is not None:
        await _client.aclose()
        _client = None
    if _readers is not None:
        _readers.shutdown(wait=False, cancel_futures=True)
        _readers = None


class _Unreadable(Exception):
    """The bucket answered in a form the direct exchange does not read."""


class _Link:
    """One thread's kept-alive connection to the bucket, spoken to directly on the socket."""

    def __init__(self):
        self.sock: socket.socket | None = None
        self.file = None

    # Open the connection. TLS checks the bucket's certificate and name as usual.
    def open(self) -> None:
        base = urlsplit(config.S3_BASE)
        secure = base.scheme == "https"
        sock = socket.create_connection((base.hostname, base.port or (443 if secure else 80)), timeout=READ_TIMEOUT)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        if secure:
            sock = _tls.wrap_socket(sock, server_hostname=base.hostname)
        self.sock = sock
        self.file = sock.makefile("rb", buffering=65536)

    # Close the connection, so the next read opens a fresh one.
    def close(self) -> None:
        for part in (self.file, self.sock):
            try:
                if part is not None:
                    part.close()
            except OSError:
                pass
        self.sock = self.file = None

    def get(self, host: bytes, path: bytes, start: int, end: int) -> tuple[int, bytes, int | None]:
        """One Range request and its answer. Returns (status, body, total size of the object or None)."""
        self.sock.sendall(
            b"GET " + path + b" HTTP/1.1\r\nHost: " + host + b"\r\nRange: bytes=%d-%d\r\nUser-Agent: " % (start, end - 1)
            + config.USER_AGENT.encode("ascii", "replace") + b"\r\nAccept-Encoding: identity\r\n\r\n"
        )
        line = self.file.readline(8192)
        if not line:
            raise ConnectionError("The bucket closed the connection")
        words = line.split(None, 2)
        if len(words) < 2 or not words[0].startswith(b"HTTP/1.") or not words[1].isdigit():
            raise _Unreadable(f"Unexpected status line {line[:60]!r}")
        status = int(words[1])
        length = total = None
        closing = False
        while True:
            line = self.file.readline(8192)
            if line in (b"\r\n", b"\n"):
                break
            if not line:
                raise ConnectionError("The bucket closed the connection inside the headers")
            name, _, value = line.partition(b":")
            name = name.strip().lower()
            if name == b"content-length":
                length = int(value)
            elif name == b"content-range":
                total = int(value.rsplit(b"/", 1)[1])
            elif name == b"connection":
                closing = b"close" in value.lower()
            elif name == b"transfer-encoding":
                raise _Unreadable("The answer is chunked")
        if length is None:
            raise _Unreadable("The answer has no length")
        body = self.file.read(length)
        if len(body) != length:
            raise ConnectionError("The bucket closed the connection inside the body")
        if closing:
            # The bucket ends each connection after 100 requests. The next read opens a new one.
            self.close()
        return status, body, total


def _link() -> _Link:
    """This thread's connection to the bucket. Opened by the read that first needs it."""
    link = getattr(_local, "link", None)
    if link is None:
        link = _local.link = _Link()
    return link


def _get_slowly(key: str, start: int, end: int) -> tuple[int, bytes, int | None]:
    """The same Range request through http.client, for an answer the direct exchange could not read."""
    base = urlsplit(config.S3_BASE)
    maker = http.client.HTTPSConnection if base.scheme == "https" else http.client.HTTPConnection
    settings = {"context": _tls} if base.scheme == "https" else {}
    connection = maker(base.netloc, timeout=READ_TIMEOUT, **settings)
    try:
        connection.request("GET", base.path + key, headers={"Range": f"bytes={start}-{end - 1}", "User-Agent": config.USER_AGENT})
        response = connection.getresponse()
        body = response.read()
        span = response.headers.get("Content-Range")
        return response.status, body, int(span.rsplit("/", 1)[1]) if span else None
    finally:
        connection.close()


def _read_range(key: str, start: int, end: int) -> tuple[bytes, int]:
    """One blocking Range read on a reader thread. Returns the bytes and the object's total size."""
    base = urlsplit(config.S3_BASE)
    host = base.netloc.encode("ascii")
    path = (base.path + key).encode("ascii")
    link = _link()
    last: Exception | None = None
    attempt = 0
    stale = True  # a kept-alive connection that the bucket closed while idle is retried once at no cost
    while attempt < 5:
        reused = link.sock is not None
        try:
            if not reused:
                link.open()
            try:
                status, body, total = link.get(host, path, start, end)
            except _Unreadable:
                link.close()
                status, body, total = _get_slowly(key, start, end)
            if status == 206 and total is not None:
                _count(1, len(body))
                return body, total
            if status == 200:
                # The server ignored the Range header and sent the whole object.
                _count(1, len(body))
                return body[start:end], len(body)
            if status not in RETRYABLE:
                raise UpstreamError(f"S3 answered {status} for {key}")
            last = UpstreamError(f"S3 answered {status} for {key}")
        except (OSError, ValueError, http.client.HTTPException) as error:
            # OSError covers timeouts, resets, and TLS failures. ValueError is a header that is not a number.
            link.close()
            last = error
            if reused and stale:
                stale = False
                continue
        _count(retries=1)
        time.sleep(0.15 * 2**attempt)
        attempt += 1
    raise UpstreamError(f"S3 read failed for {key}: {last}")


async def s3_range(key: str, start: int, end: int) -> tuple[bytes, int]:
    """Read bytes [start, end) of a bucket object. Returns the bytes and the object's total size."""
    return await asyncio.get_running_loop().run_in_executor(_reader_pool(), _read_range, key, start, end)


async def s3_bytes(key: str, start: int, end: int) -> bytes:
    """Read bytes [start, end) of a bucket object."""
    data, _ = await s3_range(key, start, end)
    return data
