import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "structured-data";
const NAME = "Structured data (JSON-LD)";
const CATEGORY = "geo" as const;

export const structuredDataCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so structured data could not be checked.",
        fix: "Confirm siteUrl in LLMScout.json is correct and reachable.",
      };
    }

    const scripts = ctx.$('script[type="application/ld+json"]');

    if (scripts.length === 0) {
      return {
        ...base,
        status: "WARN",
        message: "No JSON-LD structured data found.",
        fix: "Add schema.org JSON-LD markup (e.g. Organization, WebSite, or Article) so generative engines can understand the page's entities.",
      };
    }

    let validCount = 0;
    let invalidCount = 0;
    scripts.each((_i, el) => {
      const text = ctx.$ ? ctx.$(el).text() : "";
      try {
        JSON.parse(text);
        validCount++;
      } catch {
        invalidCount++;
      }
    });

    if (invalidCount > 0) {
      return {
        ...base,
        status: "FAIL",
        message: `${invalidCount} of ${scripts.length} JSON-LD block(s) contain invalid JSON.`,
        fix: "Fix the malformed JSON-LD block(s) so they parse as valid JSON.",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `Found ${validCount} valid JSON-LD block(s).`,
    };
  },
};
