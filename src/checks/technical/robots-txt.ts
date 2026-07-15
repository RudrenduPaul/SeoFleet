import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "robots-txt";
const NAME = "robots.txt";
const CATEGORY = "technical" as const;

export const robotsTxtCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };
    const robots = ctx.resources.robotsTxt;

    if (!robots.ok) {
      return {
        ...base,
        status: "FAIL",
        message: `robots.txt was not reachable at ${robots.url}${robots.status ? ` (HTTP ${robots.status})` : robots.error ? ` (${robots.error})` : ""}.`,
        fix: "Add a robots.txt file at your site root, even a permissive one, so crawlers and agents have explicit directives.",
      };
    }

    const body = robots.body ?? "";
    if (!/user-agent\s*:/i.test(body)) {
      return {
        ...base,
        status: "WARN",
        message: "robots.txt is reachable but contains no User-agent directive; it may not be a valid robots.txt file.",
        fix: "Ensure robots.txt contains at least one User-agent block.",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `robots.txt is reachable at ${robots.url} and contains User-agent directives.`,
    };
  },
};
