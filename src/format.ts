import type { CheckResult } from "./types.js";
import type { FleetSiteResult } from "./fleet.js";
import type { InitResult } from "./init.js";

function statusLabel(status: CheckResult["status"]): string {
  return status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : "WARN";
}

export function summarizeResults(results: CheckResult[]): { pass: number; fail: number; warn: number } {
  return {
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    warn: results.filter((r) => r.status === "WARN").length,
  };
}

export function formatCheckResultsText(siteUrl: string, results: CheckResult[]): string {
  const lines: string[] = [`SeoFleet check -- ${siteUrl}`, ""];
  for (const r of results) {
    lines.push(`[${statusLabel(r.status)}] (${r.category}) ${r.name}`);
    lines.push(`  ${r.message}`);
    if (r.fix) lines.push(`  Fix: ${r.fix}`);
    lines.push("");
  }
  const { pass, fail, warn } = summarizeResults(results);
  lines.push(`Summary: ${pass} PASS, ${warn} WARN, ${fail} FAIL (${results.length} checks)`);
  return lines.join("\n");
}

export function formatCheckResultsJson(siteUrl: string, results: CheckResult[]): string {
  const { pass, fail, warn } = summarizeResults(results);
  return JSON.stringify(
    {
      siteUrl,
      summary: { pass, warn, fail, total: results.length },
      results,
    },
    null,
    2,
  );
}

export function formatFleetResultsText(siteResults: FleetSiteResult[]): string {
  const lines: string[] = ["SeoFleet fleet report", ""];
  for (const site of siteResults) {
    if (site.error) {
      lines.push(`[ERROR] ${site.name} (${site.path})`);
      lines.push(`  ${site.error}`);
      lines.push("");
      continue;
    }
    const { pass, fail, warn } = summarizeResults(site.results);
    lines.push(`[${site.ok ? "PASS" : "FAIL"}] ${site.name} (${site.path}) -- ${pass} PASS, ${warn} WARN, ${fail} FAIL`);
  }
  const errored = siteResults.filter((s) => s.error).length;
  const failed = siteResults.filter((s) => !s.error && !s.ok).length;
  const passed = siteResults.filter((s) => !s.error && s.ok).length;
  lines.push("");
  lines.push(`Fleet summary: ${passed} site(s) passed, ${failed} site(s) failed, ${errored} site(s) errored (${siteResults.length} total).`);
  return lines.join("\n");
}

export function formatFleetResultsJson(siteResults: FleetSiteResult[]): string {
  const errored = siteResults.filter((s) => s.error).length;
  const failed = siteResults.filter((s) => !s.error && !s.ok).length;
  const passed = siteResults.filter((s) => !s.error && s.ok).length;
  return JSON.stringify(
    {
      summary: { passed, failed, errored, total: siteResults.length },
      sites: siteResults,
    },
    null,
    2,
  );
}

export function formatInitResultText(result: InitResult): string {
  const lines: string[] = [`SeoFleet init -- ${result.projectPath}`, ""];
  lines.push(
    result.configCreated
      ? `Created ${result.configFile}`
      : `${result.configFile} already exists, left untouched`,
  );
  lines.push(
    result.skillCreated
      ? `Created ${result.skillFile}`
      : `${result.skillFile} already exists, left untouched`,
  );
  if (result.configCreated) {
    lines.push("", "Next: edit siteUrl in the config file above, then run `seofleet check <path>`.");
  }
  return lines.join("\n");
}

export function formatInitResultJson(result: InitResult): string {
  return JSON.stringify(result, null, 2);
}
