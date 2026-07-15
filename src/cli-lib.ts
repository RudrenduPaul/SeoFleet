import { existsSync, statSync } from "node:fs";
import { SeoFleetError } from "./errors.js";
import { initProject } from "./init.js";
import { loadConfig, selectChecks } from "./config.js";
import { loadSite, type FetchFn } from "./site-resources.js";
import { runChecks, hasFailure } from "./runner.js";
import { runFleet } from "./fleet.js";
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
  if (err instanceof SeoFleetError) {
    return { exitCode: err.exitCode, stderr: `Error: ${err.message}` };
  }
  return { exitCode: 2, stderr: `Error: ${err instanceof Error ? err.message : String(err)}` };
}

function requireDirectory(targetPath: string): void {
  if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
    throw new SeoFleetError(`"${targetPath}" is not a directory.`, 2);
  }
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
  opts: { json: boolean },
  fetchFn?: FetchFn,
): Promise<CommandOutput> {
  try {
    requireDirectory(targetPath);
    const config = loadConfig(targetPath);
    const ctx = await loadSite(config.siteUrl, fetchFn);
    const results = await runChecks(selectChecks(config), ctx);
    const stdout = opts.json
      ? formatCheckResultsJson(config.siteUrl, results)
      : formatCheckResultsText(config.siteUrl, results);
    return { exitCode: hasFailure(results) ? 1 : 0, stdout };
  } catch (err) {
    return errorOutput(err);
  }
}

export async function runFleetCommand(
  manifestPath: string,
  opts: { json: boolean },
  fetchFn?: FetchFn,
): Promise<CommandOutput> {
  try {
    const siteResults = await runFleet(manifestPath, fetchFn);
    const stdout = opts.json ? formatFleetResultsJson(siteResults) : formatFleetResultsText(siteResults);
    const anyFailure = siteResults.some((s) => s.error !== undefined || !s.ok);
    return { exitCode: anyFailure ? 1 : 0, stdout };
  } catch (err) {
    return errorOutput(err);
  }
}
