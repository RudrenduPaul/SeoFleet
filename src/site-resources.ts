import * as cheerio from "cheerio";
import { assertHttpUrl, safeFetch } from "./fetch-utils.js";
import type { CheckContext, FetchFn, SiteResources } from "./types.js";

export type { FetchFn } from "./types.js";

/**
 * Fetches the four resources the whole check suite is built on: the
 * homepage itself, plus the three well-known files a site may expose at its
 * origin. All four are fetched in parallel and none of them throws -- an
 * unreachable resource simply comes back as `{ ok: false }` for the
 * individual checks to interpret.
 */
export async function fetchSiteResources(siteUrl: URL, fetchFn: FetchFn = safeFetch): Promise<SiteResources> {
  const origin = `${siteUrl.protocol}//${siteUrl.host}`;

  const [homepage, robotsTxt, sitemapXml, llmsTxt] = await Promise.all([
    fetchFn(siteUrl.toString()),
    fetchFn(`${origin}/robots.txt`),
    fetchFn(`${origin}/sitemap.xml`),
    fetchFn(`${origin}/llms.txt`),
  ]);

  return { siteUrl, homepage, robotsTxt, sitemapXml, llmsTxt };
}

/**
 * Builds the shared CheckContext from already-fetched resources: parses the
 * homepage HTML once with cheerio (or leaves `$` null if the homepage
 * couldn't be fetched at all) so every check reuses the same parsed DOM
 * instead of re-parsing HTML per check. `fetchFn` is threaded onto the
 * context too, so a check that needs its own additional requests (e.g.
 * image-weight's per-image HEAD requests) reuses the exact same fetch
 * function -- and the same test stub -- as the four shared site resources.
 */
export function buildCheckContext(resources: SiteResources, fetchFn: FetchFn = safeFetch): CheckContext {
  if (!resources.homepage.ok || resources.homepage.body === undefined) {
    return { resources, $: null, fetchFn };
  }
  return { resources, $: cheerio.load(resources.homepage.body), fetchFn };
}

/**
 * Convenience wrapper: validate the URL, fetch all site resources, and
 * build the CheckContext in one call. This is what `check` and `fleet`
 * both call.
 */
export async function loadSite(rawSiteUrl: string, fetchFn: FetchFn = safeFetch): Promise<CheckContext> {
  const siteUrl = assertHttpUrl(rawSiteUrl);
  const resources = await fetchSiteResources(siteUrl, fetchFn);
  return buildCheckContext(resources, fetchFn);
}
