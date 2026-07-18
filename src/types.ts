import type { CheerioAPI } from "cheerio";
import type { FetchedResource } from "./fetch-utils.js";

/**
 * The fetch function every check that needs its own network access beyond
 * the four shared site resources (currently just image-weight, for its
 * per-image HEAD requests) is handed via CheckContext.fetchFn -- the same
 * fetchFn a caller already injects into loadSite/fetchSiteResources for
 * testing, so one stub covers both the shared resources and any check's
 * own additional fetches.
 */
export type FetchFn = (url: string, init?: RequestInit) => Promise<FetchedResource>;

export type CheckStatus = "PASS" | "FAIL" | "WARN";

export type CheckCategory = "technical" | "geo";

export interface CheckResult {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  message: string;
  fix?: string;
}

/**
 * The resources every check is fetched against, gathered once per site and
 * shared across the whole check suite so a run of 12 checks makes at most
 * one request per distinct resource, not one per check.
 */
export interface SiteResources {
  siteUrl: URL;
  homepage: FetchedResource;
  robotsTxt: FetchedResource;
  sitemapXml: FetchedResource;
  /**
   * Extra sitemap URLs discovered via `Sitemap:` directive lines in
   * robots.txt (e.g. WordPress/RankMath's /sitemap_index.xml), fetched
   * alongside the conventional /sitemap.xml. Empty when robots.txt named
   * no sitemap, or named only the conventional one.
   */
  additionalSitemaps: FetchedResource[];
  llmsTxt: FetchedResource;
}

export interface CheckContext {
  resources: SiteResources;
  /** Parsed homepage DOM, or null if the homepage fetch failed. */
  $: CheerioAPI | null;
  /** See FetchFn -- the fetch function checks use for their own additional requests. */
  fetchFn: FetchFn;
}

/**
 * The one interface every concrete check implements. This is the seam
 * between "a check" and "the runner" -- adding check #13 means writing one
 * new object that satisfies this interface and registering it in
 * src/checks/index.ts, nothing else changes.
 */
export interface Check {
  id: string;
  name: string;
  category: CheckCategory;
  run(ctx: CheckContext): Promise<CheckResult> | CheckResult;
}
