"""Ported from src/checks/technical/robots-txt.ts."""
from __future__ import annotations

import re

from ...types import Check, CheckContext, CheckResult

_ID = "robots-txt"
_NAME = "robots.txt"
_CATEGORY = "technical"
_USER_AGENT_RE = re.compile(r"user-agent\s*:", re.IGNORECASE)


def _run(ctx: CheckContext) -> CheckResult:
    robots = ctx.resources.robots_txt

    if not robots.ok:
        detail = f" (HTTP {robots.status})" if robots.status else (f" ({robots.error})" if robots.error else "")
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            f"robots.txt was not reachable at {robots.url}{detail}.",
            "Add a robots.txt file at your site root, even a permissive one, so crawlers and agents have explicit directives.",
        )

    body = robots.body or ""
    if not _USER_AGENT_RE.search(body):
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "robots.txt is reachable but contains no User-agent directive; it may not be a valid robots.txt file.",
            "Ensure robots.txt contains at least one User-agent block.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"robots.txt is reachable at {robots.url} and contains User-agent directives.",
    )


robots_txt_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
