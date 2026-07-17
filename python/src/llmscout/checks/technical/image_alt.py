"""Ported from src/checks/technical/image-alt.ts."""
from __future__ import annotations

from ...types import Check, CheckContext, CheckResult

_ID = "image-alt"
_NAME = "Image alt coverage"
_CATEGORY = "technical"
_WARN_THRESHOLD = 0.8


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so image alt coverage could not be checked.",
            "Confirm siteUrl in LLMScout.json is correct and reachable.",
        )

    images = ctx.root.find_all(("img",))
    total = len(images)

    if total == 0:
        return CheckResult(_ID, _NAME, _CATEGORY, "PASS", "No <img> tags found on the page.")

    # An alt attribute that is present but empty (alt="") is a valid,
    # intentional way to mark a decorative image -- only a fully missing
    # attribute counts against coverage.
    missing = sum(1 for img in images if not img.has_attr("alt"))
    coverage = (total - missing) / total

    if missing == 0:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "PASS",
            f"All {total} <img> tags have an alt attribute.",
        )

    pct = round(coverage * 100)
    if coverage >= _WARN_THRESHOLD:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"{missing} of {total} <img> tags are missing an alt attribute ({pct}% coverage).",
            'Add descriptive alt text to every remaining image (or alt="" for purely decorative ones).',
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "FAIL",
        f"{missing} of {total} <img> tags are missing an alt attribute ({pct}% coverage).",
        'Add descriptive alt text to every image (or alt="" for purely decorative ones).',
    )


image_alt_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
