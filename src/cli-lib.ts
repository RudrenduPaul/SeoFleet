import { existsSync, statSync } from "node:fs";
import { LLMScoutError } from "./errors.js";
import { initProject } from "./init.js";
import { loadConfig, selectChecks } from "./config.js";
import { loadSite, type FetchFn } from "./site-resources.js";
import { withUserAgent } from "./fetch-utils.js";
import { runChecks, hasFailure } from "./runner.js";
import { runFleet } from "./fleet.js";
import { writeReportFile } from "./report-file.js";
import {
  formatCheckResultsJson,
  formatCheckResultsText,
  formatFleetResultsJson,
  formatFleetResultsText,
  formatInitResultJson,
  formatInitResultText,
} from "./format.js";

export interface CommandOutput {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

function errorOutput(err: unknown): CommandOutput {
  if (err instanceof LLMScoutError) {
    return { exitCode: err.exitCode, stderr: `Error: ${err.message}` };
  }
  return { exitCode: 2, stderr: `Error: ${err instanceof Error ? err.message : String(err)}` };
}

function requireDirectory(targetPath: string): void {
  if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
    throw new LLMScoutError(`"${targetPath}" is not a directory.`, 2);
  }
}

/**
 * An explicitly-passed `fetchFn` (tests' fetch stubs) always wins. Failing
 * that, a `--user-agent` override becomes a FetchFn of its own; otherwise
 * fall through to `undefined` so loadSite/runFleet use safeFetch's own
 * DEFAULT_USER_AGENT.
 */
function resolveFetchFn(userAgent: string | undefined, fetchFn: FetchFn | undefined): FetchFn | undefined {
  if (fetchFn) return fetchFn;
  return userAgent !== undefined ? withUserAgent(userAgent) : undefined;
}

export function runInitCommand(targetPath: string, opts: { siteUrl?: string; json: boolean }): CommandOutput {
  try {
    const result = initProject(targetPath, opts.siteUrl !== undefined ? { siteUrl: opts.siteUrl } : {});
    const stdout = opts.json ? formatInitResultJson(result) : formatInitResultText(result);
    return { exitCode: 0, stdout };
  } catch (err) {
    return errorOutput(err);
  }
}

export async function runCheckCommand(
  targetPath: string,
  opts: { json: boolean; userAgent?: string; outDir?: string },
  fetchFn?: FetchFn,
): Promise<CommandOutput> {
  try {
    requireDirectory(targetPath);
    const config = loadConfig(targetPath);
    const ctx = await loadSite(config.siteUrl, resolveFetchFn(opts.userAgent, fetchFn));
    const results = await runChecks(selectChecks(config), ctx);
    const stdout = opts.json
      ? formatCheckResultsJson(config.siteUrl, results)
      : formatCheckResultsText(config.siteUrl, results);

    let stderr: string | undefined;
    if (opts.outDir) {
      const reportFile = writeReportFile(opts.outDir, config.siteUrl, opts.json, stdout);
      stderr = `Report written to: ${reportFile}`;
    }

    return { exitCode: hasFailure(results) ? 1 : 0, stdout, ...(stderr !== undefined ? { stderr } : {}) };
  } catch (err) {
    return errorOutput(err);
  }
}

export async function runFleetCommand(
  manifestPath: string,
  opts: { json: boolean; userAgent?: string; outDir?: string },
  fetchFn?: FetchFn,
): Promise<CommandOutput> {
  try {
    const siteResults = await runFleet(manifestPath, resolveFetchFn(opts.userAgent, fetchFn), {
      ...(opts.outDir !== undefined ? { outDir: opts.outDir } : {}),
      json: opts.json,
    });
    const stdout = opts.json ? formatFleetResultsJson(siteResults) : formatFleetResultsText(siteResults);
    const anyFailure = siteResults.some((s) => s.error !== undefined || !s.ok);

    let stderr: string | undefined;
    if (opts.outDir) {
      const written = siteResults.filter((s) => s.error === undefined).length;
      stderr = `Wrote ${written} report file(s) to: ${opts.outDir}`;
    }

    return { exitCode: anyFailure ? 1 : 0, stdout, ...(stderr !== undefined ? { stderr } : {}) };
  } catch (err) {
    return errorOutput(err);
  }
}
