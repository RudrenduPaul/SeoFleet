import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "faq-schema";
const NAME = "FAQ schema";
const CATEGORY = "geo" as const;

function containsFaqType(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsFaqType);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj["@type"] === "FAQPage" || (Array.isArray(obj["@type"]) && obj["@type"].includes("FAQPage"))) {
      return true;
    }
    if ("@graph" in obj) return containsFaqType(obj["@graph"]);
  }
  return false;
}

export const faqSchemaCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so FAQ schema could not be checked.",
        fix: "Confirm siteUrl in llmscout.json is correct and reachable.",
      };
    }

    const $ = ctx.$;
    let found = false;
    $('script[type="application/ld+json"]').each((_i, el) => {
      if (found) return;
      try {
        const parsed: unknown = JSON.parse($(el).text());
        if (containsFaqType(parsed)) found = true;
      } catch {
        // invalid JSON-LD is reported by the structured-data check; ignore here
      }
    });

    // FAQ schema only applies to pages that actually have FAQ content, so
    // its absence is informational, never a failure.
    if (!found) {
      return {
        ...base,
        status: "WARN",
        message: "No FAQPage structured data found.",
        fix: "If this page has an FAQ section, mark it up with FAQPage JSON-LD so generative engines can surface individual answers.",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: "FAQPage structured data found.",
    };
  },
};
