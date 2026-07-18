import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "open-graph";
const NAME = "Open Graph tags";
const CATEGORY = "technical" as const;

const REQUIRED_PROPERTIES = ["og:title", "og:description", "og:image", "og:url"];

export const openGraphCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so Open Graph tags could not be checked.",
        fix: "Confirm siteUrl in seofleet.json is correct and reachable.",
      };
    }

    const $ = ctx.$;
    const missing: string[] = [];
    for (const property of REQUIRED_PROPERTIES) {
      const content = $(`meta[property="${property}"]`).first().attr("content")?.trim();
      if (!content) missing.push(property);
    }

    // Missing entirely is a WARN, not a FAIL: the page still works without
    // Open Graph tags, it just renders a plain/unstyled link preview when
    // shared -- a missed optimization rather than a broken page.
    if (missing.length === REQUIRED_PROPERTIES.length) {
      return {
        ...base,
        status: "WARN",
        message: "No Open Graph tags found.",
        fix: `Add Open Graph meta tags (${REQUIRED_PROPERTIES.join(", ")}) so shared links render rich previews on social platforms.`,
      };
    }

    if (missing.length > 0) {
      return {
        ...base,
        status: "WARN",
        message: `Missing Open Graph tag(s): ${missing.join(", ")}.`,
        fix: `Add the missing Open Graph meta tag(s): ${missing.join(", ")}.`,
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `All required Open Graph tags (${REQUIRED_PROPERTIES.join(", ")}) are present.`,
    };
  },
};
