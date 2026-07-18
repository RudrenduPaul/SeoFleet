"""Ported from src/checks/geo/markdown-negotiation.ts."""
from __future__ import annotations

from ...types import Check, CheckContext, CheckResult

_ID = "markdown-negotiation"
_NAME = "Markdown content negotiation"
_CATEGORY = "geo"


def _run(ctx: CheckContext) -> CheckResult:
    url = ctx.resources.site_url
    res = ctx.fetch_fn(url, headers={"Accept": "text/markdown"})
    content_type = (res.content_type or "").lower()

    # Markdown content negotiation (responding to "Accept: text/markdown"
    # with an actual text/markdown body) is an emerging, forward-looking
    # convention that almost no site supports yet -- its absence is
    # informational only and never fails the run, same spirit as
    # llms_txt.py.
    if not res.ok or "text/markdown" not in content_type:
        message = (
            f'Requesting {url} with "Accept: text/markdown" returned Content-Type '
            f'"{res.content_type or "unknown"}" instead of text/markdown.'
            if res.ok
            else f'Could not verify Markdown content negotiation at {url} (the request failed).'
        )
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN", message,
            'Optional: serve a text/markdown representation of pages when the client sends '
            '"Accept: text/markdown" so LLM-based agents can fetch clean Markdown directly instead of parsing HTML.',
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f'{url} returns Content-Type "{res.content_type}" when requested with "Accept: text/markdown".',
    )


markdown_negotiation_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
