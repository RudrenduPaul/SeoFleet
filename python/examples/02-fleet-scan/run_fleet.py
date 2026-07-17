#!/usr/bin/env python3
"""
02 -- local multi-site fleet scan.

Demonstrates fleet mode: several local project directories, each with its
own LLMScout.json declaring a real site URL, checked in one pass via
run_fleet(). This is the library equivalent of `LLMScout fleet
<manifest.json>` -- the use case is an agency or team maintaining several
client sites as local repos and wanting one command to check them all.

This example builds a small scratch fleet on disk (two project dirs + a
manifest) pointing at two real, stable public sites, then scans it and
prints a fleet report. No files outside a temporary directory are
modified.

Run:
    python3 examples/02-fleet-scan/run_fleet.py
"""
import json
import shutil
import tempfile
from pathlib import Path

from LLMScout import run_fleet
from LLMScout.format import format_fleet_results_text

SITES = {
    "example-com": "https://example.com",
    "iana-org": "https://www.iana.org",
}


def main() -> None:
    scratch = Path(tempfile.mkdtemp(prefix="LLMScout-fleet-example-"))
    try:
        manifest_entries = []
        for name, site_url in SITES.items():
            project_dir = scratch / "clients" / name
            project_dir.mkdir(parents=True)
            (project_dir / "LLMScout.json").write_text(
                json.dumps({"siteUrl": site_url, "checks": {"technical": True, "geo": True}}, indent=2)
            )
            manifest_entries.append({"name": name, "path": f"./clients/{name}"})

        manifest_path = scratch / "fleet.json"
        manifest_path.write_text(json.dumps({"sites": manifest_entries}, indent=2))

        results = run_fleet(str(manifest_path))
        print(format_fleet_results_text(results))
    finally:
        shutil.rmtree(scratch, ignore_errors=True)


if __name__ == "__main__":
    main()
