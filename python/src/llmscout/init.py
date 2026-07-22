"""Ported from src/init.ts."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass

from .config import CONFIG_FILENAME, config_path, default_config
from .errors import LLMScoutError
from .fetch_utils import assert_http_url

_SKILL_RELATIVE_PATH = os.path.join(".claude", "skills", "llmscout", "SKILL.md")


@dataclass
class InitResult:
    project_path: str
    config_file: str
    config_created: bool
    skill_file: str
    skill_created: bool


def _build_skill_markdown() -> str:
    # This file is what actually replaces claude-seo's broken /plugin
    # install flow for the project it's scaffolded into: it tells Claude
    # Code to invoke this same CLI directly. There is no bundled script to
    # resolve a relative path to, and no separate toolchain-provisioning
    # step, because the checks run inside this process.
    return f"""# LLMScout

Run SEO and GEO (generative engine optimization) checks against this
project's configured site using the `llmscout` CLI.

## Usage

```
llmscout check . --json
```

This reads {CONFIG_FILENAME} in the project root for the site URL and
which check categories to run, then reports PASS/FAIL/WARN per check with
a fix suggestion for anything that isn't a clean PASS.

No relative script paths and no separate toolchain are involved -- this is
a single CLI invocation.
"""


def init_project(target_path: str, site_url: str = "") -> InitResult:
    """
    Scaffolds a working LLMScout setup into a target directory: a
    llmscout.json the `check`/`fleet` commands read, plus a minimal Claude
    Code skill file that points at this same CLI. Idempotent: an existing
    llmscout.json or SKILL.md is left untouched so re-running init never
    clobbers a user's configured siteUrl.
    """
    if site_url:
        assert_http_url(site_url)

    try:
        os.makedirs(target_path, exist_ok=True)
    except OSError as err:
        raise LLMScoutError(f'Could not create directory "{target_path}": {err}', 2) from err

    cfg_path = config_path(target_path)
    config_created = not os.path.exists(cfg_path)
    if config_created:
        config = default_config(site_url)
        with open(cfg_path, "w", encoding="utf-8") as fh:
            fh.write(json.dumps({"siteUrl": config.site_url, "checks": config.checks}, indent=2) + "\n")

    skill_path = os.path.join(target_path, _SKILL_RELATIVE_PATH)
    skill_created = not os.path.exists(skill_path)
    if skill_created:
        os.makedirs(os.path.dirname(skill_path), exist_ok=True)
        with open(skill_path, "w", encoding="utf-8") as fh:
            fh.write(_build_skill_markdown())

    return InitResult(
        project_path=target_path,
        config_file=cfg_path,
        config_created=config_created,
        skill_file=skill_path,
        skill_created=skill_created,
    )
