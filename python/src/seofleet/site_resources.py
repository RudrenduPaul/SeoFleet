"""
Ported from src/site-resources.ts.

Fetches the four resources the whole check suite is built on: the homepage
itself, plus the three well-known files a site may expose at its origin.
All four are fetched concurrently (a small thread pool, since these are
network-bound calls) and none of them raises -- an unreachable resource
simply comes back as `FetchedResource(ok=False)` for the individual checks
to interpret.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Callable, List, Optional
from urllib.parse import urljoin, urlparse

from .errors import SeoFleetError
from .fetch_utils import FetchedResource, assert_http_url, safe_fetch
from .html_util import parse_html
from .types import CheckContext, SiteResources

FetchFn = Callable[[str], FetchedResource]


def parse_sitemap_directives(robots_txt: str) -> List[str]:
    """
    Parses `Sitemap:` directive lines out of a robots.txt body. Per the
    robots.txt spec these directives are not scoped to any User-agent group
    and can appear anywhere in the file, one absolute URL per line -- this
    is how real search engines discover a sitemap that isn't published at
    the conventional /sitemap.xml path (e.g. WordPress/RankMath's
    /sitemap_index.xml).
    """
    urls: List[str] = []
    for raw_line in robots_txt.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue

        sep_index = line.find(":")
        if sep_index == -1:
            continue

        key = line[:sep_index].strip().lower()
        value = line[sep_index + 1 :].strip()
        if key == "sitemap" and value:
            urls.append(value)
    return urls


def fetch_site_resources(site_url: str, fetch_fn: Optional[FetchFn] = None) -> SiteResources:
    fetch = fetch_fn or safe_fetch
    parsed = urlparse(site_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    default_sitemap_url = f"{origin}/sitemap.xml"

    with ThreadPoolExecutor(max_workers=4) as pool:
        homepage_future = pool.submit(fetch, site_url)
        robots_future = pool.submit(fetch, f"{origin}/robots.txt")
        sitemap_future = pool.submit(fetch, default_sitemap_url)
        llms_future = pool.submit(fetch, f"{origin}/llms.txt")

        homepage = homepage_future.result()
        robots_txt = robots_future.result()
        sitemap_xml = sitemap_future.result()
        llms_txt = llms_future.result()

    additional_sitemap_urls: "dict[str, None]" = {}  # insertion-ordered dedup set
    if robots_txt.ok and robots_txt.body:
        for raw in parse_sitemap_directives(robots_txt.body):
            resolved = urljoin(origin, raw)
            if urlparse(resolved).scheme not in ("http", "https"):
                continue  # an unparseable/unusable Sitemap: value isn't a usable candidate
            if resolved == default_sitemap_url:
                continue  # already fetched above
            additional_sitemap_urls[resolved] = None

    additional_sitemaps: List[FetchedResource] = []
    if additional_sitemap_urls:
        with ThreadPoolExecutor(max_workers=len(additional_sitemap_urls)) as pool:
            futures = [pool.submit(fetch, url) for url in additional_sitemap_urls]
            additional_sitemaps = [future.result() for future in futures]

    return SiteResources(
        site_url=site_url,
        homepage=homepage,
        robots_txt=robots_txt,
        sitemap_xml=sitemap_xml,
        llms_txt=llms_txt,
        additional_sitemaps=additional_sitemaps,
    )


def build_check_context(resources: SiteResources) -> CheckContext:
    """
    Builds the shared CheckContext from already-fetched resources: parses
    the homepage HTML once (or leaves `root` None if the homepage couldn't
    be fetched at all) so every check reuses the same parsed tree instead of
    re-parsing HTML per check.
    """
    if not resources.homepage.ok or resources.homepage.body is None:
        return CheckContext(resources=resources, root=None)
    return CheckContext(resources=resources, root=parse_html(resources.homepage.body))


def load_site(raw_site_url: str, fetch_fn: Optional[FetchFn] = None) -> CheckContext:
    """
    Convenience wrapper: validate the URL, fetch all site resources, and
    build the CheckContext in one call. This is what `check` and `fleet`
    both call.
    """
    site_url = assert_http_url(raw_site_url)
    resources = fetch_site_resources(site_url, fetch_fn)
    return build_check_context(resources)


__all__ = ["FetchFn", "parse_sitemap_directives", "fetch_site_resources", "build_check_context", "load_site"]
