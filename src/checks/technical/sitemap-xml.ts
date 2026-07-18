import type { Check, CheckContext, CheckResult } from "../../types.js";
import type { FetchedResource } from "../../fetch-utils.js";

const ID = "sitemap-xml";
const NAME = "sitemap.xml";
const CATEGORY = "technical" as const;

function looksLikeSitemapXml(body: string): boolean {
  return /<urlset[\s>]/i.test(body) || /<sitemapindex[\s>]/i.test(body);
}

export const sitemapXmlCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    // The default /sitemap.xml fetch, plus any additional candidates
    // discovered via robots.txt `Sitemap:` directives (e.g. WordPress/
    // RankMath's /sitemap_index.xml). A site is only WARNed for "no
    // sitemap" once every candidate has failed.
    const candidates: FetchedResource[] = [ctx.resources.sitemapXml, ...ctx.resources.additionalSitemaps];

    const valid = candidates.find((candidate) => candidate.ok && looksLikeSitemapXml(candidate.body ?? ""));
    if (valid) {
      return {
        ...base,
        status: "PASS",
        message: `A sitemap is reachable at ${valid.url} and appears to be valid sitemap XML.`,
      };
    }

    const reachableButInvalid = candidates.find((candidate) => candidate.ok);
    if (reachableButInvalid) {
      return {
        ...base,
        status: "FAIL",
        message: `A sitemap is reachable at ${reachableButInvalid.url} but does not look like valid sitemap XML (missing <urlset> or <sitemapindex>).`,
        fix: "Ensure your sitemap follows the sitemap protocol (a <urlset> or <sitemapindex> root element).",
      };
    }

    // Absence is a WARN, not a FAIL: a site can be fully functional and
    // well-indexed without a literal /sitemap.xml (e.g. it may reference a
    // differently-named sitemap from robots.txt), so this is a missed
    // optimization rather than a defect -- but only once every discovered
    // candidate (default plus robots.txt-named) has failed.
    const attempted = candidates.map((candidate) => candidate.url).join(", ");
    return {
      ...base,
      status: "WARN",
      message: `No sitemap was reachable (tried: ${attempted}).`,
      fix: "Add a sitemap.xml at your site root, or point to one with a Sitemap: directive in robots.txt, to help search engines discover pages.",
    };
  },
};
