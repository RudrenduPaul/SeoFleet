"""Ported from src/format.ts."""
from __future__ import annotations

import json
from typing import Dict, List

from .fleet import FleetSiteResult
from .init import InitResult
from .types import CheckResult


def summarize_results(results: List[CheckResult]) -> Dict[str, int]:
    return {
        "pass": sum(1 for r in results if r.status == "PASS"),
        "fail": sum(1 for r in results if r.status == "FAIL"),
        "warn": sum(1 for r in results if r.status == "WARN"),
    }


def format_check_results_text(site_url: str, results: List[CheckResult]) -> str:
    lines: List[str] = [f"SeoFleet check -- {site_url}", ""]
    for r in results:
        lines.append(f"[{r.status}] ({r.category}) {r.name}")
        lines.append(f"  {r.message}")
        if r.fix:
            lines.append(f"  Fix: {r.fix}")
        lines.append("")
    summary = summarize_results(results)
    lines.append(f"Summary: {summary['pass']} PASS, {summary['warn']} WARN, {summary['fail']} FAIL ({len(results)} checks)")
    return "\n".join(lines)


def format_check_results_json(site_url: str, results: List[CheckResult]) -> str:
    summary = summarize_results(results)
    return json.dumps(
        {
            "siteUrl": site_url,
            "summary": {"pass": summary["pass"], "warn": summary["warn"], "fail": summary["fail"], "total": len(results)},
            "results": [r.to_dict() for r in results],
        },
        indent=2,
    )


def format_fleet_results_text(site_results: List[FleetSiteResult]) -> str:
    lines: List[str] = ["SeoFleet fleet report", ""]
    for site in site_results:
        if site.error:
            lines.append(f"[ERROR] {site.name} ({site.path})")
            lines.append(f"  {site.error}")
            lines.append("")
            continue
        summary = summarize_results(site.results)
        status = "PASS" if site.ok else "FAIL"
        lines.append(
            f"[{status}] {site.name} ({site.path}) -- {summary['pass']} PASS, {summary['warn']} WARN, {summary['fail']} FAIL"
        )
    errored = sum(1 for s in site_results if s.error)
    failed = sum(1 for s in site_results if not s.error and not s.ok)
    passed = sum(1 for s in site_results if not s.error and s.ok)
    lines.append("")
    lines.append(f"Fleet summary: {passed} site(s) passed, {failed} site(s) failed, {errored} site(s) errored ({len(site_results)} total).")
    return "\n".join(lines)


def format_fleet_results_json(site_results: List[FleetSiteResult]) -> str:
    errored = sum(1 for s in site_results if s.error)
    failed = sum(1 for s in site_results if not s.error and not s.ok)
    passed = sum(1 for s in site_results if not s.error and s.ok)
    sites = []
    for s in site_results:
        entry: Dict[str, object] = {"name": s.name, "path": s.path, "ok": s.ok, "results": [r.to_dict() for r in s.results]}
        if s.error is not None:
            entry["error"] = s.error
        sites.append(entry)
    return json.dumps(
        {"summary": {"passed": passed, "failed": failed, "errored": errored, "total": len(site_results)}, "sites": sites},
        indent=2,
    )


def format_init_result_text(result: InitResult) -> str:
    lines: List[str] = [f"SeoFleet init -- {result.project_path}", ""]
    lines.append(f"Created {result.config_file}" if result.config_created else f"{result.config_file} already exists, left untouched")
    lines.append(f"Created {result.skill_file}" if result.skill_created else f"{result.skill_file} already exists, left untouched")
    if result.config_created:
        lines.append("")
        lines.append("Next: edit siteUrl in the config file above, then run `seofleet check <path>`.")
    return "\n".join(lines)


def format_init_result_json(result: InitResult) -> str:
    return json.dumps(
        {
            "projectPath": result.project_path,
            "configFile": result.config_file,
            "configCreated": result.config_created,
            "skillFile": result.skill_file,
            "skillCreated": result.skill_created,
        },
        indent=2,
    )
