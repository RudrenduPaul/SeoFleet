"""Ported from src/checks/geo/content-extraction.ts."""
from __future__ import annotations

from ...types import Check, CheckContext, CheckResult

_ID = "content-extraction"
_NAME = "Content extraction friendliness"
_CATEGORY = "geo"
_UNSTRUCTURED_BLOCK_THRESHOLD = 800
_PARAGRAPH_MIN_LENGTH = 30
_STRUCTURE_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li")
_HEADING_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6")


def _run(ctx: CheckContext) -> CheckResult:
    """
    A heuristic, not a precise measurement: it checks whether the page has
    heading/paragraph structure a generative engine can chunk, versus a
    large amount of text crammed into a single element with no internal
    structure. It cannot judge semantic quality, and it cannot see content
    that only appears after client-side JavaScript runs -- this tool does
    not execute JS or use a headless browser by design, so a page that is
    empty until hydrated will read as unstructured here even if it renders
    well structured in a real browser. Treat WARN as "worth a manual look",
    not as a definitive verdict.
    """
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so content extraction friendliness could not be checked.",
            "Confirm siteUrl in seofleet.json is correct and reachable.",
        )

    root = ctx.root
    main = root.find_first(("main",))
    scope = main if main is not None else (root.find_first(("body",)) or root)

    heading_count = len(scope.find_all(_HEADING_TAGS))
    paragraph_count = sum(
        1 for el in scope.find_all(("p", "li")) if len(el.text().strip()) > _PARAGRAPH_MIN_LENGTH
    )

    max_unstructured_length = 0
    for div in scope.find_all(("div",)):
        has_structure = len(div.find_all(_STRUCTURE_TAGS)) > 0
        if not has_structure:
            length = len(div.text().strip())
            if length > max_unstructured_length:
                max_unstructured_length = length

    if heading_count == 0 and paragraph_count == 0:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            "No headings or paragraph-level structure detected; a generative engine may struggle to extract distinct sections from this page.",
            "Break content into headings (<h2>, <h3>, ...) and paragraphs (<p>) rather than unstructured text.",
        )

    if max_unstructured_length > _UNSTRUCTURED_BLOCK_THRESHOLD:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"Found a {max_unstructured_length}-character block of text with no internal heading or paragraph structure.",
            "Break large unstructured blocks into headed sections and paragraphs.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"Found {heading_count} heading(s) and {paragraph_count} structured text block(s); "
        "content appears reasonably extractable. (Heuristic: cannot assess semantic quality or JS-rendered content.)",
    )


content_extraction_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
