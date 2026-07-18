"""Ported from src/checks/technical/open-graph.ts."""
from __future__ import annotations

from typing import List

from ...html_util import get_meta_property
from ...types import Check, CheckContext, CheckResult

_ID = "open-graph"
_NAME = "Open Graph tags"
_CATEGORY = "technical"

REQUIRED_PROPERTIES = ["og:title", "og:description", "og:image", "og:url"]


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so Open Graph tags could not be checked.",
            "Confirm siteUrl in seofleet.json is correct and reachable.",
        )

    missing: List[str] = []
    for property_ in REQUIRED_PROPERTIES:
        content = get_meta_property(ctx.root, property_)
        if not content:
            missing.append(property_)

    # Missing entirely is a WARN, not a FAIL: the page still works without
    # Open Graph tags, it just renders a plain/unstyled link preview when
    # shared -- a missed optimization rather than a broken page.
    if len(missing) == len(REQUIRED_PROPERTIES):
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "No Open Graph tags found.",
            f"Add Open Graph meta tags ({', '.join(REQUIRED_PROPERTIES)}) so shared links render rich previews on social platforms.",
        )

    if missing:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"Missing Open Graph tag(s): {', '.join(missing)}.",
            f"Add the missing Open Graph meta tag(s): {', '.join(missing)}.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"All required Open Graph tags ({', '.join(REQUIRED_PROPERTIES)}) are present.",
    )


open_graph_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
