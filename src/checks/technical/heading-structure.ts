import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "heading-structure";
const NAME = "Heading structure";
const CATEGORY = "technical" as const;

export const headingStructureCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so heading structure could not be checked.",
        fix: "Confirm siteUrl in llmscout.json is correct and reachable.",
      };
    }

    const $ = ctx.$;
    const h1Count = $("h1").length;

    if (h1Count === 0) {
      return {
        ...base,
        status: "FAIL",
        message: "No <h1> found on the page.",
        fix: "Add exactly one <h1> that describes the page's main topic.",
      };
    }

    if (h1Count > 1) {
      return {
        ...base,
        status: "WARN",
        message: `Found ${h1Count} <h1> tags; search engines and generative engines expect exactly one per page.`,
        fix: "Keep a single <h1> and demote the rest to <h2> or lower.",
      };
    }

    const levels: number[] = [];
    $("h1, h2, h3, h4, h5, h6").each((_i, el) => {
      const tag = el.tagName?.toLowerCase() ?? "";
      const level = Number.parseInt(tag.slice(1), 10);
      if (Number.isFinite(level)) levels.push(level);
    });

    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1] as number;
      const curr = levels[i] as number;
      if (curr - prev > 1) {
        return {
          ...base,
          status: "WARN",
          message: `Heading hierarchy skips a level (h${prev} is directly followed by h${curr}).`,
          fix: "Avoid skipping heading levels -- e.g. follow an <h1> with an <h2>, not an <h3>.",
        };
      }
    }

    return {
      ...base,
      status: "PASS",
      message: "Exactly one <h1> and no skipped heading levels detected.",
    };
  },
};
