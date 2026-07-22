import { existsSync, mkdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { LLMScoutError } from "./errors.js";
import { loadConfig, selectChecks } from "./config.js";
import { loadSite, type FetchFn } from "./site-resources.js";
import { runChecks, hasFailure } from "./runner.js";
import { formatCheckResultsJson, formatCheckResultsText } from "./format.js";
import { writeReportFile } from "./report-file.js";
import type { CheckResult } from "./types.js";

export interface FleetManifestEntry {
  name: string;
  path: string;
}

export interface FleetManifest {
  sites: FleetManifestEntry[];
}

export interface FleetSiteResult {
  name: string;
  path: string;
  ok: boolean;
  results: CheckResult[];
  error?: string;
}

/**
 * Reads a fleet manifest: `{ "sites": [{ "name": ..., "path": ... }] }`.
 * Relative `path` entries resolve against the manifest file's own
 * directory, not the process cwd, so a manifest can be invoked from
 * anywhere and still point at the right client repos.
 */
export function loadFleetManifest(manifestFile: string): FleetManifest {
  if (!existsSync(manifestFile)) {
    throw new LLMScoutError(`Fleet manifest not found: "${manifestFile}".`, 2);
  }

  let raw: string;
  try {
    raw = readFileSync(manifestFile, "utf-8");
  } catch (err) {
    throw new LLMScoutError(
      `Could not read fleet manifest "${manifestFile}": ${err instanceof Error ? err.message : String(err)}`,
      2,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new LLMScoutError(
      `Fleet manifest "${manifestFile}" is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      2,
    );
  }

  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Record<string, unknown>)["sites"])) {
    throw new LLMScoutError(
      `Fleet manifest "${manifestFile}" must be a JSON object with a "sites" array of {name, path}.`,
      2,
    );
  }

  const sitesRaw = (parsed as Record<string, unknown>)["sites"] as unknown[];
  const manifestDir = path.dirname(manifestFile);

  const sites: FleetManifestEntry[] = sitesRaw.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new LLMScoutError(`Fleet manifest entry at index ${i} must be an object with {name, path}.`, 2);
    }
    const obj = entry as Record<string, unknown>;
    const name = obj["name"];
    const rawPath = obj["path"];
    if (typeof name !== "string" || name.trim() === "") {
      throw new LLMScoutError(`Fleet manifest entry at index ${i} is missing a "name".`, 2);
    }
    if (typeof rawPath !== "string" || rawPath.trim() === "") {
      throw new LLMScoutError(`Fleet manifest entry at index ${i} is missing a "path".`, 2);
    }
    const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(manifestDir, rawPath);
    return { name, path: resolvedPath };
  });

  return { sites };
}

export interface RunFleetOptions {
  /**
   * When set, writes one auto-named report file per successfully-checked
   * site into this directory -- LLMScout's agency/fleet differentiator:
   * a caller checking many client sites at once gets one file per site
   * instead of manually shell-redirecting and naming each one. The
   * filename stem is derived from the manifest entry's own `name` field
   * (already guaranteed distinct-per-entry by loadFleetManifest), not the
   * site's URL, since that's the identifier the fleet operator chose.
   * Sites that error before producing check results (e.g. a missing
   * llmscout.json) are not written -- there's nothing to report yet.
   */
  outDir?: string;
  /** Write JSON report files when true, human-readable text otherwise. */
  json?: boolean;
}

/**
 * Runs the full check suite against every site in a fleet manifest, local
 * filesystem only -- each entry's `path` is read directly with `loadConfig`
 * and its checks are run against the URL that path's own llmscout.json
 * declares. There is no SSH, no remote execution, and no network surface
 * beyond the individual checks' own URL fetches.
 */
export async function runFleet(
  manifestFile: string,
  fetchFn?: FetchFn,
  opts: RunFleetOptions = {},
): Promise<FleetSiteResult[]> {
  const manifest = loadFleetManifest(manifestFile);
  const results: FleetSiteResult[] = [];
  const usedStems = new Map<string, number>();

  // Created once, up front, outside the per-site try/catch below -- so a
  // bad --out-dir (e.g. permission denied) surfaces as one clean top-level
  // error instead of being swallowed as an identical per-site "error" on
  // every single manifest entry.
  if (opts.outDir) {
    try {
      mkdirSync(opts.outDir, { recursive: true });
    } catch (err) {
      throw new LLMScoutError(
        `Could not create --out-dir "${opts.outDir}": ${err instanceof Error ? err.message : String(err)}`,
        2,
      );
    }
  }

  for (const site of manifest.sites) {
    try {
      const config = loadConfig(site.path);
      const ctx = await loadSite(config.siteUrl, fetchFn);
      const checkResults = await runChecks(selectChecks(config), ctx);

      if (opts.outDir) {
        const reportContent = opts.json
          ? formatCheckResultsJson(config.siteUrl, checkResults)
          : formatCheckResultsText(config.siteUrl, checkResults);
        writeReportFile(opts.outDir, site.name, opts.json ?? false, reportContent, usedStems);
      }

      results.push({ name: site.name, path: site.path, ok: !hasFailure(checkResults), results: checkResults });
    } catch (err) {
      results.push({
        name: site.name,
        path: site.path,
        ok: false,
        results: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
