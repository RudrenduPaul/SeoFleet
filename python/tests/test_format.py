"""Ported from test/format.test.ts."""
from __future__ import annotations

import json

from seofleet.format import format_check_results_json, format_check_results_text, summarize_results
from seofleet.init import InitResult
from seofleet.format import format_init_result_json, format_init_result_text
from seofleet.types import CheckResult


def _sample_results():
    return [
        CheckResult("title", "Title tag", "technical", "PASS", "ok"),
        CheckResult("meta-description", "Meta description", "technical", "WARN", "missing", "add one"),
        CheckResult("robots-txt", "robots.txt", "technical", "FAIL", "unreachable", "add a file"),
    ]


def test_summarize_results_counts_each_status():
    summary = summarize_results(_sample_results())
    assert summary == {"pass": 1, "warn": 1, "fail": 1}


def test_format_check_results_text_includes_fix_only_when_present():
    text = format_check_results_text("https://example.com", _sample_results())
    assert "Fix: add one" in text
    assert "Fix: add a file" in text
    assert "SeoFleet check -- https://example.com" in text
    assert "Summary: 1 PASS, 1 WARN, 1 FAIL (3 checks)" in text


def test_format_check_results_json_omits_fix_when_absent():
    payload = json.loads(format_check_results_json("https://example.com", _sample_results()))
    assert payload["siteUrl"] == "https://example.com"
    assert payload["summary"] == {"pass": 1, "warn": 1, "fail": 1, "total": 3}
    title_entry = next(r for r in payload["results"] if r["id"] == "title")
    assert "fix" not in title_entry
    warn_entry = next(r for r in payload["results"] if r["id"] == "meta-description")
    assert warn_entry["fix"] == "add one"


def test_format_init_result_text_created():
    result = InitResult("proj", "proj/seofleet.json", True, "proj/.claude/skills/seofleet/SKILL.md", True)
    text = format_init_result_text(result)
    assert "Created proj/seofleet.json" in text
    assert "Next:" in text


def test_format_init_result_text_already_exists():
    result = InitResult("proj", "proj/seofleet.json", False, "proj/.claude/skills/seofleet/SKILL.md", False)
    text = format_init_result_text(result)
    assert "already exists, left untouched" in text
    assert "Next:" not in text


def test_format_init_result_json_roundtrips():
    result = InitResult("proj", "proj/seofleet.json", True, "proj/skill.md", True)
    payload = json.loads(format_init_result_json(result))
    assert payload["projectPath"] == "proj"
    assert payload["configCreated"] is True
