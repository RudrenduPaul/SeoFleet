"""Tests for the stdlib-only HTML tree builder (no TypeScript equivalent --
cheerio provided this directly on that side)."""
from __future__ import annotations

from seofleet.html_util import get_link_href, get_meta_content, get_scripts_by_type, parse_html


def test_void_tags_do_not_swallow_siblings():
    root = parse_html("<html><body><img src='a.png'><p>after</p></body></html>")
    paragraphs = root.find_all(("p",))
    assert len(paragraphs) == 1
    assert paragraphs[0].text() == "after"


def test_self_closed_void_tag_also_handled():
    root = parse_html("<html><body><br/><p>after</p></body></html>")
    assert len(root.find_all(("p",))) == 1


def test_meta_content_missing_vs_present():
    root = parse_html('<html><head><meta name="viewport" content="width=device-width"></head></html>')
    assert get_meta_content(root, "description") is None
    assert get_meta_content(root, "viewport") == "width=device-width"


def test_link_href_case_insensitive_rel():
    root = parse_html('<html><head><link rel="Canonical" href="/x"></head></html>')
    assert get_link_href(root, "canonical") == "/x"


def test_alt_present_but_empty_is_not_missing():
    root = parse_html('<html><body><img src="a.png" alt=""></body></html>')
    img = root.find_first(("img",))
    assert img.has_attr("alt")
    assert img.attr("alt") == ""


def test_alt_fully_absent_is_missing():
    root = parse_html('<html><body><img src="a.png"></body></html>')
    img = root.find_first(("img",))
    assert not img.has_attr("alt")


def test_script_content_not_parsed_as_html():
    root = parse_html(
        '<html><head><script type="application/ld+json">{"a": "<b>not a tag</b>"}</script></head></html>'
    )
    scripts = get_scripts_by_type(root, "application/ld+json")
    assert len(scripts) == 1
    assert scripts[0].text() == '{"a": "<b>not a tag</b>"}'


def test_document_order_preserved_for_headings():
    root = parse_html("<html><body><h1>a</h1><h3>b</h3><h2>c</h2></body></html>")
    tags = [el.tag for el in root.find_all(("h1", "h2", "h3"))]
    assert tags == ["h1", "h3", "h2"]
