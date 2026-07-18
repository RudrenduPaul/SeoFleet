"""
Ported from test/integration.test.ts. Runs the full init -> check pipeline
against a scratch directory, all "network" calls served by a fetch stub --
no real network calls in the automated suite (a real live-site run was
verified manually against https://example.com and matches the npm CLI's
own documented README output byte-for-byte; see python/README.md).
"""
from __future__ import annotations

import json

from seofleet.cli_lib import run_check_command, run_init_command

from .conftest import GOOD_HTML, GOOD_ROBOTS_TXT, GOOD_SITEMAP_XML, make_fetch_stub


def test_init_then_check_end_to_end(tmp_path):
    project = tmp_path / "my-project"

    init_result = run_init_command(str(project), "https://good.example/", json_output=False)
    assert init_result.exit_code == 0
    assert (project / "seofleet.json").exists()
    assert (project / ".claude" / "skills" / "seofleet" / "SKILL.md").exists()

    config = json.loads((project / "seofleet.json").read_text())
    assert config["siteUrl"] == "https://good.example/"

    fetch_stub = make_fetch_stub(
        {
            "https://good.example/": {"body": GOOD_HTML},
            "https://good.example/robots.txt": {"body": GOOD_ROBOTS_TXT},
            "https://good.example/sitemap.xml": {"body": GOOD_SITEMAP_XML},
            "https://good.example/llms.txt": {"status": 404, "ok": False},
        }
    )

    check_result = run_check_command(str(project), json_output=True, fetch_fn=fetch_stub)
    assert check_result.exit_code == 0
    parsed = json.loads(check_result.stdout)
    assert len(parsed["results"]) == 17
    assert parsed["summary"]["fail"] == 0


def test_init_is_idempotent_and_check_still_works(tmp_path):
    project = tmp_path / "my-project-2"
    run_init_command(str(project), "https://good.example/", json_output=False)
    second = run_init_command(str(project), None, json_output=False)
    assert second.exit_code == 0
    assert "already exists" in second.stdout

    fetch_stub = make_fetch_stub(
        {
            "https://good.example/": {"body": GOOD_HTML},
            "https://good.example/robots.txt": {"body": GOOD_ROBOTS_TXT},
            "https://good.example/sitemap.xml": {"body": GOOD_SITEMAP_XML},
            "https://good.example/llms.txt": {"status": 404, "ok": False},
        }
    )
    check_result = run_check_command(str(project), json_output=False, fetch_fn=fetch_stub)
    assert check_result.exit_code == 0
