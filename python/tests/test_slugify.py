"""Ported from test/slugify.test.ts."""
from __future__ import annotations

from seofleet.slugify import slugify


def test_slugify_strips_scheme_and_collapses_url_into_one_slug():
    assert slugify("https://good.example/blog/post") == "good-example-blog-post"


def test_slugify_lowercases_and_hyphenates_a_plain_manifest_name():
    assert slugify("Client A") == "client-a"


def test_slugify_collapses_runs_of_punctuation_into_a_single_hyphen():
    assert slugify("https://good.example:8080/a//b--c") == "good-example-8080-a-b-c"


def test_slugify_trims_leading_and_trailing_hyphens():
    assert slugify("-- weird --") == "weird"


def test_slugify_falls_back_to_site_for_input_that_slugifies_to_nothing():
    assert slugify("") == "site"
    assert slugify("://///") == "site"
