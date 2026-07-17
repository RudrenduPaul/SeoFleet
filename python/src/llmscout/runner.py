"""Ported from src/runner.ts."""
from __future__ import annotations

from typing import List

from .types import Check, CheckContext, CheckResult


def run_checks(checks: List[Check], ctx: CheckContext) -> List[CheckResult]:
    """
    Runs a list of checks against a single CheckContext, in order, and
    always returns one CheckResult per check -- a check raising is itself
    turned into a FAIL result rather than aborting the whole run, so one
    buggy or unexpectedly-erroring check never hides the other 11.
    """
    results: List[CheckResult] = []
    for check in checks:
        try:
            results.append(check.run(ctx))
        except Exception as err:  # noqa: BLE001 - deliberate catch-all, mirrors runner.ts
            results.append(
                CheckResult(
                    id=check.id,
                    name=check.name,
                    category=check.category,
                    status="FAIL",
                    message=f"Check errored: {err}",
                    fix="This is likely a bug in LLMScout itself -- please file an issue with the site you ran against.",
                )
            )
    return results


def has_failure(results: List[CheckResult]) -> bool:
    return any(r.status == "FAIL" for r in results)
