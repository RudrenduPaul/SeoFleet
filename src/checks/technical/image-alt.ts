import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "image-alt";
const NAME = "Image alt coverage";
const CATEGORY = "technical" as const;
const WARN_THRESHOLD = 0.8;

export const imageAltCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so image alt coverage could not be checked.",
        fix: "Confirm siteUrl in LLMScout.json is correct and reachable.",
      };
    }

    const $ = ctx.$;
    const images = $("img");
    const total = images.length;

    if (total === 0) {
      return {
        ...base,
        status: "PASS",
        message: "No <img> tags found on the page.",
      };
    }

    // An alt attribute that is present but empty (alt="") is a valid,
    // intentional way to mark a decorative image -- only a fully missing
    // attribute counts against coverage.
    let missing = 0;
    images.each((_i, el) => {
      if ($(el).attr("alt") === undefined) missing++;
    });

    const coverage = (total - missing) / total;

    if (missing === 0) {
      return {
        ...base,
        status: "PASS",
        message: `All ${total} <img> tags have an alt attribute.`,
      };
    }

    if (coverage >= WARN_THRESHOLD) {
      return {
        ...base,
        status: "WARN",
        message: `${missing} of ${total} <img> tags are missing an alt attribute (${Math.round(coverage * 100)}% coverage).`,
        fix: "Add descriptive alt text to every remaining image (or alt=\"\" for purely decorative ones).",
      };
    }

    return {
      ...base,
      status: "FAIL",
      message: `${missing} of ${total} <img> tags are missing an alt attribute (${Math.round(coverage * 100)}% coverage).`,
      fix: "Add descriptive alt text to every image (or alt=\"\" for purely decorative ones).",
    };
  },
};
