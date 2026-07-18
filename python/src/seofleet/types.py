"""Ported from src/types.ts."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

from .fetch_utils import FetchedResource
from .html_util import Element

CheckStatus = str  # "PASS" | "FAIL" | "WARN"
CheckCategory = str  # "technical" | "geo"


@dataclass
class CheckResult:
    id: str
    name: str
    category: CheckCategory
    status: CheckStatus
    message: str
    fix: Optional[str] = None

    def to_dict(self) -> Dict[str, object]:
        d: Dict[str, object] = {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "status": self.status,
            "message": self.message,
        }
        if self.fix is not None:
            d["fix"] = self.fix
        return d


@dataclass
class SiteResources:
    """The resources every check is fetched against, gathered once per site
    and shared across the whole check suite so a run of 12 checks makes at
    most one request per distinct resource, not one per check."""

    site_url: str
    homepage: FetchedResource
    robots_txt: FetchedResource
    sitemap_xml: FetchedResource
    llms_txt: FetchedResource
    # Extra sitemap URLs discovered via `Sitemap:` directive lines in
    # robots.txt (e.g. WordPress/RankMath's /sitemap_index.xml), fetched
    # alongside the conventional /sitemap.xml. Empty when robots.txt named
    # no sitemap, or named only the conventional one.
    additional_sitemaps: List[FetchedResource] = field(default_factory=list)


@dataclass
class CheckContext:
    resources: SiteResources
    # Parsed homepage DOM root, or None if the homepage fetch failed.
    root: Optional[Element]


@dataclass
class Check:
    """The one contract every concrete check implements. This is the seam
    between "a check" and "the runner" -- adding check #13 means writing one
    new module exposing a `Check` with this shape and registering it in
    seofleet/checks/__init__.py, nothing else changes."""

    id: str
    name: str
    category: CheckCategory
    run: Callable[[CheckContext], CheckResult]
