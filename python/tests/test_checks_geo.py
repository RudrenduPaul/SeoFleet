"""Ported from test/checks/geo/*.test.ts."""
from __future__ import annotations

from llmscout.checks.geo.ai_crawler_directives import (
    ai_crawler_directives_check,
    parse_ai_crawler_directives,
)
from llmscout.checks.geo.content_extraction import content_extraction_check
from llmscout.checks.geo.faq_schema import faq_schema_check
from llmscout.checks.geo.link_header import link_header_check, parse_link_header
from llmscout.checks.geo.llms_txt import llms_txt_check
from llmscout.checks.geo.markdown_negotiation import markdown_negotiation_check
from llmscout.checks.geo.organization_schema import organization_schema_check
from llmscout.checks.geo.speakable_schema import speakable_schema_check
from llmscout.checks.geo.structured_data import structured_data_check
from llmscout.fetch_utils import FetchedResource

from .conftest import BAD_HTML, GOOD_HTML, GOOD_ROBOTS_TXT, make_check_context


class TestStructuredDataCheck:
    def test_fails_when_homepage_unreachable(self):
        result = structured_data_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_warns_when_no_json_ld(self):
        result = structured_data_check.run(make_check_context("<html><head></head></html>"))
        assert result.status == "WARN"

    def test_fails_on_invalid_json(self):
        html = '<html><head><script type="application/ld+json">{not valid json}</script></head></html>'
        result = structured_data_check.run(make_check_context(html))
        assert result.status == "FAIL"

    def test_passes_on_valid_json_ld(self):
        result = structured_data_check.run(make_check_context(GOOD_HTML))
        assert result.status == "PASS"


class TestLlmsTxtCheck:
    def test_warns_when_unreachable(self):
        ctx = make_check_context(GOOD_HTML, llms_txt=FetchedResource(url="x", ok=False, status=404))
        result = llms_txt_check.run(ctx)
        assert result.status == "WARN"

    def test_warns_when_blank_body(self):
        ctx = make_check_context(GOOD_HTML, llms_txt=FetchedResource(url="x", ok=True, status=200, body="   "))
        result = llms_txt_check.run(ctx)
        assert result.status == "WARN"

    def test_passes_when_present(self):
        ctx = make_check_context(GOOD_HTML, llms_txt=FetchedResource(url="x", ok=True, status=200, body="# Acme\n\nWe make widgets."))
        result = llms_txt_check.run(ctx)
        assert result.status == "PASS"


class TestAiCrawlerDirectivesCheck:
    def test_warns_when_robots_unreachable(self):
        ctx = make_check_context(GOOD_HTML, robots_txt=FetchedResource(url="x", ok=False, status=404))
        result = ai_crawler_directives_check.run(ctx)
        assert result.status == "WARN"

    def test_passes_and_reports_directives(self):
        ctx = make_check_context(GOOD_HTML, robots_txt=FetchedResource(url="x", ok=True, status=200, body=GOOD_ROBOTS_TXT))
        result = ai_crawler_directives_check.run(ctx)
        assert result.status == "PASS"
        assert "GPTBot: disallow" in result.message
        assert "ClaudeBot: allow" in result.message

    def test_parser_handles_empty_disallow_as_unspecified(self):
        directives = parse_ai_crawler_directives("User-agent: GPTBot\nDisallow:\n", ["GPTBot"])
        assert directives["GPTBot"] == "unspecified"

    def test_parser_ignores_comments(self):
        directives = parse_ai_crawler_directives("User-agent: GPTBot # a comment\nDisallow: /\n", ["GPTBot"])
        assert directives["GPTBot"] == "disallow"

    def test_parser_defaults_to_unspecified_for_untracked_bot(self):
        directives = parse_ai_crawler_directives("User-agent: SomeOtherBot\nDisallow: /\n", ["GPTBot"])
        assert directives["GPTBot"] == "unspecified"

    def test_tracks_search_specific_crawlers_separately_from_training_only_counterparts(self):
        robots = (
            "User-agent: GPTBot\nDisallow: /\n\n"
            "User-agent: OAI-SearchBot\nAllow: /\n\n"
            "User-agent: ClaudeBot\nDisallow: /\n\n"
            "User-agent: Claude-SearchBot\nAllow: /\n"
        )
        directives = parse_ai_crawler_directives(robots)
        assert directives["GPTBot"] == "disallow"
        assert directives["OAI-SearchBot"] == "allow"
        assert directives["ClaudeBot"] == "disallow"
        assert directives["Claude-SearchBot"] == "allow"

    def test_tracks_applebot_extended(self):
        directives = parse_ai_crawler_directives("User-agent: Applebot-Extended\nDisallow: /\n")
        assert directives["Applebot-Extended"] == "disallow"


class TestFaqSchemaCheck:
    def test_fails_when_homepage_unreachable(self):
        result = faq_schema_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_warns_when_no_faq_schema(self):
        result = faq_schema_check.run(make_check_context("<html><head></head></html>"))
        assert result.status == "WARN"

    def test_passes_when_faq_page_present(self):
        result = faq_schema_check.run(make_check_context(GOOD_HTML))
        assert result.status == "PASS"

    def test_finds_faq_type_nested_in_graph(self):
        html = (
            '<html><head><script type="application/ld+json">'
            '{"@graph":[{"@type":"WebSite"},{"@type":"FAQPage"}]}'
            "</script></head></html>"
        )
        result = faq_schema_check.run(make_check_context(html))
        assert result.status == "PASS"


class TestContentExtractionCheck:
    def test_fails_when_homepage_unreachable(self):
        result = content_extraction_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_warns_when_no_structure(self):
        result = content_extraction_check.run(make_check_context("<html><body></body></html>"))
        assert result.status == "WARN"

    def test_warns_on_large_unstructured_block(self):
        result = content_extraction_check.run(make_check_context(BAD_HTML))
        assert result.status == "WARN"

    def test_passes_for_well_structured_content(self):
        result = content_extraction_check.run(make_check_context(GOOD_HTML))
        assert result.status == "PASS"


class TestSpeakableSchemaCheck:
    def test_fails_when_homepage_unreachable(self):
        result = speakable_schema_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_warns_when_no_speakable_schema(self):
        result = speakable_schema_check.run(make_check_context("<html><head></head></html>"))
        assert result.status == "WARN"

    def test_ignores_malformed_json_ld(self):
        html = '<html><head><script type="application/ld+json">{not json</script></head></html>'
        result = speakable_schema_check.run(make_check_context(html))
        assert result.status == "WARN"

    def test_passes_when_speakable_type_present_directly(self):
        html = (
            '<html><head><script type="application/ld+json">'
            '{"@type":"SpeakableSpecification","cssSelector":["h1",".summary"]}'
            "</script></head></html>"
        )
        result = speakable_schema_check.run(make_check_context(html))
        assert result.status == "PASS"

    def test_passes_when_speakable_nested_on_webpage(self):
        html = (
            '<html><head><script type="application/ld+json">'
            '{"@context":"https://schema.org","@type":"WebPage",'
            '"speakable":{"@type":"SpeakableSpecification","cssSelector":["h1"]}}'
            "</script></head></html>"
        )
        result = speakable_schema_check.run(make_check_context(html))
        assert result.status == "PASS"

    def test_passes_when_nested_in_graph(self):
        html = (
            '<html><head><script type="application/ld+json">'
            '{"@graph":[{"@type":"Organization"},{"@type":"SpeakableSpecification","cssSelector":["h1"]}]}'
            "</script></head></html>"
        )
        result = speakable_schema_check.run(make_check_context(html))
        assert result.status == "PASS"


class TestOrganizationSchemaCheck:
    def test_fails_when_homepage_unreachable(self):
        result = organization_schema_check.run(make_check_context(None))
        assert result.status == "FAIL"

    def test_warns_when_no_organization_schema(self):
        result = organization_schema_check.run(make_check_context("<html><head></head></html>"))
        assert result.status == "WARN"
        assert "No Organization" in result.message

    def test_ignores_malformed_json_ld(self):
        html = '<html><head><script type="application/ld+json">{not json</script></head></html>'
        result = organization_schema_check.run(make_check_context(html))
        assert result.status == "WARN"

    def test_warns_when_organization_present_without_same_as(self):
        html = (
            '<html><head><script type="application/ld+json">'
            '{"@type":"Organization","name":"Acme Widgets"}'
            "</script></head></html>"
        )
        result = organization_schema_check.run(make_check_context(html))
        assert result.status == "WARN"
        assert "sameAs" in result.message

    def test_warns_when_same_as_is_empty_array(self):
        html = (
            '<html><head><script type="application/ld+json">'
            '{"@type":"Organization","name":"Acme","sameAs":[]}'
            "</script></head></html>"
        )
        result = organization_schema_check.run(make_check_context(html))
        assert result.status == "WARN"

    def test_passes_when_organization_has_same_as(self):
        html = (
            '<html><head><script type="application/ld+json">'
            '{"@type":"Organization","name":"Acme Widgets",'
            '"sameAs":["https://twitter.com/acme","https://linkedin.com/company/acme"]}'
            "</script></head></html>"
        )
        result = organization_schema_check.run(make_check_context(html))
        assert result.status == "PASS"

    def test_passes_for_person_nested_in_graph(self):
        html = (
            '<html><head><script type="application/ld+json">'
            '{"@graph":[{"@type":"WebSite"},'
            '{"@type":"Person","name":"Jane Doe","sameAs":["https://twitter.com/janedoe"]}]}'
            "</script></head></html>"
        )
        result = organization_schema_check.run(make_check_context(html))
        assert result.status == "PASS"


class TestMarkdownNegotiationCheck:
    def test_warns_when_server_returns_html_instead_of_markdown(self):
        def fetch_fn(url, headers=None):
            return FetchedResource(url=url, ok=True, status=200, content_type="text/html; charset=utf-8")

        ctx = make_check_context(GOOD_HTML, fetch_fn=fetch_fn)
        result = markdown_negotiation_check.run(ctx)
        assert result.status == "WARN"
        assert "text/html" in result.message

    def test_warns_when_negotiation_request_fails(self):
        def fetch_fn(url, headers=None):
            return FetchedResource(url=url, ok=False, status=500, error="boom")

        ctx = make_check_context(GOOD_HTML, fetch_fn=fetch_fn)
        result = markdown_negotiation_check.run(ctx)
        assert result.status == "WARN"
        assert "request failed" in result.message

    def test_warns_when_content_type_absent(self):
        def fetch_fn(url, headers=None):
            return FetchedResource(url=url, ok=True, status=200)

        ctx = make_check_context(GOOD_HTML, fetch_fn=fetch_fn)
        result = markdown_negotiation_check.run(ctx)
        assert result.status == "WARN"

    def test_passes_when_server_honors_accept_markdown(self):
        def fetch_fn(url, headers=None):
            return FetchedResource(url=url, ok=True, status=200, content_type="text/markdown; charset=utf-8")

        ctx = make_check_context(GOOD_HTML, fetch_fn=fetch_fn)
        result = markdown_negotiation_check.run(ctx)
        assert result.status == "PASS"
        assert "text/markdown" in result.message

    def test_sends_accept_text_markdown_header(self):
        captured = {}

        def fetch_fn(url, headers=None):
            captured["headers"] = headers
            return FetchedResource(url=url, ok=True, status=200, content_type="text/html")

        ctx = make_check_context(GOOD_HTML, fetch_fn=fetch_fn)
        markdown_negotiation_check.run(ctx)
        assert captured["headers"] == {"Accept": "text/markdown"}

    def test_requests_the_sites_own_url(self):
        requested = {}

        def fetch_fn(url, headers=None):
            requested["url"] = url
            return FetchedResource(url=url, ok=True, status=200, content_type="text/html")

        ctx = make_check_context(GOOD_HTML, site_url="https://acme.example/", fetch_fn=fetch_fn)
        markdown_negotiation_check.run(ctx)
        assert requested["url"] == "https://acme.example/"


class TestParseLinkHeader:
    def test_parses_single_link_with_rel(self):
        links = parse_link_header('<https://acme.example/feed>; rel="alternate"')
        assert len(links) == 1
        assert links[0].url == "https://acme.example/feed"
        assert links[0].rel == "alternate"

    def test_parses_multiple_comma_separated_links(self):
        header = '<https://acme.example/feed>; rel="alternate", <https://acme.example/api>; rel="service-desc"'
        links = parse_link_header(header)
        assert len(links) == 2
        assert links[0].url == "https://acme.example/feed"
        assert links[1].url == "https://acme.example/api"
        assert links[1].rel == "service-desc"

    def test_does_not_split_on_comma_inside_quoted_param(self):
        header = '<https://acme.example/feed>; rel="alternate"; title="Home, Sweet Home"'
        links = parse_link_header(header)
        assert len(links) == 1
        assert links[0].params["title"] == "Home, Sweet Home"

    def test_returns_empty_list_for_unparseable_header(self):
        assert parse_link_header("not a link header") == []

    def test_handles_link_with_no_params(self):
        links = parse_link_header("<https://acme.example/plain>")
        assert len(links) == 1
        assert links[0].url == "https://acme.example/plain"
        assert links[0].rel is None


class TestLinkHeaderCheck:
    def test_warns_when_no_link_header(self):
        ctx = make_check_context(GOOD_HTML)
        result = link_header_check.run(ctx)
        assert result.status == "WARN"
        assert "does not send" in result.message

    def test_warns_when_link_header_blank(self):
        ctx = make_check_context(GOOD_HTML)
        ctx.resources.homepage.link_header = "   "
        result = link_header_check.run(ctx)
        assert result.status == "WARN"

    def test_warns_when_link_header_unparseable(self):
        ctx = make_check_context(GOOD_HTML)
        ctx.resources.homepage.link_header = "garbage, not a link"
        result = link_header_check.run(ctx)
        assert result.status == "WARN"
        assert "could not be parsed" in result.message

    def test_passes_when_link_header_well_formed(self):
        ctx = make_check_context(GOOD_HTML)
        ctx.resources.homepage.link_header = '<https://acme.example/feed>; rel="alternate"'
        result = link_header_check.run(ctx)
        assert result.status == "PASS"
        assert "feed" in result.message
        assert 'rel="alternate"' in result.message

    def test_passes_and_reports_multiple_entries(self):
        ctx = make_check_context(GOOD_HTML)
        ctx.resources.homepage.link_header = (
            '<https://acme.example/feed>; rel="alternate", <https://acme.example/api>; rel="service-desc"'
        )
        result = link_header_check.run(ctx)
        assert result.status == "PASS"
        assert "2 Link header entries" in result.message

    def test_does_not_depend_on_homepage_dom(self):
        ctx = make_check_context(None)
        ctx.resources.homepage.link_header = '<https://acme.example/feed>; rel="alternate"'
        result = link_header_check.run(ctx)
        assert result.status == "PASS"
