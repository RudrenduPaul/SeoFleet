import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { assertHttpUrl } from "./fetch-utils.js";
import { CONFIG_FILENAME, configPath, defaultConfig } from "./config.js";
import { LLMScoutError } from "./errors.js";

export interface InitResult {
  projectPath: string;
  configFile: string;
  configCreated: boolean;
  skillFile: string;
  skillCreated: boolean;
}

const SKILL_RELATIVE_PATH = path.join(".claude", "skills", "llmscout", "SKILL.md");

function buildSkillMarkdown(): string {
  // This file is what actually replaces claude-seo's broken /plugin
  // install flow for the project it's scaffolded into: it tells Claude
  // Code to invoke this same Node CLI directly. There is no bundled
  // script to resolve a relative path to, and no Python/Playwright
  // provisioning step, because the checks run inside this process.
  return `# LLMScout

Run SEO and GEO (generative engine optimization) checks against this
project's configured site using the \`llmscout\` CLI.

## Usage

\`\`\`
llmscout check . --json
\`\`\`

This reads ${CONFIG_FILENAME} in the project root for the site URL and
which check categories to run, then reports PASS/FAIL/WARN per check with
a fix suggestion for anything that isn't a clean PASS.

No Python, no Playwright, and no relative script paths are involved --
this is a single Node CLI invocation.
`;
}

/**
 * Scaffolds a working LLMScout setup into a target directory: a
 * llmscout.json the `check`/`fleet` commands read, plus a minimal Claude
 * Code skill file that points at this same CLI. Idempotent: an existing
 * llmscout.json or SKILL.md is left untouched so re-running init never
 * clobbers a user's configured siteUrl.
 */
export function initProject(targetPath: string, opts: { siteUrl?: string } = {}): InitResult {
  if (opts.siteUrl) {
    assertHttpUrl(opts.siteUrl);
  }

  try {
    mkdirSync(targetPath, { recursive: true });
  } catch (err) {
    throw new LLMScoutError(
      `Could not create directory "${targetPath}": ${err instanceof Error ? err.message : String(err)}`,
      2,
    );
  }

  const cfgPath = configPath(targetPath);
  const configCreated = !existsSync(cfgPath);
  if (configCreated) {
    const config = defaultConfig(opts.siteUrl ?? "");
    writeFileSync(cfgPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  }

  const skillPath = path.join(targetPath, SKILL_RELATIVE_PATH);
  const skillCreated = !existsSync(skillPath);
  if (skillCreated) {
    mkdirSync(path.dirname(skillPath), { recursive: true });
    writeFileSync(skillPath, buildSkillMarkdown(), "utf-8");
  }

  return {
    projectPath: targetPath,
    configFile: cfgPath,
    configCreated,
    skillFile: skillPath,
    skillCreated,
  };
}
