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
from typing import Optional
from urllib.parse import urlparse

from .errors import SeoFleetError
from .fetch_utils import assert_http_url, safe_fetch
from .html_util import parse_html
from .types import CheckContext, FetchFn, SiteResources


def fetch_site_resources(site_url: str, fetch_fn: Optional[FetchFn] = None) -> SiteResources:
    fetch = fetch_fn or safe_fetch
    parsed = urlparse(site_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"

    with ThreadPoolExecutor(max_workers=4) as pool:
        homepage_future = pool.submit(fetch, site_url)
        robots_future = pool.submit(fetch, f"{origin}/robots.txt")
        sitemap_future = pool.submit(fetch, f"{origin}/sitemap.xml")
        llms_future = pool.submit(fetch, f"{origin}/llms.txt")

        homepage = homepage_future.result()
        robots_txt = robots_future.result()
        sitemap_xml = sitemap_future.result()
        llms_txt = llms_future.result()

    return SiteResources(
        site_url=site_url,
        homepage=homepage,
        robots_txt=robots_txt,
        sitemap_xml=sitemap_xml,
        llms_txt=llms_txt,
    )


def build_check_context(resources: SiteResources, fetch_fn: Optional[FetchFn] = None) -> CheckContext:
    """
    Builds the shared CheckContext from already-fetched resources: parses
    the homepage HTML once (or leaves `root` None if the homepage couldn't
    be fetched at all) so every check reuses the same parsed tree instead of
    re-parsing HTML per check. `fetch_fn` is threaded onto the context too,
    so a check that needs its own additional requests (e.g. image_weight's
    per-image HEAD requests) reuses the exact same fetch function -- and the
    same test stub -- as the four shared site resources.
    """
    fetch = fetch_fn or safe_fetch
    if not resources.homepage.ok or resources.homepage.body is None:
        return CheckContext(resources=resources, root=None, fetch_fn=fetch)
    return CheckContext(resources=resources, root=parse_html(resources.homepage.body), fetch_fn=fetch)


def load_site(raw_site_url: str, fetch_fn: Optional[FetchFn] = None) -> CheckContext:
    """
    Convenience wrapper: validate the URL, fetch all site resources, and
    build the CheckContext in one call. This is what `check` and `fleet`
    both call.
    """
    site_url = assert_http_url(raw_site_url)
    resources = fetch_site_resources(site_url, fetch_fn)
    return build_check_context(resources, fetch_fn)


__all__ = ["FetchFn", "fetch_site_resources", "build_check_context", "load_site"]
