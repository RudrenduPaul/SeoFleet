import type { Check, CheckContext, CheckResult } from "../../types.js";

const MIN_LENGTH = 10;
const MAX_LENGTH = 60;

const ID = "title";
const NAME = "Title tag";
const CATEGORY = "technical" as const;

export const titleCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so the <title> tag could not be checked.",
        fix: "Confirm siteUrl in seofleet.json is correct and reachable.",
      };
    }

    const title = ctx.$("title").first().text().trim();

    if (!title) {
      return {
        ...base,
        status: "FAIL",
        message: "No <title> tag found (or it is empty).",
        fix: `Add a <title> tag in <head> that is ${MIN_LENGTH}-${MAX_LENGTH} characters and describes the page.`,
      };
    }

    if (title.length < MIN_LENGTH) {
      return {
        ...base,
        status: "WARN",
        message: `Title is only ${title.length} characters ("${title}"); it may be too short to describe the page.`,
        fix: `Expand the title to ${MIN_LENGTH}-${MAX_LENGTH} characters.`,
      };
    }

    if (title.length > MAX_LENGTH) {
      return {
        ...base,
        status: "WARN",
        message: `Title is ${title.length} characters; search engines typically truncate titles beyond ~${MAX_LENGTH} characters.`,
        fix: `Shorten the title to ${MIN_LENGTH}-${MAX_LENGTH} characters, front-loading the important keywords.`,
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `Title "${title}" is ${title.length} characters, within the recommended ${MIN_LENGTH}-${MAX_LENGTH} range.`,
    };
  },
};
