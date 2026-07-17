"""
Shared test fixtures, mirroring test/test-helpers.ts from the TypeScript
suite: every test that needs "network" data builds a `CheckContext` (or a
fetch stub) directly rather than making a real network call -- no real
network calls happen anywhere in this test suite except the single
end-to-end smoke test that is explicitly opt-in (see test_e2e.py).
"""
from __future__ import annotations

from typing import Callable, Dict, Optional

from seofleet.fetch_utils import FetchedResource
from seofleet.html_util import parse_html
from seofleet.types import CheckContext, SiteResources

GOOD_HTML = """<!doctype html>
<html>
<head>
  <title>Acme Widgets -- Handmade Widgets Since 1990</title>
  <meta name="description" content="Acme Widgets makes handmade widgets for professionals who need reliable, durable tools that last for decades of daily use.">
  <link rel="canonical" href="https://acme.example/">
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Organization","name":"Acme Widgets"}
  </script>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is a widget?","acceptedAnswer":{"@type":"Answer","text":"A widget is a small mechanical device."}}]}
  </script>
</head>
<body>
  <main>
    <h1>Acme Widgets</h1>
    <p>Acme Widgets has been building reliable, handmade widgets for professionals since 1990.</p>
    <h2>Our story</h2>
    <p>Founded in a small garage, Acme Widgets now ships to customers across the world every day.</p>
    <img src="/widget.png" alt="A handmade widget on a workbench">
  </main>
</body>
</html>"""

BAD_HTML = """<!doctype html>
<html>
<head></head>
<body>
  <div>Everything is crammed into this one div with no headings or paragraphs at all, just a giant wall of unstructured text that keeps going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going.</div>
  <h1>First</h1>
  <h1>Second</h1>
  <img src="/a.png">
  <img src="/b.png">
</body>
</html>"""

GOOD_ROBOTS_TXT = """User-agent: *
Disallow:

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Allow: /
"""

GOOD_SITEMAP_XML = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://acme.example/</loc></url>
</urlset>"""


def make_fetch_stub(routes: Dict[str, Dict[str, object]]) -> Callable[[str], FetchedResource]:
    """Builds a fetch function stub keyed by exact URL. No real network
    calls happen when this is passed as `fetch_fn`."""

    def _stub(url: str) -> FetchedResource:
        route = routes.get(url)
        if route is None:
            return FetchedResource(url=url, ok=False, status=404, error="not stubbed")
        status = route.get("status", 200)
        ok = route.get("ok", 200 <= status < 300)
        return FetchedResource(
            url=url,
            ok=ok,
            status=status,
            body=route.get("body"),
            error=route.get("error"),
        )

    return _stub


def make_check_context(
    html: Optional[str],
    robots_txt: Optional[FetchedResource] = None,
    sitemap_xml: Optional[FetchedResource] = None,
    llms_txt: Optional[FetchedResource] = None,
    site_url: str = "https://acme.example/",
) -> CheckContext:
    """
    Builds a full CheckContext for a single check test: `html=None` models
    an unreachable homepage (every DOM-dependent check should FAIL in that
    case), otherwise the HTML is parsed exactly as the real runner would.
    """
    homepage = (
        FetchedResource(url=site_url, ok=True, status=200, body=html)
        if html is not None
        else FetchedResource(url=site_url, ok=False, status=500, error="unreachable")
    )
    resources = SiteResources(
        site_url=site_url,
        homepage=homepage,
        robots_txt=robots_txt or FetchedResource(url=site_url.rstrip("/") + "/robots.txt", ok=False, status=404),
        sitemap_xml=sitemap_xml or FetchedResource(url=site_url.rstrip("/") + "/sitemap.xml", ok=False, status=404),
        llms_txt=llms_txt or FetchedResource(url=site_url.rstrip("/") + "/llms.txt", ok=False, status=404),
    )
    return CheckContext(resources=resources, root=parse_html(html) if html is not None else None)
