import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "twitter-card";
const NAME = "Twitter/X Card tags";
const CATEGORY = "technical" as const;

const VALID_CARD_TYPES = ["summary", "summary_large_image", "app", "player"];
const FALLBACK_FIELDS = ["twitter:title", "twitter:description", "twitter:image"];

export const twitterCardCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so Twitter/X Card tags could not be checked.",
        fix: "Confirm siteUrl in LLMScout.json is correct and reachable.",
      };
    }

    const $ = ctx.$;
    const cardType = $('meta[name="twitter:card"]').first().attr("content")?.trim();

    // Missing entirely is a WARN, not a FAIL: X/Twitter falls back to a
    // generic link preview without a card tag, so this is a missed
    // optimization rather than a broken page.
    if (!cardType) {
      return {
        ...base,
        status: "WARN",
        message: "No twitter:card meta tag found.",
        fix: 'Add <meta name="twitter:card" content="summary_large_image"> (or another valid card type) so links render rich previews on X/Twitter.',
      };
    }

    if (!VALID_CARD_TYPES.includes(cardType)) {
      return {
        ...base,
        status: "FAIL",
        message: `twitter:card value "${cardType}" is not a recognized card type.`,
        fix: `Set twitter:card to one of: ${VALID_CARD_TYPES.join(", ")}.`,
      };
    }

    // X/Twitter falls back to the equivalent Open Graph tag for each of
    // these fields when the twitter:-prefixed one is absent, so this is
    // reported as a WARN rather than treated as fully broken.
    const missing: string[] = [];
    for (const name of FALLBACK_FIELDS) {
      const content = $(`meta[name="${name}"]`).first().attr("content")?.trim();
      if (!content) missing.push(name);
    }

    if (missing.length > 0) {
      return {
        ...base,
        status: "WARN",
        message: `twitter:card is "${cardType}", but missing: ${missing.join(", ")} (falls back to the equivalent Open Graph tag, if present).`,
        fix: `Add the missing Twitter Card meta tag(s): ${missing.join(", ")}.`,
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `twitter:card is "${cardType}" with title, description, and image all present.`,
    };
  },
};
