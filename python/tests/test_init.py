"""Ported from test/init.test.ts."""
from __future__ import annotations

import json
import os

import pytest

from seofleet.errors import SeoFleetError
from seofleet.init import init_project


def test_init_project_creates_config_and_skill_file(tmp_path):
    result = init_project(str(tmp_path), "https://example.com")
    assert result.config_created is True
    assert result.skill_created is True
    assert os.path.exists(result.config_file)
    assert os.path.exists(result.skill_file)

    with open(result.config_file) as fh:
        config = json.load(fh)
    assert config["siteUrl"] == "https://example.com"
    assert config["checks"] == {"technical": True, "geo": True}


def test_init_project_is_idempotent(tmp_path):
    init_project(str(tmp_path), "https://example.com")
    with open(os.path.join(str(tmp_path), "seofleet.json"), "w") as fh:
        fh.write(json.dumps({"siteUrl": "https://custom.example", "checks": {"technical": True, "geo": True}}))

    result = init_project(str(tmp_path))
    assert result.config_created is False
    assert result.skill_created is False

    with open(result.config_file) as fh:
        config = json.load(fh)
    assert config["siteUrl"] == "https://custom.example"  # left untouched


def test_init_project_rejects_invalid_site_url(tmp_path):
    with pytest.raises(SeoFleetError):
        init_project(str(tmp_path), "not-a-url")


def test_init_project_without_site_url_leaves_it_blank(tmp_path):
    result = init_project(str(tmp_path))
    with open(result.config_file) as fh:
        config = json.load(fh)
    assert config["siteUrl"] == ""
