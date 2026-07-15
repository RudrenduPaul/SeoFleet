import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "sitemap-xml";
const NAME = "sitemap.xml";
const CATEGORY = "technical" as const;

export const sitemapXmlCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };
    const sitemap = ctx.resources.sitemapXml;

    // Absence is a WARN, not a FAIL: a site can be fully functional and
    // well-indexed without a literal /sitemap.xml (e.g. it may reference a
    // differently-named sitemap from robots.txt), so this is a missed
    // optimization rather than a defect.
    if (!sitemap.ok) {
      return {
        ...base,
        status: "WARN",
        message: `sitemap.xml was not reachable at ${sitemap.url}${sitemap.status ? ` (HTTP ${sitemap.status})` : ""}.`,
        fix: "Add a sitemap.xml at your site root to help search engines discover pages.",
      };
    }

    const body = sitemap.body ?? "";
    if (!/<urlset[\s>]/i.test(body) && !/<sitemapindex[\s>]/i.test(body)) {
      return {
        ...base,
        status: "FAIL",
        message: "sitemap.xml is reachable but does not look like valid sitemap XML (missing <urlset> or <sitemapindex>).",
        fix: "Ensure sitemap.xml follows the sitemap protocol (a <urlset> or <sitemapindex> root element).",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `sitemap.xml is reachable at ${sitemap.url} and appears to be valid sitemap XML.`,
    };
  },
};
