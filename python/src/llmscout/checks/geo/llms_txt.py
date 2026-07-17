"""Ported from src/checks/geo/llms-txt.ts."""
from __future__ import annotations

from ...types import Check, CheckContext, CheckResult

_ID = "llms-txt"
_NAME = "llms.txt"
_CATEGORY = "geo"


def _run(ctx: CheckContext) -> CheckResult:
    llms_txt = ctx.resources.llms_txt

    # llms.txt is an emerging, not-yet-universal convention -- its absence
    # is informational only and never fails the run.
    if not llms_txt.ok or not (llms_txt.body or "").strip():
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"No llms.txt found at {llms_txt.url}.",
            "Optional: add an llms.txt at your site root summarizing the site for LLM-based agents (see llmstxt.org).",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"llms.txt is present at {llms_txt.url}.",
    )


llms_txt_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
