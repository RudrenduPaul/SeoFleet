"""Ported from src/fleet.ts."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import List, Optional

from .config import load_config, select_checks
from .errors import SeoFleetError
from .runner import has_failure, run_checks
from .site_resources import FetchFn, load_site
from .types import CheckResult


@dataclass
class FleetManifestEntry:
    name: str
    path: str


@dataclass
class FleetManifest:
    sites: List[FleetManifestEntry]


@dataclass
class FleetSiteResult:
    name: str
    path: str
    ok: bool
    results: List[CheckResult] = field(default_factory=list)
    error: Optional[str] = None


def load_fleet_manifest(manifest_file: str) -> FleetManifest:
    """
    Reads a fleet manifest: `{ "sites": [{ "name": ..., "path": ... }] }`.
    Relative `path` entries resolve against the manifest file's own
    directory, not the process cwd, so a manifest can be invoked from
    anywhere and still point at the right client repos.
    """
    if not os.path.exists(manifest_file):
        raise SeoFleetError(f'Fleet manifest not found: "{manifest_file}".', 2)

    try:
        with open(manifest_file, "r", encoding="utf-8") as fh:
            raw = fh.read()
    except OSError as err:
        raise SeoFleetError(f'Could not read fleet manifest "{manifest_file}": {err}', 2) from err

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as err:
        raise SeoFleetError(f'Fleet manifest "{manifest_file}" is not valid JSON: {err}', 2) from err

    if not isinstance(parsed, dict) or not isinstance(parsed.get("sites"), list):
        raise SeoFleetError(
            f'Fleet manifest "{manifest_file}" must be a JSON object with a "sites" array of {{name, path}}.',
            2,
        )

    manifest_dir = os.path.dirname(manifest_file)
    sites: List[FleetManifestEntry] = []
    for i, entry in enumerate(parsed["sites"]):
        if not isinstance(entry, dict):
            raise SeoFleetError(f'Fleet manifest entry at index {i} must be an object with {{name, path}}.', 2)
        name = entry.get("name")
        raw_path = entry.get("path")
        if not isinstance(name, str) or name.strip() == "":
            raise SeoFleetError(f'Fleet manifest entry at index {i} is missing a "name".', 2)
        if not isinstance(raw_path, str) or raw_path.strip() == "":
            raise SeoFleetError(f'Fleet manifest entry at index {i} is missing a "path".', 2)
        resolved_path = raw_path if os.path.isabs(raw_path) else os.path.normpath(os.path.join(manifest_dir, raw_path))
        sites.append(FleetManifestEntry(name=name, path=resolved_path))

    return FleetManifest(sites=sites)


def run_fleet(manifest_file: str, fetch_fn: Optional[FetchFn] = None) -> List[FleetSiteResult]:
    """
    Runs the full check suite against every site in a fleet manifest, local
    filesystem only -- each entry's `path` is read directly with
    `load_config` and its checks are run against the URL that path's own
    seofleet.json declares. There is no SSH, no remote execution, and no
    network surface beyond the individual checks' own URL fetches.
    """
    manifest = load_fleet_manifest(manifest_file)
    results: List[FleetSiteResult] = []

    for site in manifest.sites:
        try:
            config = load_config(site.path)
            ctx = load_site(config.site_url, fetch_fn)
            check_results = run_checks(select_checks(config), ctx)
            results.append(
                FleetSiteResult(
                    name=site.name,
                    path=site.path,
                    ok=not has_failure(check_results),
                    results=check_results,
                )
            )
        except Exception as err:  # noqa: BLE001 - mirrors fleet.ts's catch-per-site
            results.append(FleetSiteResult(name=site.name, path=site.path, ok=False, results=[], error=str(err)))

    return results
