import { describe, expect, it } from "vitest";
import { linkHeaderCheck, parseLinkHeader } from "../../../src/checks/geo/link-header.js";
import type { CheckContext, SiteResources } from "../../../src/types.js";

function ctxWithHomepage(homepage: SiteResources["homepage"]): CheckContext {
  const siteUrl = new URL("https://acme.example/");
  return {
    resources: {
      siteUrl,
      homepage,
      robotsTxt: { url: "https://acme.example/robots.txt", ok: false, status: 404 },
      sitemapXml: { url: "https://acme.example/sitemap.xml", ok: false, status: 404 },
      llmsTxt: { url: "https://acme.example/llms.txt", ok: false, status: 404 },
    },
    $: null,
    fetchFn: async (url: string) => ({ url, ok: false, status: 404, error: "not stubbed" }),
  };
}

describe("parseLinkHeader", () => {
  it("parses a single link-value with a rel param", () => {
    const links = parseLinkHeader('<https://acme.example/feed>; rel="alternate"');
    expect(links).toEqual([{ url: "https://acme.example/feed", rel: "alternate", params: { rel: "alternate" } }]);
  });

  it("parses multiple comma-separated link-values", () => {
    const links = parseLinkHeader('<https://acme.example/feed>; rel="alternate", <https://acme.example/api>; rel="service-desc"');
    expect(links).toHaveLength(2);
    expect(links[0]?.url).toBe("https://acme.example/feed");
    expect(links[1]?.url).toBe("https://acme.example/api");
    expect(links[1]?.rel).toBe("service-desc");
  });

  it("does not split on a comma inside a quoted param value", () => {
    const links = parseLinkHeader('<https://acme.example/feed>; rel="alternate"; title="Home, Sweet Home"');
    expect(links).toHaveLength(1);
    expect(links[0]?.params.title).toBe("Home, Sweet Home");
  });

  it("returns an empty array for a header with no <url> shape", () => {
    expect(parseLinkHeader("not a link header")).toEqual([]);
  });

  it("handles a link-value with no params", () => {
    const links = parseLinkHeader("<https://acme.example/plain>");
    expect(links).toEqual([{ url: "https://acme.example/plain", params: {} }]);
  });
});

describe("linkHeaderCheck", () => {
  it("WARNs when the homepage sends no Link header", () => {
    const result = linkHeaderCheck.run(
      ctxWithHomepage({ url: "https://acme.example/", ok: true, status: 200, body: "<html></html>" }),
    );
    expect(result.status).toBe("WARN");
    expect(result.message).toMatch(/does not send/);
  });

  it("WARNs when the Link header is present but blank", () => {
    const result = linkHeaderCheck.run(
      ctxWithHomepage({ url: "https://acme.example/", ok: true, status: 200, body: "<html></html>", linkHeader: "   " }),
    );
    expect(result.status).toBe("WARN");
  });

  it("WARNs when the Link header can't be parsed as RFC 8288", () => {
    const result = linkHeaderCheck.run(
      ctxWithHomepage({
        url: "https://acme.example/",
        ok: true,
        status: 200,
        body: "<html></html>",
        linkHeader: "garbage, not a link",
      }),
    );
    expect(result.status).toBe("WARN");
    expect(result.message).toMatch(/could not be parsed/);
  });

  it("PASSes when the homepage sends a well-formed Link header", () => {
    const result = linkHeaderCheck.run(
      ctxWithHomepage({
        url: "https://acme.example/",
        ok: true,
        status: 200,
        body: "<html></html>",
        linkHeader: '<https://acme.example/feed>; rel="alternate"',
      }),
    );
    expect(result.status).toBe("PASS");
    expect(result.message).toMatch(/feed/);
    expect(result.message).toMatch(/rel="alternate"/);
  });

  it("PASSes and reports multiple entries when several links are present", () => {
    const result = linkHeaderCheck.run(
      ctxWithHomepage({
        url: "https://acme.example/",
        ok: true,
        status: 200,
        body: "<html></html>",
        linkHeader: '<https://acme.example/feed>; rel="alternate", <https://acme.example/api>; rel="service-desc"',
      }),
    );
    expect(result.status).toBe("PASS");
    expect(result.message).toMatch(/2 Link header entries/);
  });

  it("does not depend on the homepage DOM being parsed", () => {
    const result = linkHeaderCheck.run(
      ctxWithHomepage({
        url: "https://acme.example/",
        ok: false,
        status: 500,
        error: "unreachable",
        linkHeader: '<https://acme.example/feed>; rel="alternate"',
      }),
    );
    expect(result.status).toBe("PASS");
  });
});
