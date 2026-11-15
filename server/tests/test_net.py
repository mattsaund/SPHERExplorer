# Reading byte ranges from the bucket, against a stand-in for the bucket on this machine.
# The stand-in does what the real one does: it keeps connections alive, closes each after a
# set number of requests, drops idle ones, and now and then answers "slow down".
# Written with Claude Code (Anthropic) assistance.

import asyncio
import socketserver
import threading

import pytest

from spherex_api import config, net

BLOB = bytes(range(256)) * 4000  # one megabyte that differs from place to place


class Bucket(socketserver.ThreadingTCPServer):
    """A tiny HTTP server for one object. Its behavior is set by the test."""

    allow_reuse_address = True
    daemon_threads = True

    def __init__(self):
        super().__init__(("127.0.0.1", 0), Handler)
        self.requests = 0          # requests answered in all
        self.connections = 0       # connections accepted
        self.close_after = 0       # say "Connection: close" on every Nth request of a connection, 0 for never
        self.drop_next = 0         # close this many connections without an answer, as an idle one is found closed
        self.slow_down = 0         # answer 503 this many times first
        self.chunked = False       # answer in chunks, a form the direct exchange does not read
        self.missing = False       # answer 404


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        server: Bucket = self.server
        server.connections += 1
        served = 0
        while True:
            line = self.rfile.readline()
            if not line:
                return
            start = end = None
            while True:
                header = self.rfile.readline()
                if header in (b"\r\n", b""):
                    break
                name, _, value = header.partition(b":")
                if name.lower() == b"range":
                    first, last = value.strip().split(b"=")[1].split(b"-")
                    start, end = int(first), int(last) + 1
            if server.drop_next:
                server.drop_next -= 1
                return
            server.requests += 1
            served += 1
            closing = bool(server.close_after) and served >= server.close_after
            tail = b"Connection: close\r\n" if closing else b""
            if server.missing:
                self.wfile.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n" + tail + b"\r\nNot here.")
            elif server.slow_down:
                server.slow_down -= 1
                self.wfile.write(b"HTTP/1.1 503 Slow Down\r\nContent-Length: 4\r\n" + tail + b"\r\nwait")
            else:
                body = BLOB[start:end]
                head = b"HTTP/1.1 206 Partial Content\r\nContent-Range: bytes %d-%d/%d\r\n" % (start, end - 1, len(BLOB))
                if server.chunked:
                    self.wfile.write(head + b"Transfer-Encoding: chunked\r\n" + tail + b"\r\n%x\r\n" % len(body) + body + b"\r\n0\r\n\r\n")
                else:
                    self.wfile.write(head + b"Content-Length: %d\r\n" % len(body) + tail + b"\r\n" + body)
            self.wfile.flush()
            if closing:
                return


@pytest.fixture
def bucket(monkeypatch):
    server = Bucket()
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setattr(config, "S3_BASE", f"http://127.0.0.1:{server.server_address[1]}/")
    monkeypatch.setattr(net, "_readers", None)
    net._local.link = None
    monkeypatch.setattr(net.time, "sleep", lambda seconds: None)  # retries need not wait in a test
    yield server
    link = getattr(net._local, "link", None)
    if link is not None:
        link.close()
    net._local.link = None
    server.shutdown()
    server.server_close()


def test_a_range_is_read_exactly_and_the_connection_is_kept(bucket):
    assert net._read_range("dr1/level2/x.fits", 1000, 5000) == (BLOB[1000:5000], len(BLOB))
    assert net._read_range("dr1/level2/x.fits", 0, 1) == (BLOB[:1], len(BLOB))
    assert net._read_range("dr1/level2/x.fits", 900_000, 1_024_000) == (BLOB[900_000:1_024_000], len(BLOB))
    assert bucket.requests == 3 and bucket.connections == 1


def test_the_bucket_closing_a_connection_after_so_many_requests_costs_nothing(bucket):
    bucket.close_after = 3
    before = dict(net.read_stats)
    for index in range(10):
        assert net._read_range("dr1/level2/x.fits", index * 100, index * 100 + 700)[0] == BLOB[index * 100:index * 100 + 700]
    assert bucket.connections == 4  # 3 + 3 + 3 + 1
    assert net.read_stats["retries"] == before["retries"]
    assert net.read_stats["reads"] == before["reads"] + 10 and net.read_stats["bytes"] == before["bytes"] + 7000


def test_an_idle_connection_found_closed_is_reopened_without_counting_as_a_failure(bucket):
    assert net._read_range("dr1/level2/x.fits", 0, 10)[0] == BLOB[:10]
    bucket.drop_next = 1
    before = net.read_stats["retries"]
    assert net._read_range("dr1/level2/x.fits", 10, 20)[0] == BLOB[10:20]
    assert net.read_stats["retries"] == before and bucket.connections == 2


def test_slow_down_is_retried_and_a_missing_file_is_not(bucket):
    bucket.slow_down = 2
    before = net.read_stats["retries"]
    assert net._read_range("dr1/level2/x.fits", 5, 50)[0] == BLOB[5:50]
    assert net.read_stats["retries"] == before + 2
    bucket.missing = True
    count = bucket.requests
    with pytest.raises(net.UpstreamError, match="404"):
        net._read_range("dr1/level2/x.fits", 5, 50)
    assert bucket.requests == count + 1  # asked once, not five times


def test_an_answer_in_a_form_the_direct_exchange_does_not_read_falls_back(bucket):
    bucket.chunked = True
    assert net._read_range("dr1/level2/x.fits", 200, 90_000) == (BLOB[200:90_000], len(BLOB))


def test_a_bucket_that_never_answers_gives_up_with_a_clear_error(bucket):
    bucket.slow_down = 99
    with pytest.raises(net.UpstreamError, match="503"):
        net._read_range("dr1/level2/x.fits", 0, 10)


async def test_many_reads_at_once_each_get_their_own_bytes(bucket):
    bucket.close_after = 7
    spans = [(index * 997, index * 997 + 3000 + index) for index in range(200)]
    got = await asyncio.gather(*(net.s3_bytes("dr1/level2/x.fits", start, end) for start, end in spans))
    assert all(data == BLOB[start:end] for data, (start, end) in zip(got, spans))
    await net.close()
