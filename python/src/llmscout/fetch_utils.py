"""
Ported from src/fetch-utils.ts.

A fetch wrapper that:
  - only ever dials http(s) at a non-loopback/private/link-local host
    (assert_http_url guards the entry point; the same check re-runs on
    every redirect hop)
  - follows redirects manually, one hop at a time, and refuses to follow a
    redirect whose Location targets a non-http(s) scheme (e.g. file:// or
    ftp://) or a blocked host -- the SSRF-adjacent tricks this guards against
  - bounds the number of hops so a redirect loop can't hang the process
  - bounds the connection with a timeout (TIMEOUT_SECONDS) and the response
    body with a byte cap (MAX_BODY_BYTES), so a stalling or oversized
    response can't hang or exhaust memory on an unattended fleet scan
  - never raises for network-level failure; failures come back as
    FetchedResource(ok=False, error=...) so callers can turn them into check
    results instead of crashing the whole run.

Uses only the standard library (urllib) rather than a third-party HTTP
dependency -- the same "no extra runtime toolchain" spirit as the original
TypeScript CLI's own zero-dependency design.
"""
from __future__ import annotations

import ipaddress
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin, urlparse

from .errors import LLMScoutError

MAX_REDIRECTS = 5
TIMEOUT_SECONDS = 10.0
MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MiB
_READ_CHUNK_BYTES = 64 * 1024
USER_AGENT = "LLMScout-cli (+https://github.com/RudrenduPaul/LLMScout)"


def _is_blocked_host(hostname: str) -> bool:
    """
    True if `hostname` is an IP literal (or "localhost") in loopback,
    private, or link-local address space -- the obvious SSRF payloads
    (http://127.0.0.1, http://169.254.169.254/..., http://192.168.x.x).

    This does NOT resolve DNS names to see where they point: a public
    hostname that resolves to a private address at connect time (DNS
    rebinding) isn't caught here. Closing that fully would need a
    connect-time IP check, which is a larger change than this guard.
    """
    host = (hostname or "").lower()
    if host == "localhost":
        return True
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_unspecified


def _read_capped(response, max_bytes: int) -> bytes:
    """Reads a urllib response body up to max_bytes, raising instead of
    buffering an unbounded body -- a stalling or huge response can't OOM
    an unattended fleet scan."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = response.read(_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise LLMScoutError(f"Response body exceeded {max_bytes}-byte limit", 2)
        chunks.append(chunk)
    return b"".join(chunks)


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
        raise LLMScoutError(f'Invalid URL: "{raw}"', 2)
    if parsed.scheme not in ("http", "https"):
        raise LLMScoutError(
            f'Unsupported URL scheme "{parsed.scheme}:" in "{raw}". Only http and https are allowed.',
            2,
        )
    if _is_blocked_host(parsed.hostname or ""):
        raise LLMScoutError(
            f'Refused to fetch "{raw}": target host is a loopback, private, or link-local address.',
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
    except LLMScoutError as err:
        return FetchedResource(url=raw_url, ok=False, error=str(err))

    for _hop in range(MAX_REDIRECTS + 1):
        request = urllib.request.Request(current, headers={"User-Agent": USER_AGENT})
        try:
            with _opener.open(request, timeout=TIMEOUT_SECONDS) as response:
                status = response.status
                try:
                    body = _read_capped(response, MAX_BODY_BYTES).decode("utf-8", errors="replace")
                except LLMScoutError as err:
                    return FetchedResource(url=current, ok=False, status=status, error=str(err))
                return FetchedResource(url=current, ok=True, status=status, body=body)
        except urllib.error.HTTPError as err:
            status = err.code
            if 300 <= status < 400:
                location = err.headers.get("Location") if err.headers else None
                if not location:
                    body = _read_capped(err, MAX_BODY_BYTES).decode("utf-8", errors="replace")
                    return FetchedResource(url=current, ok=False, status=status, body=body)
                next_url = urljoin(current, location)
                next_parsed = urlparse(next_url)
                if next_parsed.scheme not in ("http", "https"):
                    return FetchedResource(
                        url=current,
                        ok=False,
                        status=status,
                        error=f'Refused to follow redirect to non-http(s) scheme "{next_parsed.scheme}:"',
                    )
                if _is_blocked_host(next_parsed.hostname or ""):
                    return FetchedResource(
                        url=current,
                        ok=False,
                        status=status,
                        error="Refused to follow redirect to a loopback, private, or link-local address",
                    )
                current = next_url
                continue
            try:
                body_bytes = _read_capped(err, MAX_BODY_BYTES)
            except LLMScoutError as cap_err:
                return FetchedResource(url=current, ok=False, status=status, error=str(cap_err))
            body = body_bytes.decode("utf-8", errors="replace") if body_bytes else ""
            return FetchedResource(url=current, ok=False, status=status, body=body)
        except (urllib.error.URLError, socket.timeout, OSError) as err:
            reason = getattr(err, "reason", None)
            return FetchedResource(url=current, ok=False, error=str(reason) if reason else str(err))

    return FetchedResource(url=current, ok=False, error=f"Too many redirects (> {MAX_REDIRECTS})")
