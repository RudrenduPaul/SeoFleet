import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "ai-crawler-directives";
const NAME = "AI crawler directives";
const CATEGORY = "geo" as const;

// The AI crawlers checked for are reported on, never prescribed -- whether
// to allow or disallow any of them is a genuine site-owner choice this tool
// does not take a position on.
const TRACKED_BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

type Directive = "allow" | "disallow" | "unspecified";

/**
 * A deliberately simple robots.txt parser: it tracks the single most recent
 * User-agent line and attributes the next Allow/Disallow lines to it. It
 * does not handle grouped multi-agent blocks (several consecutive
 * User-agent lines sharing one set of rules) -- a documented limitation,
 * not a bug, for v0.1.
 */
export function parseAiCrawlerDirectives(robotsTxt: string, bots: string[] = TRACKED_BOTS): Record<string, Directive> {
  const result: Record<string, Directive> = {};
  for (const bot of bots) result[bot] = "unspecified";

  let currentAgent: string | null = null;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;

    const sepIndex = line.indexOf(":");
    if (sepIndex === -1) continue;

    const key = line.slice(0, sepIndex).trim().toLowerCase();
    const value = line.slice(sepIndex + 1).trim();

    if (key === "user-agent") {
      currentAgent = value;
      continue;
    }

    if ((key === "disallow" || key === "allow") && currentAgent) {
      const matchedBot = bots.find((bot) => bot.toLowerCase() === currentAgent?.toLowerCase());
      if (!matchedBot) continue;
      if (key === "disallow" && value === "") continue; // an empty Disallow means "allow everything"; leave unspecified rather than assert allow
      result[matchedBot] = key === "disallow" ? "disallow" : "allow";
    }
  }

  return result;
}

export const aiCrawlerDirectivesCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };
    const robots = ctx.resources.robotsTxt;

    if (!robots.ok || robots.body === undefined) {
      return {
        ...base,
        status: "WARN",
        message: "robots.txt is unreachable, so AI-crawler directives could not be determined.",
        fix: "Add a reachable robots.txt if you want to state an explicit policy for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended).",
      };
    }

    const directives = parseAiCrawlerDirectives(robots.body);
    const summary = TRACKED_BOTS.map((bot) => `${bot}: ${directives[bot]}`).join(", ");

    return {
      ...base,
      status: "PASS",
      message: `AI crawler directives found in robots.txt -- ${summary}. This is a report of what's configured, not a recommendation.`,
    };
  },
};
