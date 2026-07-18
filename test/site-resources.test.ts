import { describe, expect, it } from "vitest";
import { buildCheckContext, fetchSiteResources, loadSite, parseSitemapDirectives } from "../src/site-resources.js";
import { GOOD_HTML, GOOD_ROBOTS_TXT, GOOD_SITEMAP_XML, ROBOTS_TXT_WITH_SITEMAP_DIRECTIVE, makeFetchStub } from "./test-helpers.js";

describe("parseSitemapDirectives", () => {
  it("returns an empty list when robots.txt has no Sitemap: directive", () => {
    expect(parseSitemapDirectives(GOOD_ROBOTS_TXT)).toEqual([]);
  });

  it("extracts a Sitemap: directive URL", () => {
    expect(parseSitemapDirectives(ROBOTS_TXT_WITH_SITEMAP_DIRECTIVE)).toEqual(["https://acme.example/sitemap_index.xml"]);
  });

  it("extracts multiple Sitemap: directive lines, case-insensitively", () => {
    const body = "User-agent: *\nDisallow:\nsitemap: https://acme.example/a.xml\nSITEMAP: https://acme.example/b.xml\n";
    expect(parseSitemapDirectives(body)).toEqual(["https://acme.example/a.xml", "https://acme.example/b.xml"]);
  });

  it("ignores a comment-only or blank Sitemap value", () => {
    const body = "Sitemap: # no url here\nSitemap:\n";
    expect(parseSitemapDirectives(body)).toEqual([]);
  });
});

describe("fetchSiteResources", () => {
  it("fetches the homepage plus the three well-known files in parallel", async () => {
    const fetchStub = makeFetchStub({
      "https://acme.example/": { body: GOOD_HTML },
      "https://acme.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://acme.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://acme.example/llms.txt": { body: "# Acme\nA site about widgets." },
    });
    const resources = await fetchSiteResources(new URL("https://acme.example/"), fetchStub);
    expect(resources.homepage.ok).toBe(true);
    expect(resources.robotsTxt.body).toContain("User-agent");
    expect(resources.sitemapXml.body).toContain("<urlset");
    expect(resources.llmsTxt.body).toContain("Acme");
    expect(resources.additionalSitemaps).toEqual([]);
  });

  it("fetches a sitemap named by a robots.txt Sitemap: directive as an additional candidate", async () => {
    const fetchStub = makeFetchStub({
      "https://acme.example/": { body: GOOD_HTML },
      "https://acme.example/robots.txt": { body: ROBOTS_TXT_WITH_SITEMAP_DIRECTIVE },
      "https://acme.example/sitemap.xml": { ok: false, status: 404 },
      "https://acme.example/sitemap_index.xml": { body: GOOD_SITEMAP_XML },
      "https://acme.example/llms.txt": { ok: false, status: 404 },
    });
    const resources = await fetchSiteResources(new URL("https://acme.example/"), fetchStub);
    expect(resources.additionalSitemaps).toHaveLength(1);
    expect(resources.additionalSitemaps[0]?.url).toBe("https://acme.example/sitemap_index.xml");
    expect(resources.additionalSitemaps[0]?.body).toContain("<urlset");
  });

  it("does not re-fetch the default /sitemap.xml when robots.txt also names it", async () => {
    const fetchStub = makeFetchStub({
      "https://acme.example/": { body: GOOD_HTML },
      "https://acme.example/robots.txt": { body: "Sitemap: https://acme.example/sitemap.xml\n" },
      "https://acme.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://acme.example/llms.txt": { ok: false, status: 404 },
    });
    const resources = await fetchSiteResources(new URL("https://acme.example/"), fetchStub);
    expect(resources.additionalSitemaps).toEqual([]);
  });

  it("skips additional sitemap fetches when robots.txt itself is unreachable", async () => {
    const fetchStub = makeFetchStub({
      "https://acme.example/": { body: GOOD_HTML },
      "https://acme.example/robots.txt": { ok: false, status: 500 },
      "https://acme.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://acme.example/llms.txt": { ok: false, status: 404 },
    });
    const resources = await fetchSiteResources(new URL("https://acme.example/"), fetchStub);
    expect(resources.additionalSitemaps).toEqual([]);
  });
});

describe("buildCheckContext", () => {
  it("parses the homepage HTML when the fetch succeeded", () => {
    const ctx = buildCheckContext({
      siteUrl: new URL("https://acme.example/"),
      homepage: { url: "https://acme.example/", ok: true, status: 200, body: GOOD_HTML },
      robotsTxt: { url: "https://acme.example/robots.txt", ok: false },
      sitemapXml: { url: "https://acme.example/sitemap.xml", ok: false },
      additionalSitemaps: [],
      llmsTxt: { url: "https://acme.example/llms.txt", ok: false },
    });
    expect(ctx.$).not.toBeNull();
    expect(ctx.$?.("title").text()).toContain("Acme");
  });

  it("leaves $ null when the homepage fetch failed", () => {
    const ctx = buildCheckContext({
      siteUrl: new URL("https://acme.example/"),
      homepage: { url: "https://acme.example/", ok: false, status: 500 },
      robotsTxt: { url: "https://acme.example/robots.txt", ok: false },
      sitemapXml: { url: "https://acme.example/sitemap.xml", ok: false },
      additionalSitemaps: [],
      llmsTxt: { url: "https://acme.example/llms.txt", ok: false },
    });
    expect(ctx.$).toBeNull();
  });
});

describe("loadSite", () => {
  it("validates the URL, fetches resources, and builds a context in one call", async () => {
    const fetchStub = makeFetchStub({
      "https://acme.example/": { body: GOOD_HTML },
      "https://acme.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://acme.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://acme.example/llms.txt": { status: 404, ok: false },
    });
    const ctx = await loadSite("https://acme.example/", fetchStub);
    expect(ctx.$).not.toBeNull();
    expect(ctx.resources.robotsTxt.ok).toBe(true);
  });

  it("rejects an invalid site URL before fetching anything", async () => {
    await expect(loadSite("not a url")).rejects.toThrow(/Invalid URL/);
  });
});
