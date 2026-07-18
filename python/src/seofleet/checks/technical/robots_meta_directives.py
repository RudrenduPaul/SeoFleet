"""Ported from src/checks/technical/robots-meta-directives.ts."""
from __future__ import annotations

from ...html_util import get_meta_content
from ...types import Check, CheckContext, CheckResult

_ID = "robots-meta-directives"
_NAME = "Meta robots directives"
_CATEGORY = "technical"

ADVANCED_DIRECTIVES = ["max-snippet", "max-image-preview", "max-video-preview"]


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so meta robots directives could not be checked.",
            "Confirm siteUrl in seofleet.json is correct and reachable.",
        )

    content = (get_meta_content(ctx.root, "robots") or "").strip().lower()

    # Missing entirely is a WARN, not a FAIL: search engines fall back to
    # their own default snippet/preview limits, so this is a missed
    # optimization rather than a broken page.
    if not content:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "No meta robots directives found; default Google Search snippet/preview limits will apply.",
            'Add <meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1"> '
            "to control search snippet appearance.",
        )

    tokens = [t.strip() for t in content.split(",")]

    # An unintentional noindex is the one case worth failing loudly on --
    # it silently removes the page from search results entirely.
    if "noindex" in tokens:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            'Meta robots directive includes "noindex" -- this page will be excluded from search results.',
            'Remove "noindex" from the meta robots content attribute unless excluding this page is intentional.',
        )

    present = [d for d in ADVANCED_DIRECTIVES if any(t.startswith(d) for t in tokens)]
    missing = [d for d in ADVANCED_DIRECTIVES if d not in present]

    if not present:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f'Meta robots tag found ("{content}") but no advanced snippet/preview directives '
            f"({', '.join(ADVANCED_DIRECTIVES)}).",
            f"Add {', '.join(ADVANCED_DIRECTIVES)} directives to control search snippet and preview size.",
        )

    if missing:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"Meta robots tag has {', '.join(present)}, but is missing: {', '.join(missing)}.",
            f"Add the missing directive(s): {', '.join(missing)}.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"Meta robots tag includes all advanced snippet/preview directives ({', '.join(ADVANCED_DIRECTIVES)}).",
    )


robots_meta_directives_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
