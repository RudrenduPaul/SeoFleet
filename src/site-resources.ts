import * as cheerio from "cheerio";
import { assertHttpUrl, safeFetch } from "./fetch-utils.js";
import type { CheckContext, FetchFn, SiteResources } from "./types.js";

export type { FetchFn } from "./types.js";

/**
 * Parses `Sitemap:` directive lines out of a robots.txt body. Per the
 * robots.txt spec these directives are not scoped to any User-agent group
 * and can appear anywhere in the file, one absolute URL per line -- this is
 * how real search engines discover a sitemap that isn't published at the
 * conventional /sitemap.xml path (e.g. WordPress/RankMath's
 * /sitemap_index.xml).
 */
export function parseSitemapDirectives(robotsTxt: string): string[] {
  const urls: string[] = [];
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;

    const sepIndex = line.indexOf(":");
    if (sepIndex === -1) continue;

    const key = line.slice(0, sepIndex).trim().toLowerCase();
    const value = line.slice(sepIndex + 1).trim();
    if (key === "sitemap" && value) urls.push(value);
  }
  return urls;
}

/**
 * Fetches the four resources the whole check suite is built on: the
 * homepage itself, plus the three well-known files a site may expose at its
 * origin. All four are fetched in parallel and none of them throws -- an
 * unreachable resource simply comes back as `{ ok: false }` for the
 * individual checks to interpret.
 *
 * robots.txt's body is then scanned for `Sitemap:` directives, and any URL
 * named there that isn't the conventional /sitemap.xml we already fetched
 * is fetched too, as an additional sitemap candidate for sitemap-xml.ts to
 * evaluate alongside the default.
 */
export async function fetchSiteResources(siteUrl: URL, fetchFn: FetchFn = safeFetch): Promise<SiteResources> {
  const origin = `${siteUrl.protocol}//${siteUrl.host}`;
  const defaultSitemapUrl = `${origin}/sitemap.xml`;

  const [homepage, robotsTxt, sitemapXml, llmsTxt] = await Promise.all([
    fetchFn(siteUrl.toString()),
    fetchFn(`${origin}/robots.txt`),
    fetchFn(defaultSitemapUrl),
    fetchFn(`${origin}/llms.txt`),
  ]);

  const additionalSitemapUrls = new Set<string>();
  if (robotsTxt.ok && robotsTxt.body) {
    for (const raw of parseSitemapDirectives(robotsTxt.body)) {
      let resolved: URL;
      try {
        resolved = new URL(raw, origin);
      } catch {
        continue; // an unparseable Sitemap: value isn't a usable candidate
      }
      const normalized = resolved.toString();
      if (normalized === defaultSitemapUrl) continue; // already fetched above
      additionalSitemapUrls.add(normalized);
    }
  }

  const additionalSitemaps = await Promise.all([...additionalSitemapUrls].map((url) => fetchFn(url)));

  return { siteUrl, homepage, robotsTxt, sitemapXml, additionalSitemaps, llmsTxt };
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
