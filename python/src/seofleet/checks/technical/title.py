"""Ported from src/checks/technical/title.ts."""
from __future__ import annotations

from ...types import Check, CheckContext, CheckResult

MIN_LENGTH = 10
MAX_LENGTH = 60

_ID = "title"
_NAME = "Title tag"
_CATEGORY = "technical"


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so the <title> tag could not be checked.",
            "Confirm siteUrl in seofleet.json is correct and reachable.",
        )

    title_el = ctx.root.find_first(("title",))
    title = title_el.text().strip() if title_el is not None else ""

    if not title:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "No <title> tag found (or it is empty).",
            f"Add a <title> tag in <head> that is {MIN_LENGTH}-{MAX_LENGTH} characters and describes the page.",
        )

    if len(title) < MIN_LENGTH:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f'Title is only {len(title)} characters ("{title}"); it may be too short to describe the page.',
            f"Expand the title to {MIN_LENGTH}-{MAX_LENGTH} characters.",
        )

    if len(title) > MAX_LENGTH:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"Title is {len(title)} characters; search engines typically truncate titles beyond ~{MAX_LENGTH} characters.",
            f"Shorten the title to {MIN_LENGTH}-{MAX_LENGTH} characters, front-loading the important keywords.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f'Title "{title}" is {len(title)} characters, within the recommended {MIN_LENGTH}-{MAX_LENGTH} range.',
    )


title_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
