"""Ported from test/fetch-utils.test.ts."""
from __future__ import annotations

import pytest

from seofleet.errors import SeoFleetError
from seofleet.fetch_utils import assert_http_url


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
