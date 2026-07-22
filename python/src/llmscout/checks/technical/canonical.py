"""Ported from src/checks/technical/canonical.ts."""
from __future__ import annotations

from urllib.parse import urljoin, urlparse

from ...html_util import get_link_href
from ...types import Check, CheckContext, CheckResult

_ID = "canonical"
_NAME = "Canonical tag"
_CATEGORY = "technical"


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so the canonical tag could not be checked.",
            "Confirm siteUrl in llmscout.json is correct and reachable.",
        )

    href = get_link_href(ctx.root, "canonical")

    if not href:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            'No <link rel="canonical"> tag found.',
            "Add a canonical link tag pointing at the preferred URL for this page.",
        )

    # A relative canonical is legal HTML; resolve it against the site URL
    # before validating so relative hrefs aren't penalized.
    resolved = urljoin(ctx.resources.site_url, href)
    parsed = urlparse(resolved)
    if not parsed.scheme or not parsed.netloc:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            f'Canonical href "{href}" is not a valid URL.',
            "Point the canonical tag at a valid absolute or root-relative URL.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f'Canonical tag points to "{href}".',
    )


canonical_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
