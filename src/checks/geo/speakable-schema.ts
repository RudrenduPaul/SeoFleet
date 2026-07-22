import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "speakable-schema";
const NAME = "Speakable schema";
const CATEGORY = "geo" as const;

function containsSpeakable(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSpeakable);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (
      obj["@type"] === "SpeakableSpecification" ||
      (Array.isArray(obj["@type"]) && obj["@type"].includes("SpeakableSpecification"))
    ) {
      return true;
    }
    // "speakable" is usually a property nested on a WebPage/Article node
    // rather than a standalone top-level type, so a truthy value there
    // also counts as present.
    if (obj["speakable"]) return true;
    if ("@graph" in obj) return containsSpeakable(obj["@graph"]);
  }
  return false;
}

export const speakableSchemaCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so Speakable schema could not be checked.",
        fix: "Confirm siteUrl in llmscout.json is correct and reachable.",
      };
    }

    const $ = ctx.$;
    let found = false;
    $('script[type="application/ld+json"]').each((_i, el) => {
      if (found) return;
      try {
        const parsed: unknown = JSON.parse($(el).text());
        if (containsSpeakable(parsed)) found = true;
      } catch {
        // invalid JSON-LD is reported by the structured-data check; ignore here
      }
    });

    // Speakable schema only applies to content genuinely suited for voice
    // assistants, so its absence is informational, never a failure.
    if (!found) {
      return {
        ...base,
        status: "WARN",
        message: "No Speakable structured data found.",
        fix: 'If this page has content suited for voice assistants, add a "speakable" SpeakableSpecification to its JSON-LD so voice search can surface it.',
      };
    }

    return {
      ...base,
      status: "PASS",
      message: "Speakable structured data found.",
    };
  },
};
