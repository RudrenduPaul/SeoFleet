import * as cheerio from "cheerio";
import type { FetchedResource } from "../src/fetch-utils.js";
import type { FetchFn } from "../src/site-resources.js";
import type { CheckContext, SiteResources } from "../src/types.js";

export interface StubResponse {
  status?: number;
  body?: string;
  ok?: boolean;
  error?: string;
}

/**
 * Builds a FetchFn stub keyed by exact URL. Every test in this suite that
 * needs "network" data routes through this instead of hitting a real
 * server -- no real network calls happen anywhere in the test suite.
 */
export function makeFetchStub(routes: Record<string, StubResponse>): FetchFn {
  return async (url: string): Promise<FetchedResource> => {
    const route = routes[url];
    if (!route) {
      return { url, ok: false, status: 404, error: "not stubbed" };
    }
    const status = route.status ?? 200;
    return {
      url,
      ok: route.ok ?? (status >= 200 && status < 300),
      status,
      ...(route.body !== undefined ? { body: route.body } : {}),
      ...(route.error !== undefined ? { error: route.error } : {}),
    };
  };
}

export const GOOD_HTML = `<!doctype html>
<html>
<head>
  <title>Acme Widgets -- Handmade Widgets Since 1990</title>
  <meta name="description" content="Acme Widgets makes handmade widgets for professionals who need reliable, durable tools that last for decades of daily use.">
  <link rel="canonical" href="https://acme.example/">
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Organization","name":"Acme Widgets"}
  </script>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is a widget?","acceptedAnswer":{"@type":"Answer","text":"A widget is a small mechanical device."}}]}
  </script>
</head>
<body>
  <main>
    <h1>Acme Widgets</h1>
    <p>Acme Widgets has been building reliable, handmade widgets for professionals since 1990.</p>
    <h2>Our story</h2>
    <p>Founded in a small garage, Acme Widgets now ships to customers across the world every day.</p>
    <img src="/widget.png" alt="A handmade widget on a workbench">
  </main>
</body>
</html>`;

export const BAD_HTML = `<!doctype html>
<html>
<head></head>
<body>
  <div>Everything is crammed into this one div with no headings or paragraphs at all, just a giant wall of unstructured text that keeps going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going and going.</div>
  <h1>First</h1>
  <h1>Second</h1>
  <img src="/a.png">
  <img src="/b.png">
</body>
</html>`;

export const GOOD_ROBOTS_TXT = `User-agent: *
Disallow:

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Allow: /
`;

export const GOOD_SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://acme.example/</loc></url>
</urlset>`;

export const ROBOTS_TXT_WITH_SITEMAP_DIRECTIVE = `User-agent: *
Disallow:

Sitemap: https://acme.example/sitemap_index.xml
`;

/** Default fetchFn stub for a CheckContext -- matches makeFetchStub's own
 * behavior for a URL nobody stubbed, so a test that doesn't care about a
 * check's own additional fetches (e.g. image-weight's HEAD requests) still
 * makes zero real network calls. */
const NOT_STUBBED: FetchFn = async (url: string): Promise<FetchedResource> => ({
  url,
  ok: false,
  status: 404,
  error: "not stubbed",
});

/**
 * Builds a full CheckContext for a single check test: `html: null` models
 * an unreachable homepage (every DOM-dependent check should FAIL in that
 * case), otherwise the HTML is parsed with cheerio exactly as the real
 * runner would. `resourceOverrides` lets a test set robots.txt/sitemap.xml/
 * llms.txt fetch results for the checks that read those directly. `fetchFn`
 * lets a test stub the additional requests a check like image-weight makes
 * beyond the four shared site resources.
 */
export function makeCheckContext(
  html: string | null,
  resourceOverrides: Partial<Omit<SiteResources, "siteUrl" | "homepage">> = {},
  siteUrl = "https://acme.example/",
  fetchFn: FetchFn = NOT_STUBBED,
): CheckContext {
  const resources: SiteResources = {
    siteUrl: new URL(siteUrl),
    homepage:
      html !== null
        ? { url: siteUrl, ok: true, status: 200, body: html }
        : { url: siteUrl, ok: false, status: 500, error: "unreachable" },
    robotsTxt: resourceOverrides.robotsTxt ?? { url: new URL("/robots.txt", siteUrl).toString(), ok: false, status: 404 },
    sitemapXml: resourceOverrides.sitemapXml ?? { url: new URL("/sitemap.xml", siteUrl).toString(), ok: false, status: 404 },
    additionalSitemaps: resourceOverrides.additionalSitemaps ?? [],
    llmsTxt: resourceOverrides.llmsTxt ?? { url: new URL("/llms.txt", siteUrl).toString(), ok: false, status: 404 },
  };
  return { resources, $: html !== null ? cheerio.load(html) : null, fetchFn };
}
