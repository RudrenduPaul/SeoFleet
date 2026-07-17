"""
Ported from src/fetch-utils.ts.

A fetch wrapper that:
  - only ever dials http(s) (assert_http_url guards the entry point)
  - follows redirects manually, one hop at a time, and refuses to follow a
    redirect whose Location targets a non-http(s) scheme (e.g. file:// or
    ftp://) -- the SSRF-adjacent trick this guards against
  - bounds the number of hops so a redirect loop can't hang the process
  - never raises for network-level failure; failures come back as
    FetchedResource(ok=False, error=...) so callers can turn them into check
    results instead of crashing the whole run.

Uses only the standard library (urllib) rather than a third-party HTTP
dependency -- the same "no extra runtime toolchain" spirit as the original
TypeScript CLI's own zero-dependency design.
"""
from __future__ import annotations

import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin, urlparse

from .errors import SeoFleetError

MAX_REDIRECTS = 5
TIMEOUT_SECONDS = 10.0
USER_AGENT = "seofleet-cli (+https://github.com/RudrenduPaul/SeoFleet)"


@dataclass
class FetchedResource:
    """The result of fetching a single resource (a page, robots.txt,
    sitemap.xml, llms.txt). Never raises for ordinary network failure --
    callers treat an unreachable resource as data (a check result), not an
    exception."""

    url: str
    ok: bool
    status: Optional[int] = None
    body: Optional[str] = None
    error: Optional[str] = None


def assert_http_url(raw: str) -> str:
    """
    Parses a user-supplied string as a URL and rejects anything that isn't
    http(s). This is the only place a raw string is validated for network
    access -- every fetch in this codebase routes through here (or through
    safe_fetch, which calls this) so there is one guard to audit.
    """
    parsed = urlparse(raw)
    if not parsed.scheme or not parsed.netloc:
        raise SeoFleetError(f'Invalid URL: "{raw}"', 2)
    if parsed.scheme not in ("http", "https"):
        raise SeoFleetError(
            f'Unsupported URL scheme "{parsed.scheme}:" in "{raw}". Only http and https are allowed.',
            2,
        )
    return raw


class _NoAutoRedirect(urllib.request.HTTPRedirectHandler):
    """Disables urllib's automatic redirect-following so safe_fetch can
    inspect and validate each hop itself, one at a time."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: N802 (stdlib override)
        return None


_opener = urllib.request.build_opener(_NoAutoRedirect)


def safe_fetch(raw_url: str) -> FetchedResource:
    try:
        current = assert_http_url(raw_url)
    except SeoFleetError as err:
        return FetchedResource(url=raw_url, ok=False, error=str(err))

    for _hop in range(MAX_REDIRECTS + 1):
        request = urllib.request.Request(current, headers={"User-Agent": USER_AGENT})
        try:
            with _opener.open(request, timeout=TIMEOUT_SECONDS) as response:
                status = response.status
                body = response.read().decode("utf-8", errors="replace")
                return FetchedResource(url=current, ok=True, status=status, body=body)
        except urllib.error.HTTPError as err:
            status = err.code
            if 300 <= status < 400:
                location = err.headers.get("Location") if err.headers else None
                if not location:
                    body = err.read().decode("utf-8", errors="replace")
                    return FetchedResource(url=current, ok=False, status=status, body=body)
                next_url = urljoin(current, location)
                next_scheme = urlparse(next_url).scheme
                if next_scheme not in ("http", "https"):
                    return FetchedResource(
                        url=current,
                        ok=False,
                        status=status,
                        error=f'Refused to follow redirect to non-http(s) scheme "{next_scheme}:"',
                    )
                current = next_url
                continue
            body_bytes = err.read()
            body = body_bytes.decode("utf-8", errors="replace") if body_bytes else ""
            return FetchedResource(url=current, ok=False, status=status, body=body)
        except (urllib.error.URLError, socket.timeout, OSError) as err:
            reason = getattr(err, "reason", None)
            return FetchedResource(url=current, ok=False, error=str(reason) if reason else str(err))

    return FetchedResource(url=current, ok=False, error=f"Too many redirects (> {MAX_REDIRECTS})")
