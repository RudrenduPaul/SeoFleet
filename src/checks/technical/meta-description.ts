import type { Check, CheckContext, CheckResult } from "../../types.js";

const MIN_LENGTH = 50;
const MAX_LENGTH = 160;

const ID = "meta-description";
const NAME = "Meta description";
const CATEGORY = "technical" as const;

export const metaDescriptionCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so the meta description could not be checked.",
        fix: "Confirm siteUrl in seofleet.json is correct and reachable.",
      };
    }

    const content = ctx.$('meta[name="description"]').first().attr("content")?.trim() ?? "";

    // Missing entirely is a WARN, not a FAIL: search engines will fall back
    // to auto-generating a snippet, so this is a missed optimization rather
    // than a broken page.
    if (!content) {
      return {
        ...base,
        status: "WARN",
        message: "No meta description found.",
        fix: `Add <meta name="description" content="..."> with ${MIN_LENGTH}-${MAX_LENGTH} characters summarizing the page.`,
      };
    }

    if (content.length < MIN_LENGTH || content.length > MAX_LENGTH) {
      return {
        ...base,
        status: "WARN",
        message: `Meta description is ${content.length} characters; recommended range is ${MIN_LENGTH}-${MAX_LENGTH}.`,
        fix: `Rewrite the description to fall within ${MIN_LENGTH}-${MAX_LENGTH} characters.`,
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `Meta description is ${content.length} characters, within the recommended range.`,
    };
  },
};
