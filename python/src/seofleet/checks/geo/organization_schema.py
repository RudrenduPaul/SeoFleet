"""Ported from src/checks/geo/organization-schema.ts."""
from __future__ import annotations

import json
from typing import Any, Dict, Optional

from ...html_util import get_scripts_by_type
from ...types import Check, CheckContext, CheckResult

_ID = "organization-schema"
_NAME = "Organization schema"
_CATEGORY = "geo"

ENTITY_TYPES = ["Organization", "Corporation", "LocalBusiness", "Person"]


def _has_entity_type(type_value: Any) -> bool:
    if isinstance(type_value, str):
        return type_value in ENTITY_TYPES
    if isinstance(type_value, list):
        return any(isinstance(t, str) and t in ENTITY_TYPES for t in type_value)
    return False


def _find_entity_node(value: Any) -> Optional[Dict[str, Any]]:
    if isinstance(value, list):
        for item in value:
            found = _find_entity_node(item)
            if found is not None:
                return found
        return None
    if isinstance(value, dict):
        if _has_entity_type(value.get("@type")):
            return value
        if "@graph" in value:
            return _find_entity_node(value["@graph"])
    return None


def _has_non_empty_same_as(node: Dict[str, Any]) -> bool:
    same_as = node.get("sameAs")
    if isinstance(same_as, list):
        return len(same_as) > 0
    return isinstance(same_as, str) and same_as.strip() != ""


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so Organization schema could not be checked.",
            "Confirm siteUrl in seofleet.json is correct and reachable.",
        )

    entity_node: Optional[Dict[str, Any]] = None
    for script in get_scripts_by_type(ctx.root, "application/ld+json"):
        if entity_node is not None:
            break
        try:
            parsed = json.loads(script.text())
            entity_node = _find_entity_node(parsed)
        except (json.JSONDecodeError, ValueError):
            pass  # invalid JSON-LD is reported by the structured-data check; ignore here

    # Organization/Person schema only applies to entities that actually
    # want a Knowledge Panel presence, so its absence is informational,
    # never a failure.
    if entity_node is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"No {'/'.join(ENTITY_TYPES)} structured data found.",
            "Add Organization (or Person) JSON-LD with a sameAs array of your official social/profile URLs "
            "to strengthen Knowledge Panel signals.",
        )

    if not _has_non_empty_same_as(entity_node):
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "Organization/Person schema found, but it has no sameAs property.",
            "Add a sameAs array listing this entity's official social profiles and other authoritative URLs.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        "Organization/Person schema found with a sameAs property linking authoritative profiles.",
    )


organization_schema_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
