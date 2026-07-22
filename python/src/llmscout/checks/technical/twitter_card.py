"""Ported from src/checks/technical/twitter-card.ts."""
from __future__ import annotations

from typing import List

from ...html_util import get_meta_content
from ...types import Check, CheckContext, CheckResult

_ID = "twitter-card"
_NAME = "Twitter/X Card tags"
_CATEGORY = "technical"

VALID_CARD_TYPES = ["summary", "summary_large_image", "app", "player"]
FALLBACK_FIELDS = ["twitter:title", "twitter:description", "twitter:image"]


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so Twitter/X Card tags could not be checked.",
            "Confirm siteUrl in llmscout.json is correct and reachable.",
        )

    card_type = get_meta_content(ctx.root, "twitter:card")

    # Missing entirely is a WARN, not a FAIL: X/Twitter falls back to a
    # generic link preview without a card tag, so this is a missed
    # optimization rather than a broken page.
    if not card_type:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "No twitter:card meta tag found.",
            'Add <meta name="twitter:card" content="summary_large_image"> (or another valid card type) '
            "so links render rich previews on X/Twitter.",
        )

    if card_type not in VALID_CARD_TYPES:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            f'twitter:card value "{card_type}" is not a recognized card type.',
            f"Set twitter:card to one of: {', '.join(VALID_CARD_TYPES)}.",
        )

    # X/Twitter falls back to the equivalent Open Graph tag for each of
    # these fields when the twitter:-prefixed one is absent, so this is
    # reported as a WARN rather than treated as fully broken.
    missing: List[str] = [name for name in FALLBACK_FIELDS if not get_meta_content(ctx.root, name)]

    if missing:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f'twitter:card is "{card_type}", but missing: {", ".join(missing)} '
            "(falls back to the equivalent Open Graph tag, if present).",
            f"Add the missing Twitter Card meta tag(s): {', '.join(missing)}.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f'twitter:card is "{card_type}" with title, description, and image all present.',
    )


twitter_card_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
