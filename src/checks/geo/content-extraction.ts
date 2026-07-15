import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "content-extraction";
const NAME = "Content extraction friendliness";
const CATEGORY = "geo" as const;
const UNSTRUCTURED_BLOCK_THRESHOLD = 800;
const PARAGRAPH_MIN_LENGTH = 30;

export const contentExtractionCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  /**
   * A heuristic, not a precise measurement: it checks whether the page has
   * heading/paragraph structure a generative engine can chunk, versus a
   * large amount of text crammed into a single element with no internal
   * structure. It cannot judge semantic quality, and it cannot see content
   * that only appears after client-side JavaScript runs -- this tool does
   * not execute JS or use a headless browser by design, so a page that is
   * empty until hydrated will read as unstructured here even if it renders
   * well structured in a real browser. Treat WARN as "worth a manual look",
   * not as a definitive verdict.
   */
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so content extraction friendliness could not be checked.",
        fix: "Confirm siteUrl in seofleet.json is correct and reachable.",
      };
    }

    const $ = ctx.$;
    const root = $("main").first().length ? $("main").first() : $("body").first();

    const headingCount = root.find("h1, h2, h3, h4, h5, h6").length;
    const paragraphCount = root
      .find("p, li")
      .filter((_i, el) => $(el).text().trim().length > PARAGRAPH_MIN_LENGTH).length;

    let maxUnstructuredLength = 0;
    root.find("div").each((_i, el) => {
      const $el = $(el);
      const hasStructure = $el.find("h1, h2, h3, h4, h5, h6, p, li").length > 0;
      if (!hasStructure) {
        const length = $el.text().trim().length;
        if (length > maxUnstructuredLength) maxUnstructuredLength = length;
      }
    });

    if (headingCount === 0 && paragraphCount === 0) {
      return {
        ...base,
        status: "WARN",
        message: "No headings or paragraph-level structure detected; a generative engine may struggle to extract distinct sections from this page.",
        fix: "Break content into headings (<h2>, <h3>, ...) and paragraphs (<p>) rather than unstructured text.",
      };
    }

    if (maxUnstructuredLength > UNSTRUCTURED_BLOCK_THRESHOLD) {
      return {
        ...base,
        status: "WARN",
        message: `Found a ${maxUnstructuredLength}-character block of text with no internal heading or paragraph structure.`,
        fix: "Break large unstructured blocks into headed sections and paragraphs.",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `Found ${headingCount} heading(s) and ${paragraphCount} structured text block(s); content appears reasonably extractable. (Heuristic: cannot assess semantic quality or JS-rendered content.)`,
    };
  },
};
