"""Ported from src/config.ts."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .checks import ALL_CHECKS, GEO_CHECKS, TECHNICAL_CHECKS
from .errors import SeoFleetError
from .types import Check

CONFIG_FILENAME = "seofleet.json"


@dataclass
class SeoFleetConfig:
    """
    `site_url` is the live URL that `check`/`fleet` run their checks
    against. Left blank by `init` -- the user must set it once, since
    SeoFleet has no way to infer a project's public URL from its local
    files.
    """

    site_url: str
    checks: Dict[str, bool] = field(default_factory=lambda: {"technical": True, "geo": True})


def default_config(site_url: str = "") -> SeoFleetConfig:
    return SeoFleetConfig(site_url=site_url, checks={"technical": True, "geo": True})


def config_path(project_path: str) -> str:
    return os.path.join(project_path, CONFIG_FILENAME)


def load_config(project_path: str) -> SeoFleetConfig:
    """
    Loads and validates a project's seofleet.json. Every failure mode here
    (missing file, malformed JSON, missing/blank siteUrl) is a usage error
    (exit code 2), not a check failure -- the check suite never even
    starts.
    """
    file = config_path(project_path)

    if not os.path.exists(file):
        raise SeoFleetError(
            f'No {CONFIG_FILENAME} found in "{project_path}". Run `seofleet init {project_path}` first.',
            2,
        )

    try:
        with open(file, "r", encoding="utf-8") as fh:
            raw = fh.read()
    except OSError as err:
        raise SeoFleetError(f"Could not read {file}: {err}", 2) from err

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as err:
        raise SeoFleetError(f"{file} is not valid JSON: {err}", 2) from err

    if not isinstance(parsed, dict):
        raise SeoFleetError(f"{file} must contain a JSON object.", 2)

    site_url = parsed.get("siteUrl")
    if not isinstance(site_url, str) or site_url.strip() == "":
        raise SeoFleetError(
            f'{file} has no siteUrl configured. Edit the file and set "siteUrl" to your site\'s URL.',
            2,
        )

    checks_raw = parsed.get("checks")
    if isinstance(checks_raw, dict):
        checks = {
            "technical": checks_raw.get("technical") is not False,
            "geo": checks_raw.get("geo") is not False,
        }
    else:
        checks = {"technical": True, "geo": True}

    return SeoFleetConfig(site_url=site_url, checks=checks)


def select_checks(config: SeoFleetConfig) -> List[Check]:
    """Selects which checks to run based on a loaded config's `checks` flags."""
    technical = config.checks.get("technical") is not False
    geo = config.checks.get("geo") is not False
    if technical and geo:
        return ALL_CHECKS
    if technical:
        return TECHNICAL_CHECKS
    if geo:
        return GEO_CHECKS
    return []
