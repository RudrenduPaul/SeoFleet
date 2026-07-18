"""Ported from test/fetch-utils.test.ts."""
from __future__ import annotations

import io

import pytest

from seofleet import fetch_utils
from seofleet.errors import SeoFleetError
from seofleet.fetch_utils import DEFAULT_USER_AGENT, assert_http_url, safe_fetch, with_user_agent


def test_assert_http_url_accepts_https():
    assert assert_http_url("https://example.com") == "https://example.com"


def test_assert_http_url_accepts_http():
    assert assert_http_url("http://example.com") == "http://example.com"


def test_assert_http_url_rejects_file_scheme():
    with pytest.raises(SeoFleetError):
        assert_http_url("file:///etc/passwd")


def test_assert_http_url_rejects_ftp_scheme():
    with pytest.raises(SeoFleetError):
        assert_http_url("ftp://example.com/x")


def test_assert_http_url_rejects_malformed_url():
    with pytest.raises(SeoFleetError):
        assert_http_url("not a url")


def test_assert_http_url_error_carries_exit_code_2():
    with pytest.raises(SeoFleetError) as excinfo:
        assert_http_url("javascript:alert(1)")
    assert excinfo.value.exit_code == 2


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.5/",
        "http://172.16.0.1/",
        "http://192.168.1.1/",
        "http://[::1]/",
        "http://localhost/",
    ],
)
def test_assert_http_url_rejects_loopback_private_link_local(url):
    with pytest.raises(SeoFleetError, match="loopback, private, or link-local"):
        assert_http_url(url)


def test_assert_http_url_accepts_public_ip_and_hostname():
    assert assert_http_url("http://8.8.8.8/") == "http://8.8.8.8/"
    assert assert_http_url("https://example.com") == "https://example.com"


class _FakeHttpResponse:
    """Minimal stand-in for the object `_opener.open(...)` returns: supports
    the context-manager protocol plus the `.status`/`.read()` surface
    safe_fetch actually uses."""

    def __init__(self, body: bytes = b"hello", status: int = 200) -> None:
        self.status = status
        self._buf = io.BytesIO(body)

    def read(self, size: int = -1) -> bytes:
        return self._buf.read(size)

    def __enter__(self) -> "_FakeHttpResponse":
        return self

    def __exit__(self, *exc_info: object) -> bool:
        return False


def test_safe_fetch_sends_chrome_like_default_user_agent(monkeypatch):
    captured: dict = {}

    def _fake_open(request, timeout=None):
        captured["user_agent"] = request.headers.get("User-agent")
        return _FakeHttpResponse()

    monkeypatch.setattr(fetch_utils._opener, "open", _fake_open)
    result = safe_fetch("https://example.com")
    assert result.ok is True
    assert captured["user_agent"] == DEFAULT_USER_AGENT
    assert "Chrome" in DEFAULT_USER_AGENT


def test_safe_fetch_lets_caller_override_user_agent(monkeypatch):
    captured: dict = {}

    def _fake_open(request, timeout=None):
        captured["user_agent"] = request.headers.get("User-agent")
        return _FakeHttpResponse()

    monkeypatch.setattr(fetch_utils._opener, "open", _fake_open)
    result = safe_fetch("https://example.com", user_agent="MyCustomBot/1.0")
    assert result.ok is True
    assert captured["user_agent"] == "MyCustomBot/1.0"


def test_with_user_agent_builds_fetch_fn_that_sends_given_user_agent(monkeypatch):
    captured: dict = {}

    def _fake_open(request, timeout=None):
        captured["user_agent"] = request.headers.get("User-agent")
        return _FakeHttpResponse()

    monkeypatch.setattr(fetch_utils._opener, "open", _fake_open)
    fetch_fn = with_user_agent("MyCustomBot/1.0")
    result = fetch_fn("https://example.com")
    assert result.ok is True
    assert captured["user_agent"] == "MyCustomBot/1.0"
