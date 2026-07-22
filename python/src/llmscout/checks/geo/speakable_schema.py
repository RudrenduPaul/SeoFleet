"""Ported from src/checks/geo/speakable-schema.ts."""
from __future__ import annotations

import json
from typing import Any

from ...html_util import get_scripts_by_type
from ...types import Check, CheckContext, CheckResult

_ID = "speakable-schema"
_NAME = "Speakable schema"
_CATEGORY = "geo"


def _contains_speakable(value: Any) -> bool:
    if isinstance(value, list):
        return any(_contains_speakable(item) for item in value)
    if isinstance(value, dict):
        type_value = value.get("@type")
        if type_value == "SpeakableSpecification" or (
            isinstance(type_value, list) and "SpeakableSpecification" in type_value
        ):
            return True
        # "speakable" is usually a property nested on a WebPage/Article node
        # rather than a standalone top-level type, so a truthy value there
        # also counts as present.
        if value.get("speakable"):
            return True
        if "@graph" in value:
            return _contains_speakable(value["@graph"])
    return False


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so Speakable schema could not be checked.",
            "Confirm siteUrl in llmscout.json is correct and reachable.",
        )

    found = False
    for script in get_scripts_by_type(ctx.root, "application/ld+json"):
        if found:
            break
        try:
            parsed = json.loads(script.text())
            if _contains_speakable(parsed):
                found = True
        except (json.JSONDecodeError, ValueError):
            pass  # invalid JSON-LD is reported by the structured-data check; ignore here

    # Speakable schema only applies to content genuinely suited for voice
    # assistants, so its absence is informational, never a failure.
    if not found:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "No Speakable structured data found.",
            'If this page has content suited for voice assistants, add a "speakable" SpeakableSpecification '
            "to its JSON-LD so voice search can surface it.",
        )

    return CheckResult(_ID, _NAME, _CATEGORY, "PASS", "Speakable structured data found.")


speakable_schema_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
