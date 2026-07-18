import { describe, expect, it } from "vitest";
import { redirectChainCheck } from "../../../src/checks/technical/redirect-chain.js";
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

describe("redirectChainCheck", () => {
  it("PASSes when the homepage has no hops recorded", () => {
    const result = redirectChainCheck.run(
      ctxWithHomepage({ url: "https://acme.example/", ok: true, status: 200, body: "<html></html>" }),
    );
    expect(result.status).toBe("PASS");
    expect(result.message).toMatch(/no redirects/);
  });

  it("PASSes for a chain of 1-2 hops", () => {
    const result = redirectChainCheck.run(
      ctxWithHomepage({
        url: "https://acme.example/final",
        ok: true,
        status: 200,
        body: "<html></html>",
        hops: [{ url: "https://acme.example/", status: 301 }],
      }),
    );
    expect(result.status).toBe("PASS");
  });

  it("WARNs when the chain is longer than 2 hops", () => {
    const result = redirectChainCheck.run(
      ctxWithHomepage({
        url: "https://acme.example/final",
        ok: true,
        status: 200,
        body: "<html></html>",
        hops: [
          { url: "https://acme.example/", status: 301 },
          { url: "https://acme.example/step2", status: 301 },
          { url: "https://acme.example/step3", status: 302 },
        ],
      }),
    );
    expect(result.status).toBe("WARN");
    expect(result.message).toMatch(/3 redirect hops/);
  });

  it("FAILs when an intermediate hop returned a 4xx/5xx status", () => {
    const result = redirectChainCheck.run(
      ctxWithHomepage({
        url: "https://acme.example/",
        ok: false,
        status: 500,
        error: "boom",
        hops: [{ url: "https://acme.example/", status: 500 }],
      }),
    );
    expect(result.status).toBe("FAIL");
    expect(result.message).toMatch(/HTTP 500/);
  });

  it("FAILs even for a short chain if one hop errored", () => {
    const result = redirectChainCheck.run(
      ctxWithHomepage({
        url: "https://acme.example/",
        ok: false,
        status: 404,
        hops: [{ url: "https://acme.example/old", status: 404 }],
      }),
    );
    expect(result.status).toBe("FAIL");
  });
});
