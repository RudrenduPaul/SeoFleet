"""Ported from test/fetch-utils.test.ts."""
from __future__ import annotations

import email.message
import io
import urllib.error

import pytest

from seofleet import fetch_utils
from seofleet.errors import SeoFleetError
from seofleet.fetch_utils import assert_http_url, safe_fetch


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


class _FakeResponse:
    """Stands in for the `with _opener.open(...) as response:` context
    manager -- just enough of urllib's response surface (status, headers,
    read) for safe_fetch to work with."""

    def __init__(self, status: int, body: bytes = b"", headers: "dict[str, str] | None" = None):
        self.status = status
        self._body = io.BytesIO(body)
        self.headers = email.message.Message()
        for key, value in (headers or {}).items():
            self.headers[key] = value

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self, n: int = -1) -> bytes:
        return self._body.read(n)


def _http_error(url: str, code: int, headers: "dict[str, str] | None" = None, body: bytes = b"") -> urllib.error.HTTPError:
    hdrs = email.message.Message()
    for key, value in (headers or {}).items():
        hdrs[key] = value
    return urllib.error.HTTPError(url, code, "error", hdrs, io.BytesIO(body))


class TestSafeFetch:
    def test_fetches_a_normal_200_response(self, monkeypatch):
        monkeypatch.setattr(fetch_utils._opener, "open", lambda *a, **k: _FakeResponse(200, b"hello"))
        result = safe_fetch("https://example.com")
        assert result.ok is True
        assert result.status == 200
        assert result.body == "hello"

    def test_exposes_content_length_when_present(self, monkeypatch):
        monkeypatch.setattr(
            fetch_utils._opener, "open", lambda *a, **k: _FakeResponse(200, b"hello", {"Content-Length": "5"})
        )
        result = safe_fetch("https://example.com")
        assert result.content_length == 5

    def test_leaves_content_length_none_when_header_absent(self, monkeypatch):
        monkeypatch.setattr(fetch_utils._opener, "open", lambda *a, **k: _FakeResponse(200, b"hello"))
        result = safe_fetch("https://example.com")
        assert result.content_length is None

    def test_has_no_hops_for_a_direct_non_redirected_fetch(self, monkeypatch):
        monkeypatch.setattr(fetch_utils._opener, "open", lambda *a, **k: _FakeResponse(200, b"hello"))
        result = safe_fetch("https://example.com")
        assert result.hops is None

    def test_records_redirect_hops_in_order_on_the_final_result(self, monkeypatch):
        responses = [
            _http_error("https://example.com/a", 301, {"Location": "https://example.com/b"}),
            _http_error("https://example.com/b", 302, {"Location": "https://example.com/c"}),
        ]

        def fake_open(request, *a, **k):
            if responses:
                raise responses.pop(0)
            return _FakeResponse(200, b"final")

        monkeypatch.setattr(fetch_utils._opener, "open", fake_open)
        result = safe_fetch("https://example.com/a")
        assert result.ok is True
        assert result.hops == [
            fetch_utils.Hop(url="https://example.com/a", status=301),
            fetch_utils.Hop(url="https://example.com/b", status=302),
        ]

    def test_records_hops_seen_so_far_even_when_the_chain_ultimately_fails(self, monkeypatch):
        responses = [
            _http_error("https://example.com/a", 301, {"Location": "https://example.com/b"}),
            _http_error("https://example.com/b", 404, body=b"not found"),
        ]

        def fake_open(request, *a, **k):
            raise responses.pop(0)

        monkeypatch.setattr(fetch_utils._opener, "open", fake_open)
        result = safe_fetch("https://example.com/a")
        assert result.ok is False
        assert result.status == 404
        assert result.hops == [fetch_utils.Hop(url="https://example.com/a", status=301)]

    def test_passes_an_explicit_method_through_to_the_request(self, monkeypatch):
        seen_methods = []

        def fake_open(request, *a, **k):
            seen_methods.append(request.get_method())
            return _FakeResponse(200, b"", {"Content-Length": "1234"})

        monkeypatch.setattr(fetch_utils._opener, "open", fake_open)
        result = safe_fetch("https://example.com/image.png", method="HEAD")
        assert seen_methods == ["HEAD"]
        assert result.content_length == 1234
