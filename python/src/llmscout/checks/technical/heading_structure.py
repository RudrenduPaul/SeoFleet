"""Ported from src/checks/technical/heading-structure.ts."""
from __future__ import annotations

from ...types import Check, CheckContext, CheckResult

_ID = "heading-structure"
_NAME = "Heading structure"
_CATEGORY = "technical"
_HEADING_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6")


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so heading structure could not be checked.",
            "Confirm siteUrl in LLMScout.json is correct and reachable.",
        )

    root = ctx.root
    h1_count = len(root.find_all(("h1",)))

    if h1_count == 0:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "No <h1> found on the page.",
            "Add exactly one <h1> that describes the page's main topic.",
        )

    if h1_count > 1:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"Found {h1_count} <h1> tags; search engines and generative engines expect exactly one per page.",
            "Keep a single <h1> and demote the rest to <h2> or lower.",
        )

    levels = [int(el.tag[1:]) for el in root.find_all(_HEADING_TAGS)]

    for i in range(1, len(levels)):
        prev, curr = levels[i - 1], levels[i]
        if curr - prev > 1:
            return CheckResult(
                _ID, _NAME, _CATEGORY, "WARN",
                f"Heading hierarchy skips a level (h{prev} is directly followed by h{curr}).",
                "Avoid skipping heading levels -- e.g. follow an <h1> with an <h2>, not an <h3>.",
            )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        "Exactly one <h1> and no skipped heading levels detected.",
    )


heading_structure_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
