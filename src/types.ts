import type { CheerioAPI } from "cheerio";
import type { FetchedResource } from "./fetch-utils.js";

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
  llmsTxt: FetchedResource;
}

export interface CheckContext {
  resources: SiteResources;
  /** Parsed homepage DOM, or null if the homepage fetch failed. */
  $: CheerioAPI | null;
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
