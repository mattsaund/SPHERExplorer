# The coverage maps relayed from IRSA: kept between visitors, and an old copy survives a failure.
# Written with Claude Code (Anthropic) assistance.

import httpx
import pytest

from spherex_api.skymap import coverage
from spherex_api import net

FITS = b"SIMPLE  =                    T / a small stand-in for a FITS file"


class FakeClient:
    """Answers every request with the same bytes, or fails, and counts the calls."""

    def __init__(self, body: bytes = FITS, fail: bool = False):
        self.body = body
        self.fail = fail
        self.calls: list[str] = []

    async def get(self, url: str):
        self.calls.append(url)
        if self.fail:
            raise httpx.ConnectError("no route")
        return httpx.Response(200, content=self.body, request=httpx.Request("GET", url))


@pytest.fixture(autouse=True)
def empty():
    coverage._kept.clear()
    yield
    coverage._kept.clear()


async def test_a_map_is_fetched_once_and_kept(monkeypatch):
    fake = FakeClient()
    monkeypatch.setattr(net, "client", lambda: fake)
    assert await coverage.moc("spectral-images") == FITS
    assert await coverage.moc("spectral-images") == FITS
    assert fake.calls == [coverage.MAPS["spectral-images"]]


async def test_unknown_name_is_refused():
    with pytest.raises(KeyError):
        await coverage.moc("everything")


async def test_an_old_copy_outlives_a_failure(monkeypatch):
    coverage._kept["deep-fields"] = (0.0, FITS)  # fetched long ago, so it is due for renewal
    monkeypatch.setattr(net, "client", lambda: FakeClient(fail=True))
    assert await coverage.moc("deep-fields") == FITS


async def test_failure_with_nothing_kept_is_reported(monkeypatch):
    monkeypatch.setattr(net, "client", lambda: FakeClient(fail=True))
    with pytest.raises(net.UpstreamError):
        await coverage.moc("deep-fields")


async def test_a_page_that_is_not_fits_is_refused(monkeypatch):
    monkeypatch.setattr(net, "client", lambda: FakeClient(body=b"<html>Service down</html>"))
    with pytest.raises(net.UpstreamError):
        await coverage.moc("spectral-images")
