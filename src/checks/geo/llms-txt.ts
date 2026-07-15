import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "llms-txt";
const NAME = "llms.txt";
const CATEGORY = "geo" as const;

export const llmsTxtCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };
    const llmsTxt = ctx.resources.llmsTxt;

    // llms.txt is an emerging, not-yet-universal convention -- its absence
    // is informational only and never fails the run.
    if (!llmsTxt.ok || !(llmsTxt.body ?? "").trim()) {
      return {
        ...base,
        status: "WARN",
        message: `No llms.txt found at ${llmsTxt.url}.`,
        fix: "Optional: add an llms.txt at your site root summarizing the site for LLM-based agents (see llmstxt.org).",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `llms.txt is present at ${llmsTxt.url}.`,
    };
  },
};
