"""Ported from src/types.ts."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, Optional

from .fetch_utils import FetchedResource
from .html_util import Element

CheckStatus = str  # "PASS" | "FAIL" | "WARN"
CheckCategory = str  # "technical" | "geo"

# The fetch function every check that needs its own network access beyond
# the four shared site resources (currently just image_weight, for its
# per-image HEAD requests) is handed via CheckContext.fetch_fn -- the same
# fetch_fn a caller already injects into load_site/fetch_site_resources for
# testing, so one stub covers both the shared resources and any check's own
# additional fetches.
FetchFn = Callable[..., FetchedResource]


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


@dataclass
class CheckContext:
    resources: SiteResources
    # Parsed homepage DOM root, or None if the homepage fetch failed.
    root: Optional[Element]
    # See FetchFn -- the fetch function checks use for their own additional
    # requests (e.g. image_weight's per-image HEAD requests). Every
    # construction site passes this explicitly (usually safe_fetch, or a
    # test stub) so it's never silently unset.
    fetch_fn: FetchFn


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
