"""
Ported from test/checks/technical/*.test.ts. One test class per check,
covering the FAIL (unreachable homepage), each WARN/FAIL branch, and the
PASS branch, mirroring the TypeScript suite's own coverage shape.
"""
from __future__ import annotations

from seofleet.checks.technical.canonical import canonical_check
from seofleet.checks.technical.heading_structure import heading_structure_check
from seofleet.checks.technical.image_alt import image_alt_check
from seofleet.checks.technical.meta_description import meta_description_check
from seofleet.checks.technical.robots_txt import robots_txt_check
from seofleet.checks.technical.sitemap_xml import sitemap_xml_check
from seofleet.checks.technical.title import title_check
from seofleet.fetch_utils import FetchedResource

from .conftest import GOOD_HTML, make_check_context


class TestTitleCheck:
    def test_fails_when_homepage_unreachable(self):
        result = title_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_fails_when_no_title_tag(self):
        result = title_check.run(make_check_context("<html><head></head><body></body></html>"))
        assert result.status == "FAIL"

    def test_warns_when_title_too_short(self):
        result = title_check.run(make_check_context("<html><head><title>Hi</title></head></html>"))
        assert result.status == "WARN"

    def test_warns_when_title_too_long(self):
        long_title = "A" * 80
        result = title_check.run(make_check_context(f"<html><head><title>{long_title}</title></head></html>"))
        assert result.status == "WARN"

    def test_passes_for_well_sized_title(self):
        result = title_check.run(
            make_check_context("<html><head><title>Acme Widgets -- Handmade Since 1990</title></head></html>")
        )
        assert result.status == "PASS"


class TestMetaDescriptionCheck:
    def test_fails_when_homepage_unreachable(self):
        result = meta_description_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_warns_when_missing(self):
        result = meta_description_check.run(make_check_context("<html><head></head></html>"))
        assert result.status == "WARN"

    def test_warns_when_too_short(self):
        html = '<html><head><meta name="description" content="Too short."></head></html>'
        result = meta_description_check.run(make_check_context(html))
        assert result.status == "WARN"

    def test_passes_within_range(self):
        content = "A" * 100
        html = f'<html><head><meta name="description" content="{content}"></head></html>'
        result = meta_description_check.run(make_check_context(html))
        assert result.status == "PASS"


class TestCanonicalCheck:
    def test_fails_when_homepage_unreachable(self):
        result = canonical_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_warns_when_missing(self):
        result = canonical_check.run(make_check_context("<html><head></head></html>"))
        assert result.status == "WARN"

    def test_passes_for_absolute_href(self):
        html = '<html><head><link rel="canonical" href="https://acme.example/page"></head></html>'
        result = canonical_check.run(make_check_context(html))
        assert result.status == "PASS"

    def test_passes_for_relative_href_resolved_against_site_url(self):
        html = '<html><head><link rel="canonical" href="/page"></head></html>'
        result = canonical_check.run(make_check_context(html))
        assert result.status == "PASS"


class TestRobotsTxtCheck:
    def test_fails_when_unreachable(self):
        ctx = make_check_context(GOOD_HTML, robots_txt=FetchedResource(url="x", ok=False, status=404))
        result = robots_txt_check.run(ctx)
        assert result.status == "FAIL"

    def test_warns_when_no_user_agent_directive(self):
        ctx = make_check_context(GOOD_HTML, robots_txt=FetchedResource(url="x", ok=True, status=200, body="Disallow: /admin\n"))
        result = robots_txt_check.run(ctx)
        assert result.status == "WARN"

    def test_passes_when_user_agent_present(self):
        ctx = make_check_context(GOOD_HTML, robots_txt=FetchedResource(url="x", ok=True, status=200, body="User-agent: *\nDisallow:\n"))
        result = robots_txt_check.run(ctx)
        assert result.status == "PASS"


class TestSitemapXmlCheck:
    def test_warns_when_unreachable(self):
        ctx = make_check_context(GOOD_HTML, sitemap_xml=FetchedResource(url="x", ok=False, status=404))
        result = sitemap_xml_check.run(ctx)
        assert result.status == "WARN"

    def test_fails_when_not_valid_sitemap_xml(self):
        ctx = make_check_context(GOOD_HTML, sitemap_xml=FetchedResource(url="x", ok=True, status=200, body="<html>not a sitemap</html>"))
        result = sitemap_xml_check.run(ctx)
        assert result.status == "FAIL"

    def test_passes_for_valid_urlset(self):
        body = '<?xml version="1.0"?><urlset><url><loc>https://acme.example/</loc></url></urlset>'
        ctx = make_check_context(GOOD_HTML, sitemap_xml=FetchedResource(url="x", ok=True, status=200, body=body))
        result = sitemap_xml_check.run(ctx)
        assert result.status == "PASS"

    def test_passes_for_valid_sitemapindex(self):
        body = '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://acme.example/s1.xml</loc></sitemap></sitemapindex>'
        ctx = make_check_context(GOOD_HTML, sitemap_xml=FetchedResource(url="x", ok=True, status=200, body=body))
        result = sitemap_xml_check.run(ctx)
        assert result.status == "PASS"

    def test_passes_when_sitemap_xml_fails_but_a_robots_txt_discovered_candidate_is_valid(self):
        body = '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://acme.example/s1.xml</loc></sitemap></sitemapindex>'
        ctx = make_check_context(
            GOOD_HTML,
            sitemap_xml=FetchedResource(url="https://acme.example/sitemap.xml", ok=False, status=404),
            additional_sitemaps=[
                FetchedResource(url="https://acme.example/sitemap_index.xml", ok=True, status=200, body=body)
            ],
        )
        result = sitemap_xml_check.run(ctx)
        assert result.status == "PASS"
        assert "sitemap_index.xml" in result.message

    def test_fails_when_sitemap_xml_unreachable_and_only_reachable_candidate_is_invalid(self):
        ctx = make_check_context(
            GOOD_HTML,
            sitemap_xml=FetchedResource(url="https://acme.example/sitemap.xml", ok=False, status=404),
            additional_sitemaps=[
                FetchedResource(
                    url="https://acme.example/sitemap_index.xml", ok=True, status=200, body="<html>not a sitemap</html>"
                )
            ],
        )
        result = sitemap_xml_check.run(ctx)
        assert result.status == "FAIL"

    def test_warns_only_once_every_candidate_fails(self):
        ctx = make_check_context(
            GOOD_HTML,
            sitemap_xml=FetchedResource(url="https://acme.example/sitemap.xml", ok=False, status=404),
            additional_sitemaps=[
                FetchedResource(url="https://acme.example/sitemap_index.xml", ok=False, status=404)
            ],
        )
        result = sitemap_xml_check.run(ctx)
        assert result.status == "WARN"
        assert "sitemap.xml" in result.message
        assert "sitemap_index.xml" in result.message


class TestHeadingStructureCheck:
    def test_fails_when_homepage_unreachable(self):
        result = heading_structure_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_fails_when_no_h1(self):
        result = heading_structure_check.run(make_check_context("<html><body><h2>x</h2></body></html>"))
        assert result.status == "FAIL"

    def test_warns_when_multiple_h1(self):
        result = heading_structure_check.run(make_check_context("<html><body><h1>a</h1><h1>b</h1></body></html>"))
        assert result.status == "WARN"

    def test_warns_when_level_skipped(self):
        result = heading_structure_check.run(make_check_context("<html><body><h1>a</h1><h3>b</h3></body></html>"))
        assert result.status == "WARN"

    def test_passes_for_clean_hierarchy(self):
        result = heading_structure_check.run(
            make_check_context("<html><body><h1>a</h1><h2>b</h2><h3>c</h3></body></html>")
        )
        assert result.status == "PASS"


class TestImageAltCheck:
    def test_fails_when_homepage_unreachable(self):
        result = image_alt_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_passes_when_no_images(self):
        result = image_alt_check.run(make_check_context("<html><body></body></html>"))
        assert result.status == "PASS"

    def test_passes_when_all_images_have_alt(self):
        html = '<html><body><img src="a.png" alt="A"><img src="b.png" alt=""></body></html>'
        result = image_alt_check.run(make_check_context(html))
        assert result.status == "PASS"

    def test_warns_at_high_coverage(self):
        # 9 of 10 covered = 90% >= 80% threshold -> WARN
        imgs = "".join(f'<img src="{i}.png" alt="x">' for i in range(9)) + '<img src="9.png">'
        result = image_alt_check.run(make_check_context(f"<html><body>{imgs}</body></html>"))
        assert result.status == "WARN"

    def test_fails_at_low_coverage(self):
        html = '<html><body><img src="a.png"><img src="b.png"></body></html>'
        result = image_alt_check.run(make_check_context(html))
        assert result.status == "FAIL"
