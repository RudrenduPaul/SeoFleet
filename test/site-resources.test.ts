import { describe, expect, it } from "vitest";
import { buildCheckContext, fetchSiteResources, loadSite } from "../src/site-resources.js";
import { GOOD_HTML, GOOD_ROBOTS_TXT, GOOD_SITEMAP_XML, makeFetchStub } from "./test-helpers.js";

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
  });
});

describe("buildCheckContext", () => {
  it("parses the homepage HTML when the fetch succeeded", () => {
    const ctx = buildCheckContext({
      siteUrl: new URL("https://acme.example/"),
      homepage: { url: "https://acme.example/", ok: true, status: 200, body: GOOD_HTML },
      robotsTxt: { url: "https://acme.example/robots.txt", ok: false },
      sitemapXml: { url: "https://acme.example/sitemap.xml", ok: false },
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
