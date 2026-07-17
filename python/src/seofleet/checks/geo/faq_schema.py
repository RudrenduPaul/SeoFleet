"""Ported from src/checks/geo/faq-schema.ts."""
from __future__ import annotations

import json
from typing import Any

from ...html_util import get_scripts_by_type
from ...types import Check, CheckContext, CheckResult

_ID = "faq-schema"
_NAME = "FAQ schema"
_CATEGORY = "geo"


def _contains_faq_type(value: Any) -> bool:
    if isinstance(value, list):
        return any(_contains_faq_type(item) for item in value)
    if isinstance(value, dict):
        type_value = value.get("@type")
        if type_value == "FAQPage" or (isinstance(type_value, list) and "FAQPage" in type_value):
            return True
        if "@graph" in value:
            return _contains_faq_type(value["@graph"])
    return False


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so FAQ schema could not be checked.",
            "Confirm siteUrl in seofleet.json is correct and reachable.",
        )

    found = False
    for script in get_scripts_by_type(ctx.root, "application/ld+json"):
        if found:
            break
        try:
            parsed = json.loads(script.text())
            if _contains_faq_type(parsed):
                found = True
        except (json.JSONDecodeError, ValueError):
            pass  # invalid JSON-LD is reported by the structured-data check; ignore here

    # FAQ schema only applies to pages that actually have FAQ content, so
    # its absence is informational, never a failure.
    if not found:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "No FAQPage structured data found.",
            "If this page has an FAQ section, mark it up with FAQPage JSON-LD so generative engines can surface individual answers.",
        )

    return CheckResult(_ID, _NAME, _CATEGORY, "PASS", "FAQPage structured data found.")


faq_schema_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
