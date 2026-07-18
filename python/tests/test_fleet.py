"""Ported from test/fleet.test.ts."""
from __future__ import annotations

import json

import pytest

from seofleet.errors import SeoFleetError
from seofleet.fleet import load_fleet_manifest, run_fleet

from .conftest import GOOD_HTML, make_fetch_stub


def test_load_fleet_manifest_missing_file_raises(tmp_path):
    with pytest.raises(SeoFleetError):
        load_fleet_manifest(str(tmp_path / "nope.json"))


def test_load_fleet_manifest_invalid_json_raises(tmp_path):
    manifest = tmp_path / "fleet.json"
    manifest.write_text("{not json")
    with pytest.raises(SeoFleetError):
        load_fleet_manifest(str(manifest))


def test_load_fleet_manifest_missing_sites_array_raises(tmp_path):
    manifest = tmp_path / "fleet.json"
    manifest.write_text(json.dumps({}))
    with pytest.raises(SeoFleetError):
        load_fleet_manifest(str(manifest))


def test_load_fleet_manifest_resolves_relative_paths_against_manifest_dir(tmp_path):
    manifest = tmp_path / "fleet.json"
    manifest.write_text(json.dumps({"sites": [{"name": "a", "path": "./clients/a"}]}))
    result = load_fleet_manifest(str(manifest))
    assert result.sites[0].path == str(tmp_path / "clients" / "a")


def test_load_fleet_manifest_entry_missing_name_raises(tmp_path):
    manifest = tmp_path / "fleet.json"
    manifest.write_text(json.dumps({"sites": [{"path": "./a"}]}))
    with pytest.raises(SeoFleetError):
        load_fleet_manifest(str(manifest))


def test_run_fleet_reports_error_for_bad_site_config(tmp_path):
    manifest = tmp_path / "fleet.json"
    manifest.write_text(json.dumps({"sites": [{"name": "broken", "path": "./missing"}]}))
    results = run_fleet(str(manifest))
    assert len(results) == 1
    assert results[0].error is not None
    assert results[0].ok is False


def test_run_fleet_runs_checks_for_valid_site(tmp_path):
    site_dir = tmp_path / "clients" / "a"
    site_dir.mkdir(parents=True)
    (site_dir / "seofleet.json").write_text(json.dumps({"siteUrl": "https://acme.example/"}))
    manifest = tmp_path / "fleet.json"
    manifest.write_text(json.dumps({"sites": [{"name": "a", "path": "./clients/a"}]}))

    stub = make_fetch_stub({"https://acme.example/": {"body": GOOD_HTML, "status": 200}})
    results = run_fleet(str(manifest), fetch_fn=stub)

    assert len(results) == 1
    assert results[0].error is None
    assert len(results[0].results) == 21
