import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "canonical";
const NAME = "Canonical tag";
const CATEGORY = "technical" as const;

export const canonicalCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so the canonical tag could not be checked.",
        fix: "Confirm siteUrl in llmscout.json is correct and reachable.",
      };
    }

    const href = ctx.$('link[rel="canonical"]').first().attr("href")?.trim();

    if (!href) {
      return {
        ...base,
        status: "WARN",
        message: "No <link rel=\"canonical\"> tag found.",
        fix: "Add a canonical link tag pointing at the preferred URL for this page.",
      };
    }

    try {
      // A relative canonical is legal HTML; resolve it against the site
      // URL before validating so relative hrefs aren't penalized.
      new URL(href, ctx.resources.siteUrl);
    } catch {
      return {
        ...base,
        status: "FAIL",
        message: `Canonical href "${href}" is not a valid URL.`,
        fix: "Point the canonical tag at a valid absolute or root-relative URL.",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `Canonical tag points to "${href}".`,
    };
  },
};
