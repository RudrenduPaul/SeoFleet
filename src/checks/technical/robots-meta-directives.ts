import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "robots-meta-directives";
const NAME = "Meta robots directives";
const CATEGORY = "technical" as const;

const ADVANCED_DIRECTIVES = ["max-snippet", "max-image-preview", "max-video-preview"];

export const robotsMetaDirectivesCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so meta robots directives could not be checked.",
        fix: "Confirm siteUrl in llmscout.json is correct and reachable.",
      };
    }

    const content = ctx.$('meta[name="robots"]').first().attr("content")?.trim().toLowerCase() ?? "";

    // Missing entirely is a WARN, not a FAIL: search engines fall back to
    // their own default snippet/preview limits, so this is a missed
    // optimization rather than a broken page.
    if (!content) {
      return {
        ...base,
        status: "WARN",
        message: "No meta robots directives found; default Google Search snippet/preview limits will apply.",
        fix: 'Add <meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1"> to control search snippet appearance.',
      };
    }

    const tokens = content.split(",").map((t) => t.trim());

    // An unintentional noindex is the one case worth failing loudly on --
    // it silently removes the page from search results entirely.
    if (tokens.includes("noindex")) {
      return {
        ...base,
        status: "FAIL",
        message: 'Meta robots directive includes "noindex" -- this page will be excluded from search results.',
        fix: 'Remove "noindex" from the meta robots content attribute unless excluding this page is intentional.',
      };
    }

    const present = ADVANCED_DIRECTIVES.filter((directive) => tokens.some((t) => t.startsWith(directive)));
    const missing = ADVANCED_DIRECTIVES.filter((directive) => !present.includes(directive));

    if (present.length === 0) {
      return {
        ...base,
        status: "WARN",
        message: `Meta robots tag found ("${content}") but no advanced snippet/preview directives (${ADVANCED_DIRECTIVES.join(", ")}).`,
        fix: `Add ${ADVANCED_DIRECTIVES.join(", ")} directives to control search snippet and preview size.`,
      };
    }

    if (missing.length > 0) {
      return {
        ...base,
        status: "WARN",
        message: `Meta robots tag has ${present.join(", ")}, but is missing: ${missing.join(", ")}.`,
        fix: `Add the missing directive(s): ${missing.join(", ")}.`,
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `Meta robots tag includes all advanced snippet/preview directives (${ADVANCED_DIRECTIVES.join(", ")}).`,
    };
  },
};
