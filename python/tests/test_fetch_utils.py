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
