"""
Ported from test/checks/technical/*.test.ts. One test class per check,
covering the FAIL (unreachable homepage), each WARN/FAIL branch, and the
PASS branch, mirroring the TypeScript suite's own coverage shape.
"""
from __future__ import annotations

from llmscout.checks.technical.canonical import canonical_check
from llmscout.checks.technical.heading_structure import heading_structure_check
from llmscout.checks.technical.image_alt import image_alt_check
from llmscout.checks.technical.image_weight import image_weight_check
from llmscout.checks.technical.meta_description import meta_description_check
from llmscout.checks.technical.open_graph import open_graph_check
from llmscout.checks.technical.robots_meta_directives import robots_meta_directives_check
from llmscout.checks.technical.robots_txt import robots_txt_check
from llmscout.checks.technical.sitemap_xml import sitemap_xml_check
from llmscout.checks.technical.title import title_check
from llmscout.checks.technical.twitter_card import twitter_card_check
from llmscout.checks.technical.redirect_chain import redirect_chain_check
from llmscout import fetch_utils
from llmscout.fetch_utils import FetchedResource, Hop, safe_fetch

from .conftest import GOOD_HTML, make_check_context, make_fetch_stub
from .test_fetch_utils import _http_error


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

    def test_fails_with_cdn_interception_message_for_html_shaped_body(self):
        body = "<!doctype html><html><head><title>Attention Required!</title></head><body>Cloudflare</body></html>"
        ctx = make_check_context(GOOD_HTML, sitemap_xml=FetchedResource(url="x", ok=True, status=200, body=body))
        result = sitemap_xml_check.run(ctx)
        assert result.status == "FAIL"
        assert "CDN" in result.message
        assert "Cloudflare" in result.message
        assert "missing <urlset> or <sitemapindex>" not in result.message

    def test_fails_with_cdn_interception_message_for_bare_html_tag_with_leading_whitespace(self):
        body = "\n  <html><body>Access denied</body></html>"
        ctx = make_check_context(GOOD_HTML, sitemap_xml=FetchedResource(url="x", ok=True, status=200, body=body))
        result = sitemap_xml_check.run(ctx)
        assert result.status == "FAIL"
        assert "CDN" in result.message

    def test_fails_with_generic_message_when_not_html_shaped(self):
        body = "<urlst><url><loc>https://acme.example/</loc></url></urlst>"
        ctx = make_check_context(GOOD_HTML, sitemap_xml=FetchedResource(url="x", ok=True, status=200, body=body))
        result = sitemap_xml_check.run(ctx)
        assert result.status == "FAIL"
        assert "missing <urlset> or <sitemapindex>" in result.message
        assert "CDN" not in result.message

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


class TestOpenGraphCheck:
    def test_fails_when_homepage_unreachable(self):
        result = open_graph_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_warns_when_no_og_tags(self):
        result = open_graph_check.run(make_check_context("<html><head></head></html>"))
        assert result.status == "WARN"
        assert "No Open Graph tags found" in result.message

    def test_warns_and_lists_missing_when_partial(self):
        html = (
            '<html><head><meta property="og:title" content="Acme Widgets">'
            '<meta property="og:description" content="Handmade widgets since 1990."></head></html>'
        )
        result = open_graph_check.run(make_check_context(html))
        assert result.status == "WARN"
        assert "og:image" in result.message
        assert "og:url" in result.message

    def test_passes_when_all_required_tags_present(self):
        html = (
            '<html><head>'
            '<meta property="og:title" content="Acme Widgets">'
            '<meta property="og:description" content="Handmade widgets since 1990.">'
            '<meta property="og:image" content="https://acme.example/og.png">'
            '<meta property="og:url" content="https://acme.example/">'
            "</head></html>"
        )
        result = open_graph_check.run(make_check_context(html))
        assert result.status == "PASS"


class TestTwitterCardCheck:
    def test_fails_when_homepage_unreachable(self):
        result = twitter_card_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_warns_when_no_card_tag(self):
        result = twitter_card_check.run(make_check_context("<html><head></head></html>"))
        assert result.status == "WARN"

    def test_fails_on_unrecognized_card_type(self):
        html = '<html><head><meta name="twitter:card" content="not-a-real-type"></head></html>'
        result = twitter_card_check.run(make_check_context(html))
        assert result.status == "FAIL"

    def test_warns_when_valid_but_fields_missing(self):
        html = '<html><head><meta name="twitter:card" content="summary_large_image"></head></html>'
        result = twitter_card_check.run(make_check_context(html))
        assert result.status == "WARN"
        assert "twitter:title" in result.message

    def test_passes_when_valid_and_all_fields_present(self):
        html = (
            '<html><head>'
            '<meta name="twitter:card" content="summary_large_image">'
            '<meta name="twitter:title" content="Acme Widgets">'
            '<meta name="twitter:description" content="Handmade widgets since 1990.">'
            '<meta name="twitter:image" content="https://acme.example/twitter.png">'
            "</head></html>"
        )
        result = twitter_card_check.run(make_check_context(html))
        assert result.status == "PASS"


class TestRobotsMetaDirectivesCheck:
    def test_fails_when_homepage_unreachable(self):
        result = robots_meta_directives_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_warns_when_no_meta_robots_tag(self):
        result = robots_meta_directives_check.run(make_check_context("<html><head></head></html>"))
        assert result.status == "WARN"

    def test_fails_when_noindex_present(self):
        html = '<html><head><meta name="robots" content="noindex, max-snippet:-1"></head></html>'
        result = robots_meta_directives_check.run(make_check_context(html))
        assert result.status == "FAIL"
        assert "noindex" in result.message

    def test_warns_when_no_advanced_directives(self):
        html = '<html><head><meta name="robots" content="index, follow"></head></html>'
        result = robots_meta_directives_check.run(make_check_context(html))
        assert result.status == "WARN"

    def test_warns_and_lists_missing_when_partial(self):
        html = '<html><head><meta name="robots" content="max-snippet:-1"></head></html>'
        result = robots_meta_directives_check.run(make_check_context(html))
        assert result.status == "WARN"
        assert "max-image-preview" in result.message
        assert "max-video-preview" in result.message

    def test_passes_when_all_advanced_directives_present(self):
        html = (
            '<html><head><meta name="robots" '
            'content="max-snippet:-1, max-image-preview:large, max-video-preview:-1"></head></html>'
        )
        result = robots_meta_directives_check.run(make_check_context(html))
        assert result.status == "PASS"


class TestImageWeightCheck:
    def test_fails_when_homepage_unreachable(self):
        result = image_weight_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_passes_when_no_images(self):
        result = image_weight_check.run(make_check_context("<html><body><p>No images</p></body></html>"))
        assert result.status == "PASS"

    def test_passes_when_no_src_is_http_s(self):
        html = '<html><body><img src="data:image/png;base64,AAAA"></body></html>'
        result = image_weight_check.run(make_check_context(html))
        assert result.status == "PASS"
        assert "http(s)" in result.message

    def test_passes_and_does_not_flag_when_size_cannot_be_determined(self):
        html = '<html><body><img src="/a.png"></body></html>'
        fetch_fn = make_fetch_stub({})  # nothing stubbed -> every HEAD comes back 404
        result = image_weight_check.run(make_check_context(html, fetch_fn=fetch_fn))
        assert result.status == "PASS"
        assert "Could not determine file size" in result.message

    def test_passes_when_every_measured_image_is_under_warn_threshold(self):
        html = '<html><body><img src="/a.png"><img src="/b.png"></body></html>'
        fetch_fn = make_fetch_stub(
            {
                "https://acme.example/a.png": {"content_length": 50 * 1024},
                "https://acme.example/b.png": {"content_length": 100 * 1024},
            }
        )
        result = image_weight_check.run(make_check_context(html, fetch_fn=fetch_fn))
        assert result.status == "PASS"
        assert "150.0 KB" in result.message

    def test_warns_when_an_image_exceeds_200kb_but_not_500kb(self):
        html = '<html><body><img src="/big.png"></body></html>'
        fetch_fn = make_fetch_stub({"https://acme.example/big.png": {"content_length": 300 * 1024}})
        result = image_weight_check.run(make_check_context(html, fetch_fn=fetch_fn))
        assert result.status == "WARN"

    def test_fails_when_an_image_exceeds_500kb(self):
        html = '<html><body><img src="/huge.png"></body></html>'
        fetch_fn = make_fetch_stub({"https://acme.example/huge.png": {"content_length": 600 * 1024}})
        result = image_weight_check.run(make_check_context(html, fetch_fn=fetch_fn))
        assert result.status == "FAIL"
        assert "500.0 KB" in result.message

    def test_resolves_relative_src_against_site_url_before_fetching(self):
        html = '<html><body><img src="images/hero.png"></body></html>'
        requested = {}

        def fetch_fn(url, method="GET"):
            requested["url"] = url
            return FetchedResource(url=url, ok=True, status=200, content_length=1024)

        image_weight_check.run(make_check_context(html, site_url="https://acme.example/page/", fetch_fn=fetch_fn))
        assert requested["url"] == "https://acme.example/page/images/hero.png"

    def test_issues_head_requests_not_get(self):
        html = '<html><body><img src="/a.png"></body></html>'
        seen = {}

        def fetch_fn(url, method="GET"):
            seen["method"] = method
            return FetchedResource(url=url, ok=True, status=200, content_length=1024)

        image_weight_check.run(make_check_context(html, fetch_fn=fetch_fn))
        assert seen["method"] == "HEAD"


class TestRedirectChainCheck:
    def test_passes_when_no_hops_recorded(self):
        ctx = make_check_context(GOOD_HTML)
        result = redirect_chain_check.run(ctx)
        assert result.status == "PASS"
        assert "no redirects" in result.message

    def test_passes_for_a_chain_of_one_to_two_hops(self):
        homepage = FetchedResource(
            url="https://acme.example/final",
            ok=True,
            status=200,
            body=GOOD_HTML,
            hops=[Hop(url="https://acme.example/", status=301)],
        )
        ctx = make_check_context(GOOD_HTML)
        ctx.resources.homepage = homepage
        result = redirect_chain_check.run(ctx)
        assert result.status == "PASS"

    def test_warns_when_chain_is_longer_than_two_hops(self):
        homepage = FetchedResource(
            url="https://acme.example/final",
            ok=True,
            status=200,
            body=GOOD_HTML,
            hops=[
                Hop(url="https://acme.example/", status=301),
                Hop(url="https://acme.example/step2", status=301),
                Hop(url="https://acme.example/step3", status=302),
            ],
        )
        ctx = make_check_context(GOOD_HTML)
        ctx.resources.homepage = homepage
        result = redirect_chain_check.run(ctx)
        assert result.status == "WARN"
        assert "3 redirect hops" in result.message

    def test_fails_when_the_chain_dead_ends_in_a_terminal_error_status(self, monkeypatch):
        # Real safe_fetch output: a Hop is only ever appended inside
        # safe_fetch's own 3xx redirect branch, so an error can never
        # appear as a hops[] entry -- it always lands on the final
        # FetchedResource's own status/ok instead. Drive the real fetch
        # wrapper through a 301 that dead-ends in a 404 so the test
        # exercises a shape safe_fetch can actually produce, rather than a
        # hand-built hops list it never would.
        responses = [
            _http_error("https://acme.example/", 301, {"Location": "https://acme.example/gone"}),
            _http_error("https://acme.example/gone", 404, body=b"not found"),
        ]

        def fake_open(request, *a, **k):
            raise responses.pop(0)

        monkeypatch.setattr(fetch_utils._opener, "open", fake_open)
        homepage = safe_fetch("https://acme.example/")
        assert homepage.ok is False
        assert homepage.status == 404
        assert homepage.hops == [Hop(url="https://acme.example/", status=301)]

        ctx = make_check_context(GOOD_HTML)
        ctx.resources.homepage = homepage
        result = redirect_chain_check.run(ctx)
        assert result.status == "FAIL"
        assert "HTTP 404" in result.message

    def test_fails_even_for_a_single_redirect_if_the_chain_dead_ends_in_an_error(self, monkeypatch):
        responses = [
            _http_error("https://acme.example/", 302, {"Location": "https://acme.example/old"}),
            _http_error("https://acme.example/old", 500, body=b"server error"),
        ]

        def fake_open(request, *a, **k):
            raise responses.pop(0)

        monkeypatch.setattr(fetch_utils._opener, "open", fake_open)
        homepage = safe_fetch("https://acme.example/")

        ctx = make_check_context(GOOD_HTML)
        ctx.resources.homepage = homepage
        result = redirect_chain_check.run(ctx)
        assert result.status == "FAIL"
