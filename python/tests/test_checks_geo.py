"""Ported from test/checks/geo/*.test.ts."""
from __future__ import annotations

from seofleet.checks.geo.ai_crawler_directives import (
    ai_crawler_directives_check,
    parse_ai_crawler_directives,
)
from seofleet.checks.geo.content_extraction import content_extraction_check
from seofleet.checks.geo.faq_schema import faq_schema_check
from seofleet.checks.geo.llms_txt import llms_txt_check
from seofleet.checks.geo.organization_schema import organization_schema_check
from seofleet.checks.geo.speakable_schema import speakable_schema_check
from seofleet.checks.geo.structured_data import structured_data_check
from seofleet.fetch_utils import FetchedResource

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
