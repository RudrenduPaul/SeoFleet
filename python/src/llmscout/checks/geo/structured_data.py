"""Ported from src/checks/geo/structured-data.ts."""
from __future__ import annotations

import json

from ...html_util import get_scripts_by_type
from ...types import Check, CheckContext, CheckResult

_ID = "structured-data"
_NAME = "Structured data (JSON-LD)"
_CATEGORY = "geo"


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so structured data could not be checked.",
            "Confirm siteUrl in LLMScout.json is correct and reachable.",
        )

    scripts = get_scripts_by_type(ctx.root, "application/ld+json")

    if len(scripts) == 0:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "No JSON-LD structured data found.",
            "Add schema.org JSON-LD markup (e.g. Organization, WebSite, or Article) so generative engines can understand the page's entities.",
        )

    valid_count = 0
    invalid_count = 0
    for script in scripts:
        try:
            json.loads(script.text())
            valid_count += 1
        except (json.JSONDecodeError, ValueError):
            invalid_count += 1

    if invalid_count > 0:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            f"{invalid_count} of {len(scripts)} JSON-LD block(s) contain invalid JSON.",
            "Fix the malformed JSON-LD block(s) so they parse as valid JSON.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"Found {valid_count} valid JSON-LD block(s).",
    )


structured_data_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
