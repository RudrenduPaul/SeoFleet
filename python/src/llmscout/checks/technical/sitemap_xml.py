"""Ported from src/checks/technical/sitemap-xml.ts."""
from __future__ import annotations

import re

from ...types import Check, CheckContext, CheckResult

_ID = "sitemap-xml"
_NAME = "sitemap.xml"
_CATEGORY = "technical"
_URLSET_RE = re.compile(r"<urlset[\s>]", re.IGNORECASE)
_SITEMAPINDEX_RE = re.compile(r"<sitemapindex[\s>]", re.IGNORECASE)


def _run(ctx: CheckContext) -> CheckResult:
    sitemap = ctx.resources.sitemap_xml

    # Absence is a WARN, not a FAIL: a site can be fully functional and
    # well-indexed without a literal /sitemap.xml (e.g. it may reference a
    # differently-named sitemap from robots.txt), so this is a missed
    # optimization rather than a defect.
    if not sitemap.ok:
        detail = f" (HTTP {sitemap.status})" if sitemap.status else ""
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"sitemap.xml was not reachable at {sitemap.url}{detail}.",
            "Add a sitemap.xml at your site root to help search engines discover pages.",
        )

    body = sitemap.body or ""
    if not _URLSET_RE.search(body) and not _SITEMAPINDEX_RE.search(body):
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "sitemap.xml is reachable but does not look like valid sitemap XML (missing <urlset> or <sitemapindex>).",
            "Ensure sitemap.xml follows the sitemap protocol (a <urlset> or <sitemapindex> root element).",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"sitemap.xml is reachable at {sitemap.url} and appears to be valid sitemap XML.",
    )


sitemap_xml_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
