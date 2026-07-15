import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { LLMScoutError } from "./errors.js";
import { ALL_CHECKS, GEO_CHECKS, TECHNICAL_CHECKS } from "./checks/index.js";
import type { Check } from "./types.js";

export const CONFIG_FILENAME = "LLMScout.json";

export interface LLMScoutConfig {
  /**
   * The live URL that `check`/`fleet` run their checks against. Left blank
   * by `init` -- the user must set it once, since LLMScout has no way to
   * infer a project's public URL from its local files.
   */
  siteUrl: string;
  checks?: {
    technical?: boolean;
    geo?: boolean;
  };
}

export function defaultConfig(siteUrl = ""): LLMScoutConfig {
  return {
    siteUrl,
    checks: { technical: true, geo: true },
  };
}

export function configPath(projectPath: string): string {
  return path.join(projectPath, CONFIG_FILENAME);
}

/**
 * Loads and validates a project's LLMScout.json. Every failure mode here
 * (missing file, malformed JSON, missing/blank siteUrl) is a usage error
 * (exit code 2), not a check failure -- the check suite never even starts.
 */
export function loadConfig(projectPath: string): LLMScoutConfig {
  const file = configPath(projectPath);

  if (!existsSync(file)) {
    throw new LLMScoutError(
      `No ${CONFIG_FILENAME} found in "${projectPath}". Run \`LLMScout init ${projectPath}\` first.`,
      2,
    );
  }

  let raw: string;
  try {
    raw = readFileSync(file, "utf-8");
  } catch (err) {
    throw new LLMScoutError(
      `Could not read ${file}: ${err instanceof Error ? err.message : String(err)}`,
      2,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new LLMScoutError(
      `${file} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      2,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new LLMScoutError(`${file} must contain a JSON object.`, 2);
  }

  const obj = parsed as Record<string, unknown>;
  const siteUrl = obj["siteUrl"];

  if (typeof siteUrl !== "string" || siteUrl.trim() === "") {
    throw new LLMScoutError(
      `${file} has no siteUrl configured. Edit the file and set "siteUrl" to your site's URL.`,
      2,
    );
  }

  const checksRaw = obj["checks"];
  const checks: LLMScoutConfig["checks"] =
    typeof checksRaw === "object" && checksRaw !== null
      ? {
          technical: (checksRaw as Record<string, unknown>)["technical"] !== false,
          geo: (checksRaw as Record<string, unknown>)["geo"] !== false,
        }
      : { technical: true, geo: true };

  return { siteUrl, checks };
}

/** Selects which checks to run based on a loaded config's `checks` flags. */
export function selectChecks(config: LLMScoutConfig): Check[] {
  const technical = config.checks?.technical !== false;
  const geo = config.checks?.geo !== false;
  if (technical && geo) return ALL_CHECKS;
  if (technical) return TECHNICAL_CHECKS;
  if (geo) return GEO_CHECKS;
  return [];
}
