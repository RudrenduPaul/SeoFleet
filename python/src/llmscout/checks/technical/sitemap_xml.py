"""Ported from src/checks/technical/sitemap-xml.ts."""
from __future__ import annotations

import re

from ...fetch_utils import FetchedResource
from ...types import Check, CheckContext, CheckResult

_ID = "sitemap-xml"
_NAME = "sitemap.xml"
_CATEGORY = "technical"
_URLSET_RE = re.compile(r"<urlset[\s>]", re.IGNORECASE)
_SITEMAPINDEX_RE = re.compile(r"<sitemapindex[\s>]", re.IGNORECASE)


def _looks_like_sitemap_xml(body: str) -> bool:
    return bool(_URLSET_RE.search(body) or _SITEMAPINDEX_RE.search(body))


def _run(ctx: CheckContext) -> CheckResult:
    # The default /sitemap.xml fetch, plus any additional candidates
    # discovered via robots.txt `Sitemap:` directives (e.g. WordPress/
    # RankMath's /sitemap_index.xml). A site is only WARNed for "no
    # sitemap" once every candidate has failed.
    candidates: list[FetchedResource] = [ctx.resources.sitemap_xml, *ctx.resources.additional_sitemaps]

    valid = next((c for c in candidates if c.ok and _looks_like_sitemap_xml(c.body or "")), None)
    if valid is not None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "PASS",
            f"A sitemap is reachable at {valid.url} and appears to be valid sitemap XML.",
        )

    reachable_but_invalid = next((c for c in candidates if c.ok), None)
    if reachable_but_invalid is not None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            f"A sitemap is reachable at {reachable_but_invalid.url} but does not look like valid sitemap XML "
            "(missing <urlset> or <sitemapindex>).",
            "Ensure your sitemap follows the sitemap protocol (a <urlset> or <sitemapindex> root element).",
        )

    # Absence is a WARN, not a FAIL: a site can be fully functional and
    # well-indexed without a literal /sitemap.xml (e.g. it may reference a
    # differently-named sitemap from robots.txt), so this is a missed
    # optimization rather than a defect -- but only once every discovered
    # candidate (default plus robots.txt-named) has failed.
    attempted = ", ".join(c.url for c in candidates)
    return CheckResult(
        _ID, _NAME, _CATEGORY, "WARN",
        f"No sitemap was reachable (tried: {attempted}).",
        "Add a sitemap.xml at your site root, or point to one with a Sitemap: directive in robots.txt, "
        "to help search engines discover pages.",
    )


sitemap_xml_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
