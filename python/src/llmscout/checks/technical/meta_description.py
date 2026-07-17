"""Ported from src/checks/technical/meta-description.ts."""
from __future__ import annotations

from ...html_util import get_meta_content
from ...types import Check, CheckContext, CheckResult

MIN_LENGTH = 50
MAX_LENGTH = 160

_ID = "meta-description"
_NAME = "Meta description"
_CATEGORY = "technical"


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so the meta description could not be checked.",
            "Confirm siteUrl in LLMScout.json is correct and reachable.",
        )

    content = (get_meta_content(ctx.root, "description") or "").strip()

    # Missing entirely is a WARN, not a FAIL: search engines will fall back
    # to auto-generating a snippet, so this is a missed optimization rather
    # than a broken page.
    if not content:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "No meta description found.",
            f'Add <meta name="description" content="..."> with {MIN_LENGTH}-{MAX_LENGTH} characters summarizing the page.',
        )

    if len(content) < MIN_LENGTH or len(content) > MAX_LENGTH:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"Meta description is {len(content)} characters; recommended range is {MIN_LENGTH}-{MAX_LENGTH}.",
            f"Rewrite the description to fall within {MIN_LENGTH}-{MAX_LENGTH} characters.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"Meta description is {len(content)} characters, within the recommended range.",
    )


meta_description_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
