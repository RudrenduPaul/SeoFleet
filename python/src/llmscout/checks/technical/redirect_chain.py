"""Ported from src/checks/technical/redirect-chain.ts."""
from __future__ import annotations

from ...types import Check, CheckContext, CheckResult

_ID = "redirect-chain"
_NAME = "Redirect chain"
_CATEGORY = "technical"

# A single 301/302 straight to the canonical URL is normal and harmless;
# beyond that each extra hop costs crawl budget and latency.
_WARN_HOP_THRESHOLD = 2


def _run(ctx: CheckContext) -> CheckResult:
    hops = ctx.resources.homepage.hops

    if not hops:
        return CheckResult(_ID, _NAME, _CATEGORY, "PASS", "The homepage resolved with no redirects.")

    error_hops = [h for h in hops if 400 <= h.status < 600]
    if error_hops:
        bad = error_hops[0]
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            f"The homepage's redirect chain includes a hop that returned an error status: {bad.url} (HTTP {bad.status}).",
            "Fix or remove the broken hop so the redirect chain leads cleanly to the final page.",
        )

    chain = " -> ".join(f"{h.url} ({h.status})" for h in hops)
    final_url = ctx.resources.homepage.url

    if len(hops) > _WARN_HOP_THRESHOLD:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"The homepage resolves through {len(hops)} redirect hops before reaching its final URL: {chain} -> {final_url}.",
            "Point links and internal references directly at the final destination URL to collapse the chain to at most one hop.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"The homepage resolves through {len(hops)} redirect hop(s) before reaching its final URL: {chain} -> {final_url}.",
    )


redirect_chain_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
