"""Ported from src/checks/technical/image-weight.ts."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import List, Optional
from urllib.parse import urljoin, urlparse

from ...types import Check, CheckContext, CheckResult

_ID = "image-weight"
_NAME = "Image weight"
_CATEGORY = "technical"

_WARN_BYTES = 200 * 1024  # 200 KB per image
_FAIL_BYTES = 500 * 1024  # 500 KB per image

# A page with dozens of <img> tags shouldn't fire dozens of simultaneous
# HEAD requests at the target server -- capped concurrency, same spirit as
# the parallel-but-bounded fetches in site_resources.py.
_CONCURRENCY = 5


@dataclass
class _MeasuredImage:
    url: str
    bytes: int


def _format_kb(num_bytes: int) -> str:
    return f"{num_bytes / 1024:.1f} KB"


def _collect_image_urls(ctx: CheckContext) -> List[str]:
    """Resolves every distinct <img src> on the page against the site URL,
    dropping unparseable and non-http(s) srcs (e.g. `data:` URIs) -- those
    aren't a network-weight concern this check can measure."""
    root = ctx.root
    assert root is not None
    srcs = {img.attr("src") for img in root.find_all(("img",)) if img.attr("src")}

    urls: List[str] = []
    for src in srcs:
        resolved = urljoin(ctx.resources.site_url, src)
        parsed = urlparse(resolved)
        if parsed.scheme in ("http", "https"):
            urls.append(resolved)
    return urls


def _measure(ctx: CheckContext, url: str) -> Optional[_MeasuredImage]:
    res = ctx.fetch_fn(url, method="HEAD")
    if not res.ok or res.content_length is None:
        return None
    return _MeasuredImage(url=url, bytes=res.content_length)


def _run(ctx: CheckContext) -> CheckResult:
    if ctx.root is None:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            "Homepage could not be fetched, so image weight could not be checked.",
            "Confirm siteUrl in seofleet.json is correct and reachable.",
        )

    urls = _collect_image_urls(ctx)
    if not urls:
        return CheckResult(_ID, _NAME, _CATEGORY, "PASS", "No <img> tags with an http(s) src to measure.")

    with ThreadPoolExecutor(max_workers=min(_CONCURRENCY, len(urls))) as pool:
        outcomes = list(pool.map(lambda u: _measure(ctx, u), urls))

    measured = [m for m in outcomes if m is not None]
    unmeasured = len(urls) - len(measured)

    if not measured:
        return CheckResult(
            _ID, _NAME, _CATEGORY, "PASS",
            f"Could not determine file size for any of {len(urls)} image(s) (no reachable Content-Length); nothing to flag.",
        )

    total_bytes = sum(m.bytes for m in measured)
    failing = [m for m in measured if m.bytes > _FAIL_BYTES]
    warning = [m for m in measured if _WARN_BYTES < m.bytes <= _FAIL_BYTES]

    unmeasured_note = f" ({unmeasured} image(s) could not be measured and were excluded)" if unmeasured > 0 else ""
    total_note = f"Total measured page image weight: {_format_kb(total_bytes)} across {len(measured)} image(s){unmeasured_note}."

    if failing:
        worst = max(failing, key=lambda m: m.bytes)
        return CheckResult(
            _ID, _NAME, _CATEGORY, "FAIL",
            f"{len(failing)} image(s) exceed {_format_kb(_FAIL_BYTES)} (largest: {worst.url} at {_format_kb(worst.bytes)}). {total_note}",
            "Compress or resize oversized images (or serve a modern format like WebP/AVIF) so no single image exceeds 500 KB.",
        )

    if warning:
        worst = max(warning, key=lambda m: m.bytes)
        return CheckResult(
            _ID, _NAME, _CATEGORY, "WARN",
            f"{len(warning)} image(s) exceed {_format_kb(_WARN_BYTES)} (largest: {worst.url} at {_format_kb(worst.bytes)}). {total_note}",
            "Consider compressing or resizing these images to keep individual image weight under 200 KB.",
        )

    return CheckResult(
        _ID, _NAME, _CATEGORY, "PASS",
        f"All measured images are under {_format_kb(_WARN_BYTES)}. {total_note}",
    )


image_weight_check = Check(id=_ID, name=_NAME, category=_CATEGORY, run=_run)
