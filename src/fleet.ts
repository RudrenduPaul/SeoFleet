import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { SeoFleetError } from "./errors.js";
import { loadConfig, selectChecks } from "./config.js";
import { loadSite, type FetchFn } from "./site-resources.js";
import { runChecks, hasFailure } from "./runner.js";
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
    throw new SeoFleetError(`Fleet manifest not found: "${manifestFile}".`, 2);
  }

  let raw: string;
  try {
    raw = readFileSync(manifestFile, "utf-8");
  } catch (err) {
    throw new SeoFleetError(
      `Could not read fleet manifest "${manifestFile}": ${err instanceof Error ? err.message : String(err)}`,
      2,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new SeoFleetError(
      `Fleet manifest "${manifestFile}" is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      2,
    );
  }

  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Record<string, unknown>)["sites"])) {
    throw new SeoFleetError(
      `Fleet manifest "${manifestFile}" must be a JSON object with a "sites" array of {name, path}.`,
      2,
    );
  }

  const sitesRaw = (parsed as Record<string, unknown>)["sites"] as unknown[];
  const manifestDir = path.dirname(manifestFile);

  const sites: FleetManifestEntry[] = sitesRaw.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new SeoFleetError(`Fleet manifest entry at index ${i} must be an object with {name, path}.`, 2);
    }
    const obj = entry as Record<string, unknown>;
    const name = obj["name"];
    const rawPath = obj["path"];
    if (typeof name !== "string" || name.trim() === "") {
      throw new SeoFleetError(`Fleet manifest entry at index ${i} is missing a "name".`, 2);
    }
    if (typeof rawPath !== "string" || rawPath.trim() === "") {
      throw new SeoFleetError(`Fleet manifest entry at index ${i} is missing a "path".`, 2);
    }
    const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(manifestDir, rawPath);
    return { name, path: resolvedPath };
  });

  return { sites };
}

/**
 * Runs the full check suite against every site in a fleet manifest, local
 * filesystem only -- each entry's `path` is read directly with `loadConfig`
 * and its checks are run against the URL that path's own seofleet.json
 * declares. There is no SSH, no remote execution, and no network surface
 * beyond the individual checks' own URL fetches.
 */
export async function runFleet(manifestFile: string, fetchFn?: FetchFn): Promise<FleetSiteResult[]> {
  const manifest = loadFleetManifest(manifestFile);
  const results: FleetSiteResult[] = [];

  for (const site of manifest.sites) {
    try {
      const config = loadConfig(site.path);
      const ctx = await loadSite(config.siteUrl, fetchFn);
      const checkResults = await runChecks(selectChecks(config), ctx);
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
