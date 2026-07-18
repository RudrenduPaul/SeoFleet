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
from typing import Callable, Dict, List, Optional
from urllib.parse import urljoin, urlparse

from .errors import SeoFleetError

MAX_REDIRECTS = 5
TIMEOUT_SECONDS = 10.0
MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MiB
_READ_CHUNK_BYTES = 64 * 1024

# Sent on every outbound fetch unless overridden via `safe_fetch`'s
# `user_agent` argument (or the CLI's `--user-agent` flag, which routes
# through `with_user_agent`). The previous default -- a static, bot-style
# UA naming this tool -- gets rejected outright by some SSR frameworks/CDNs
# that only serve real browsers; a Chrome UA is the safest default for a
# tool whose whole job is fetching arbitrary sites. Kept identical to the
# npm CLI's DEFAULT_USER_AGENT (src/fetch-utils.ts) so both CLIs present
# the same default.
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


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


def _parse_content_length(value: Optional[str]) -> Optional[int]:
    """Parses a Content-Length header value into a non-negative byte count,
    or None if the header is absent, non-numeric, or negative."""
    if not value:
        return None
    try:
        n = int(value)
    except ValueError:
        return None
    return n if n >= 0 else None


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
            raise SeoFleetError(f"Response body exceeded {max_bytes}-byte limit", 2)
        chunks.append(chunk)
    return b"".join(chunks)


@dataclass
class Hop:
    """One redirect hop safe_fetch followed on the way to a resource's
    final url/status."""

    url: str
    status: int


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
    # The response's Content-Length header, in bytes, when present and a
    # valid non-negative integer.
    content_length: Optional[int] = None
    # The response's raw Content-Type header (e.g. "text/html;
    # charset=utf-8"), when present. Exposed so a check that negotiates on
    # content (e.g. markdown_negotiation.py, which sends
    # `Accept: text/markdown` and needs to see what representation actually
    # came back) doesn't need its own fetch layer -- the same additive
    # shape as content_length.
    content_type: Optional[str] = None
    # The response's raw Link header (RFC 8288), when present, e.g.
    # `<https://example.com/feed>; rel="alternate"`. Exposed verbatim,
    # unparsed -- link_header.py owns interpreting it.
    link_header: Optional[str] = None
    # Every redirect hop safe_fetch followed to reach the final url/status
    # above, in the order visited. None when the resource resolved with
    # zero redirects, or the request failed before any hop was recorded.
    # This is data safe_fetch already computes for its own control flow
    # and previously discarded once each hop's status had been used to
    # decide whether to keep following the chain.
    hops: Optional[List[Hop]] = None


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
    if _is_blocked_host(parsed.hostname or ""):
        raise SeoFleetError(
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


def safe_fetch(
    raw_url: str,
    method: str = "GET",
    user_agent: str = DEFAULT_USER_AGENT,
    headers: Optional[Dict[str, str]] = None,
) -> FetchedResource:
    try:
        current = assert_http_url(raw_url)
    except SeoFleetError as err:
        return FetchedResource(url=raw_url, ok=False, error=str(err))

    # Every redirect hop actually followed, in visit order -- previously
    # discarded once its status had been used to decide whether to keep
    # following the chain; now threaded through onto the final result so
    # callers (e.g. the redirect-chain check) can see the whole path.
    hops: List[Hop] = []

    def hops_or_none() -> Optional[List[Hop]]:
        return list(hops) if hops else None

    # `headers` layers on top of the User-Agent default rather than
    # replacing it, so a caller like markdown_negotiation.py can send
    # `headers={"Accept": "text/markdown"}` without having to also restate
    # the User-Agent -- the same additive shape as init.headers on the
    # TypeScript CLI's safeFetch.
    request_headers = {"User-Agent": user_agent, **(headers or {})}

    for _hop in range(MAX_REDIRECTS + 1):
        request = urllib.request.Request(current, headers=request_headers, method=method)
        try:
            with _opener.open(request, timeout=TIMEOUT_SECONDS) as response:
                status = response.status
                content_length = _parse_content_length(response.headers.get("Content-Length"))
                content_type = response.headers.get("Content-Type")
                link_header = response.headers.get("Link")
                try:
                    body = _read_capped(response, MAX_BODY_BYTES).decode("utf-8", errors="replace")
                except SeoFleetError as err:
                    return FetchedResource(url=current, ok=False, status=status, error=str(err), hops=hops_or_none())
                return FetchedResource(
                    url=current,
                    ok=True,
                    status=status,
                    body=body,
                    content_length=content_length,
                    content_type=content_type,
                    link_header=link_header,
                    hops=hops_or_none(),
                )
        except urllib.error.HTTPError as err:
            status = err.code
            if 300 <= status < 400:
                location = err.headers.get("Location") if err.headers else None
                if not location:
                    body = _read_capped(err, MAX_BODY_BYTES).decode("utf-8", errors="replace")
                    return FetchedResource(url=current, ok=False, status=status, body=body, hops=hops_or_none())
                next_url = urljoin(current, location)
                next_parsed = urlparse(next_url)
                if next_parsed.scheme not in ("http", "https"):
                    return FetchedResource(
                        url=current,
                        ok=False,
                        status=status,
                        error=f'Refused to follow redirect to non-http(s) scheme "{next_parsed.scheme}:"',
                        hops=hops_or_none(),
                    )
                if _is_blocked_host(next_parsed.hostname or ""):
                    return FetchedResource(
                        url=current,
                        ok=False,
                        status=status,
                        error="Refused to follow redirect to a loopback, private, or link-local address",
                        hops=hops_or_none(),
                    )
                hops.append(Hop(url=current, status=status))
                current = next_url
                continue
            content_length = _parse_content_length(err.headers.get("Content-Length") if err.headers else None)
            content_type = err.headers.get("Content-Type") if err.headers else None
            link_header = err.headers.get("Link") if err.headers else None
            try:
                body_bytes = _read_capped(err, MAX_BODY_BYTES)
            except SeoFleetError as cap_err:
                return FetchedResource(url=current, ok=False, status=status, error=str(cap_err), hops=hops_or_none())
            body = body_bytes.decode("utf-8", errors="replace") if body_bytes else ""
            return FetchedResource(
                url=current,
                ok=False,
                status=status,
                body=body,
                content_length=content_length,
                content_type=content_type,
                link_header=link_header,
                hops=hops_or_none(),
            )
        except (urllib.error.URLError, socket.timeout, OSError) as err:
            reason = getattr(err, "reason", None)
            return FetchedResource(
                url=current, ok=False, error=str(reason) if reason else str(err), hops=hops_or_none()
            )

    return FetchedResource(url=current, ok=False, error=f"Too many redirects (> {MAX_REDIRECTS})", hops=hops_or_none())


def with_user_agent(user_agent: str) -> Callable[..., FetchedResource]:
    """
    Builds a fetch callable -- the shape `FetchFn` (see site_resources.py)
    expects -- that sends `user_agent` on every request instead of
    DEFAULT_USER_AGENT. This is how the CLI's `--user-agent` override flag
    reaches safe_fetch without widening the FetchFn signature every caller
    (including tests' fetch stubs) already depends on. Forwards **kwargs
    (e.g. `method="HEAD"`, used by image_weight's per-image requests) through
    to safe_fetch so a check that needs its own additional requests keeps
    working when the CLI's --user-agent override is active.
    """

    def _fetch(raw_url: str, **kwargs: object) -> FetchedResource:
        return safe_fetch(raw_url, user_agent=user_agent, **kwargs)

    return _fetch
