"""Ported from src/checks/geo/link-header.ts."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from ...types import Check, CheckContext, CheckResult

_ID = "link-header"
_NAME = "Link header (RFC 8288)"
_CATEGORY = "geo"


@dataclass
class ParsedLink:
    url: str
    rel: Optional[str] = None
    params: Dict[str, str] = field(default_factory=dict)


def _split_top_level(header: str) -> List[str]:
    """Splits a raw header value on top-level commas -- i.e. commas that
    are neither inside a `<...>` URI-reference nor inside a `"..."` quoted
    param value. RFC 8288 link-values themselves can contain commas in a
    quoted title param (`title="a, b"`), so a naive `split(",")` would
    misparse a multi-link header in that case."""
    parts: List[str] = []
    depth = 0
    in_quotes = False
    current = ""
    for ch in header:
        if ch == '"':
            in_quotes = not in_quotes
        if not in_quotes:
            if ch == "<":
                depth += 1
            if ch == ">":
                depth = max(0, depth - 1)
        if ch == "," and depth == 0 and not in_quotes:
            parts.append(current)
            current = ""
        else:
            current += ch
    if current.strip():
        parts.append(current)
    return parts


def parse_link_header(header: str) -> List[ParsedLink]:
    """Parses a raw RFC 8288 Link header value into one entry per
    link-value, e.g. `<https://example.com/feed>; rel="alternate"` becomes
    `ParsedLink(url="https://example.com/feed", rel="alternate", params={"rel": "alternate"})`.
    Entries that don't match the `<url>; params` shape are dropped rather
    than raising -- a malformed header is data for the check to report on,
    not a reason to crash the run."""
    links: List[ParsedLink] = []
    for raw_part in _split_top_level(header):
        part = raw_part.strip()
        if not part:
            continue
        if not (part.startswith("<") and ">" in part):
            continue
        end = part.index(">")
        url = part[1:end]
        params_raw = part[end + 1 :]

        params: Dict[str, str] = {}
        for raw_param in params_raw.split(";"):
            param_part = raw_param.strip()
            if not param_part:
                continue
            eq = param_part.find("=")
            if eq == -1:
                continue
            key = param_part[:eq].strip().lower()
            value = param_part[eq + 1 :].strip()
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            params[key] = value

        links.append(ParsedLink(url=url, rel=params.get("rel"), params=params))
    return links


def _run(ctx: CheckContext) -> CheckResult:
    header = ctx.resources.homepage.link_header

    # An RFC 8288 Link header is machine-readable service discovery
    # (alternate feeds, API entry points, rel="describedby" schemas, etc.)
    # that almost no site sends today -- its absence is informational only
    # and never fails the run, same spirit as llms_txt.py.
    if not header or not header.strip():
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "The homepage does not send a Link response header.",
            'Optional: add an RFC 8288 Link response header (e.g. <https://example.com/feed>; rel="alternate") '
            "to advertise machine-readable service-discovery endpoints to crawlers and AI agents.",
        )

    links = parse_link_header(header)
    if not links:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f'The homepage sends a Link header that could not be parsed as RFC 8288: "{header}".',
            'Optional: format the Link header per RFC 8288, e.g. <https://example.com/feed>; rel="alternate".',
        )

    summary = ", ".join(f'{link.url} (rel="{link.rel}")' if link.rel else link.url for link in links)
    plural = "y" if len(links) == 1 else "ies"
    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"The homepage sends {len(links)} Link header entr{plural}: {summary}.",
    )


link_header_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
