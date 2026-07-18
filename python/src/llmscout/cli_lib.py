"""Ported from src/cli-lib.ts."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from .config import load_config, select_checks
from .errors import LLMScoutError
from .fetch_utils import with_user_agent
from .fleet import run_fleet
from .format import (
    format_check_results_json,
    format_check_results_text,
    format_fleet_results_json,
    format_fleet_results_text,
    format_init_result_json,
    format_init_result_text,
)
from .init import init_project
from .report_file import write_report_file
from .runner import has_failure, run_checks
from .site_resources import FetchFn, load_site


@dataclass
class CommandOutput:
    exit_code: int
    stdout: Optional[str] = None
    stderr: Optional[str] = None


def _error_output(err: Exception) -> CommandOutput:
    if isinstance(err, LLMScoutError):
        return CommandOutput(exit_code=err.exit_code, stderr=f"Error: {err.message}")
    return CommandOutput(exit_code=2, stderr=f"Error: {err}")


def _require_directory(target_path: str) -> None:
    if not os.path.isdir(target_path):
        raise LLMScoutError(f'"{target_path}" is not a directory.', 2)


def _resolve_fetch_fn(user_agent: Optional[str], fetch_fn: Optional[FetchFn]) -> Optional[FetchFn]:
    """An explicitly-passed `fetch_fn` (tests' fetch stubs) always wins.
    Failing that, a `--user-agent` override becomes a FetchFn of its own;
    otherwise fall through to `None` so load_site/run_fleet use safe_fetch's
    own DEFAULT_USER_AGENT."""
    if fetch_fn is not None:
        return fetch_fn
    return with_user_agent(user_agent) if user_agent is not None else None


def run_init_command(target_path: str, site_url: Optional[str], json_output: bool) -> CommandOutput:
    try:
        result = init_project(target_path, site_url or "")
        stdout = format_init_result_json(result) if json_output else format_init_result_text(result)
        return CommandOutput(exit_code=0, stdout=stdout)
    except Exception as err:  # noqa: BLE001 - mirrors cli-lib.ts's catch-all
        return _error_output(err)


def run_check_command(
    target_path: str,
    json_output: bool,
    fetch_fn: Optional[FetchFn] = None,
    user_agent: Optional[str] = None,
    out_dir: Optional[str] = None,
) -> CommandOutput:
    try:
        _require_directory(target_path)
        config = load_config(target_path)
        ctx = load_site(config.site_url, _resolve_fetch_fn(user_agent, fetch_fn))
        results = run_checks(select_checks(config), ctx)
        stdout = format_check_results_json(config.site_url, results) if json_output else format_check_results_text(config.site_url, results)

        stderr = None
        if out_dir:
            report_file = write_report_file(out_dir, config.site_url, json_output, stdout)
            stderr = f"Report written to: {report_file}"

        return CommandOutput(exit_code=1 if has_failure(results) else 0, stdout=stdout, stderr=stderr)
    except Exception as err:  # noqa: BLE001
        return _error_output(err)


def run_fleet_command(
    manifest_path: str,
    json_output: bool,
    fetch_fn: Optional[FetchFn] = None,
    user_agent: Optional[str] = None,
    out_dir: Optional[str] = None,
) -> CommandOutput:
    try:
        site_results = run_fleet(manifest_path, _resolve_fetch_fn(user_agent, fetch_fn), out_dir=out_dir, json_output=json_output)
        stdout = format_fleet_results_json(site_results) if json_output else format_fleet_results_text(site_results)
        any_failure = any(s.error is not None or not s.ok for s in site_results)

        stderr = None
        if out_dir:
            written = sum(1 for s in site_results if s.error is None)
            stderr = f"Wrote {written} report file(s) to: {out_dir}"

        return CommandOutput(exit_code=1 if any_failure else 0, stdout=stdout, stderr=stderr)
    except Exception as err:  # noqa: BLE001
        return _error_output(err)
