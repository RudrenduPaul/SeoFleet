"""Ported from test/config.test.ts."""
from __future__ import annotations

import json

import pytest

from llmscout.checks import ALL_CHECKS, GEO_CHECKS, TECHNICAL_CHECKS
from llmscout.config import LLMScoutConfig, default_config, load_config, select_checks
from llmscout.errors import LLMScoutError


def test_default_config_has_both_categories_enabled():
    config = default_config("https://example.com")
    assert config.checks == {"technical": True, "geo": True}


def test_load_config_missing_file_raises(tmp_path):
    with pytest.raises(LLMScoutError):
        load_config(str(tmp_path))


def test_load_config_invalid_json_raises(tmp_path):
    (tmp_path / "llmscout.json").write_text("{not json")
    with pytest.raises(LLMScoutError):
        load_config(str(tmp_path))


def test_load_config_missing_site_url_raises(tmp_path):
    (tmp_path / "llmscout.json").write_text(json.dumps({"checks": {}}))
    with pytest.raises(LLMScoutError):
        load_config(str(tmp_path))


def test_load_config_blank_site_url_raises(tmp_path):
    (tmp_path / "llmscout.json").write_text(json.dumps({"siteUrl": "   "}))
    with pytest.raises(LLMScoutError):
        load_config(str(tmp_path))


def test_load_config_valid(tmp_path):
    (tmp_path / "llmscout.json").write_text(json.dumps({"siteUrl": "https://example.com"}))
    config = load_config(str(tmp_path))
    assert config.site_url == "https://example.com"
    assert config.checks == {"technical": True, "geo": True}


def test_load_config_respects_disabled_category(tmp_path):
    (tmp_path / "llmscout.json").write_text(
        json.dumps({"siteUrl": "https://example.com", "checks": {"geo": False}})
    )
    config = load_config(str(tmp_path))
    assert config.checks == {"technical": True, "geo": False}


def test_select_checks_both():
    assert select_checks(LLMScoutConfig("x", {"technical": True, "geo": True})) == ALL_CHECKS


def test_select_checks_technical_only():
    assert select_checks(LLMScoutConfig("x", {"technical": True, "geo": False})) == TECHNICAL_CHECKS


def test_select_checks_geo_only():
    assert select_checks(LLMScoutConfig("x", {"technical": False, "geo": True})) == GEO_CHECKS


def test_select_checks_none():
    assert select_checks(LLMScoutConfig("x", {"technical": False, "geo": False})) == []
