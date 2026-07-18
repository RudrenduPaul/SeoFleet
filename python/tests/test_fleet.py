"""Ported from test/fleet.test.ts."""
from __future__ import annotations

import json
import os

import pytest

from seofleet.errors import SeoFleetError
from seofleet.fleet import load_fleet_manifest, run_fleet

from .conftest import GOOD_HTML, GOOD_ROBOTS_TXT, GOOD_SITEMAP_XML, make_fetch_stub


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


def _write_client_config(client_dir, site_url: str) -> None:
    client_dir.mkdir(parents=True)
    (client_dir / "seofleet.json").write_text(json.dumps({"siteUrl": site_url}))


def test_run_fleet_writes_one_txt_report_file_per_site_named_from_manifest_name(tmp_path):
    _write_client_config(tmp_path / "client-a", "https://good.example/")
    _write_client_config(tmp_path / "client-b", "https://bad.example/")
    manifest = tmp_path / "fleet.json"
    manifest.write_text(json.dumps({"sites": [
        {"name": "Client A", "path": "./client-a"},
        {"name": "Client B", "path": "./client-b"},
    ]}))

    stub = make_fetch_stub({
        "https://good.example/": {"body": GOOD_HTML, "status": 200},
        "https://good.example/robots.txt": {"body": GOOD_ROBOTS_TXT, "status": 200},
        "https://good.example/sitemap.xml": {"body": GOOD_SITEMAP_XML, "status": 200},
        "https://good.example/llms.txt": {"status": 404, "ok": False},
        "https://bad.example/": {"status": 500, "ok": False},
        "https://bad.example/robots.txt": {"status": 404, "ok": False},
        "https://bad.example/sitemap.xml": {"status": 404, "ok": False},
        "https://bad.example/llms.txt": {"status": 404, "ok": False},
    })

    out_dir = str(tmp_path / "reports")
    run_fleet(str(manifest), fetch_fn=stub, out_dir=out_dir)

    written = sorted(os.listdir(out_dir))
    assert written == ["client-a.txt", "client-b.txt"]
    with open(os.path.join(out_dir, "client-a.txt"), "r", encoding="utf-8") as fh:
        assert "SeoFleet check -- https://good.example/" in fh.read()
    with open(os.path.join(out_dir, "client-b.txt"), "r", encoding="utf-8") as fh:
        assert "FAIL" in fh.read()


def test_run_fleet_writes_json_report_files_when_json_output_true(tmp_path):
    _write_client_config(tmp_path / "client-a", "https://good.example/")
    manifest = tmp_path / "fleet.json"
    manifest.write_text(json.dumps({"sites": [{"name": "client-a", "path": "./client-a"}]}))
    stub = make_fetch_stub({
        "https://good.example/": {"body": GOOD_HTML, "status": 200},
        "https://good.example/robots.txt": {"body": GOOD_ROBOTS_TXT, "status": 200},
        "https://good.example/sitemap.xml": {"body": GOOD_SITEMAP_XML, "status": 200},
        "https://good.example/llms.txt": {"status": 404, "ok": False},
    })

    out_dir = str(tmp_path / "reports")
    run_fleet(str(manifest), fetch_fn=stub, out_dir=out_dir, json_output=True)

    file_path = os.path.join(out_dir, "client-a.json")
    assert os.path.exists(file_path)
    with open(file_path, "r", encoding="utf-8") as fh:
        json.loads(fh.read())  # does not raise


def test_run_fleet_does_not_write_report_for_a_site_that_errors(tmp_path):
    manifest = tmp_path / "fleet.json"
    manifest.write_text(json.dumps({"sites": [{"name": "broken", "path": "./missing"}]}))
    out_dir = str(tmp_path / "reports")

    results = run_fleet(str(manifest), out_dir=out_dir)
    assert results[0].error is not None
    assert os.path.exists(out_dir)  # still created up front
    assert os.listdir(out_dir) == []


def test_run_fleet_writes_nothing_when_out_dir_not_passed(tmp_path):
    _write_client_config(tmp_path / "client-a", "https://good.example/")
    manifest = tmp_path / "fleet.json"
    manifest.write_text(json.dumps({"sites": [{"name": "client-a", "path": "./client-a"}]}))
    stub = make_fetch_stub({
        "https://good.example/": {"body": GOOD_HTML, "status": 200},
        "https://good.example/robots.txt": {"body": GOOD_ROBOTS_TXT, "status": 200},
        "https://good.example/sitemap.xml": {"body": GOOD_SITEMAP_XML, "status": 200},
        "https://good.example/llms.txt": {"status": 404, "ok": False},
    })

    run_fleet(str(manifest), fetch_fn=stub)
    assert not os.path.exists(str(tmp_path / "reports"))
