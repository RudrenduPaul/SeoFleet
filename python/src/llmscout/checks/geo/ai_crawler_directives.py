"""Ported from src/checks/geo/ai-crawler-directives.ts."""
from __future__ import annotations

from typing import Dict, List

from ...types import Check, CheckContext, CheckResult

_ID = "ai-crawler-directives"
_NAME = "AI crawler directives"
_CATEGORY = "geo"

# The AI crawlers checked for are reported on, never prescribed -- whether
# to allow or disallow any of them is a genuine site-owner choice this tool
# does not take a position on. Training crawlers (GPTBot, ClaudeBot,
# Google-Extended, Applebot-Extended) and search/retrieval crawlers
# (OAI-SearchBot, Claude-SearchBot, PerplexityBot) are separate,
# independently blockable user agents at OpenAI and Anthropic -- a real
# robots.txt distinction, not a cosmetic one: blocking a training bot has
# no effect on whether that same company's assistant can still retrieve
# and cite the page live via its search bot, and vice versa.
TRACKED_BOTS = [
    "GPTBot",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-SearchBot",
    "PerplexityBot",
    "Google-Extended",
    "Applebot-Extended",
]


def parse_ai_crawler_directives(robots_txt: str, bots: List[str] = TRACKED_BOTS) -> Dict[str, str]:
    """
    A deliberately simple robots.txt parser: it tracks the single most
    recent User-agent line and attributes the next Allow/Disallow lines to
    it. It does not handle grouped multi-agent blocks (several consecutive
    User-agent lines sharing one set of rules) -- a documented limitation,
    not a bug, for v0.1.
    """
    result: Dict[str, str] = {bot: "unspecified" for bot in bots}

    current_agent = None
    for raw_line in robots_txt.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue

        sep_index = line.find(":")
        if sep_index == -1:
            continue

        key = line[:sep_index].strip().lower()
        value = line[sep_index + 1 :].strip()

        if key == "user-agent":
            current_agent = value
            continue

        if key in ("disallow", "allow") and current_agent:
            matched_bot = next((bot for bot in bots if bot.lower() == current_agent.lower()), None)
            if matched_bot is None:
                continue
            if key == "disallow" and value == "":
                continue  # an empty Disallow means "allow everything"; leave unspecified rather than assert allow
            result[matched_bot] = "disallow" if key == "disallow" else "allow"

    return result


def _run(ctx: CheckContext) -> CheckResult:
    robots = ctx.resources.robots_txt

    if not robots.ok or robots.body is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "robots.txt is unreachable, so AI-crawler directives could not be determined.",
            "Add a reachable robots.txt if you want to state an explicit policy for AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended).",
        )

    directives = parse_ai_crawler_directives(robots.body)
    summary = ", ".join(f"{bot}: {directives[bot]}" for bot in TRACKED_BOTS)

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"AI crawler directives found in robots.txt -- {summary}. This is a report of what's configured, not a recommendation.",
    )


ai_crawler_directives_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
