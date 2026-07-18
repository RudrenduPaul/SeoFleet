"""Ported from test/site-resources.test.ts."""
from __future__ import annotations

from seofleet.site_resources import build_check_context, fetch_site_resources, parse_sitemap_directives

from .conftest import (
    GOOD_HTML,
    GOOD_ROBOTS_TXT,
    GOOD_SITEMAP_XML,
    ROBOTS_TXT_WITH_SITEMAP_DIRECTIVE,
    make_fetch_stub,
)


class TestParseSitemapDirectives:
    def test_returns_empty_list_when_no_sitemap_directive(self):
        assert parse_sitemap_directives(GOOD_ROBOTS_TXT) == []

    def test_extracts_a_sitemap_directive_url(self):
        assert parse_sitemap_directives(ROBOTS_TXT_WITH_SITEMAP_DIRECTIVE) == [
            "https://acme.example/sitemap_index.xml"
        ]

    def test_extracts_multiple_sitemap_directive_lines_case_insensitively(self):
        body = "User-agent: *\nDisallow:\nsitemap: https://acme.example/a.xml\nSITEMAP: https://acme.example/b.xml\n"
        assert parse_sitemap_directives(body) == [
            "https://acme.example/a.xml",
            "https://acme.example/b.xml",
        ]

    def test_ignores_a_comment_only_or_blank_sitemap_value(self):
        body = "Sitemap: # no url here\nSitemap:\n"
        assert parse_sitemap_directives(body) == []


class TestFetchSiteResources:
    def test_fetches_homepage_plus_the_three_well_known_files(self):
        fetch_stub = make_fetch_stub(
            {
                "https://acme.example/": {"body": GOOD_HTML},
                "https://acme.example/robots.txt": {"body": GOOD_ROBOTS_TXT},
                "https://acme.example/sitemap.xml": {"body": GOOD_SITEMAP_XML},
                "https://acme.example/llms.txt": {"body": "# Acme\nA site about widgets."},
            }
        )
        resources = fetch_site_resources("https://acme.example/", fetch_stub)
        assert resources.homepage.ok is True
        assert "User-agent" in resources.robots_txt.body
        assert "<urlset" in resources.sitemap_xml.body
        assert "Acme" in resources.llms_txt.body
        assert resources.additional_sitemaps == []

    def test_fetches_a_robots_txt_named_sitemap_as_an_additional_candidate(self):
        fetch_stub = make_fetch_stub(
            {
                "https://acme.example/": {"body": GOOD_HTML},
                "https://acme.example/robots.txt": {"body": ROBOTS_TXT_WITH_SITEMAP_DIRECTIVE},
                "https://acme.example/sitemap.xml": {"ok": False, "status": 404},
                "https://acme.example/sitemap_index.xml": {"body": GOOD_SITEMAP_XML},
                "https://acme.example/llms.txt": {"ok": False, "status": 404},
            }
        )
        resources = fetch_site_resources("https://acme.example/", fetch_stub)
        assert len(resources.additional_sitemaps) == 1
        assert resources.additional_sitemaps[0].url == "https://acme.example/sitemap_index.xml"
        assert "<urlset" in resources.additional_sitemaps[0].body

    def test_does_not_refetch_default_sitemap_when_robots_txt_also_names_it(self):
        fetch_stub = make_fetch_stub(
            {
                "https://acme.example/": {"body": GOOD_HTML},
                "https://acme.example/robots.txt": {"body": "Sitemap: https://acme.example/sitemap.xml\n"},
                "https://acme.example/sitemap.xml": {"body": GOOD_SITEMAP_XML},
                "https://acme.example/llms.txt": {"ok": False, "status": 404},
            }
        )
        resources = fetch_site_resources("https://acme.example/", fetch_stub)
        assert resources.additional_sitemaps == []

    def test_skips_additional_sitemap_fetches_when_robots_txt_unreachable(self):
        fetch_stub = make_fetch_stub(
            {
                "https://acme.example/": {"body": GOOD_HTML},
                "https://acme.example/robots.txt": {"ok": False, "status": 500},
                "https://acme.example/sitemap.xml": {"body": GOOD_SITEMAP_XML},
                "https://acme.example/llms.txt": {"ok": False, "status": 404},
            }
        )
        resources = fetch_site_resources("https://acme.example/", fetch_stub)
        assert resources.additional_sitemaps == []


class TestBuildCheckContext:
    def test_parses_homepage_html_when_fetch_succeeded(self):
        resources = fetch_site_resources(
            "https://acme.example/",
            make_fetch_stub(
                {
                    "https://acme.example/": {"body": GOOD_HTML},
                    "https://acme.example/robots.txt": {"ok": False, "status": 404},
                    "https://acme.example/sitemap.xml": {"ok": False, "status": 404},
                    "https://acme.example/llms.txt": {"ok": False, "status": 404},
                }
            ),
        )
        ctx = build_check_context(resources)
        assert ctx.root is not None

    def test_leaves_root_none_when_homepage_fetch_failed(self):
        resources = fetch_site_resources(
            "https://acme.example/",
            make_fetch_stub({}),
        )
        ctx = build_check_context(resources)
        assert ctx.root is None
