import { afterEach, describe, expect, it, vi } from "vitest";
import { redirectChainCheck } from "../../../src/checks/technical/redirect-chain.js";
import { safeFetch } from "../../../src/fetch-utils.js";
import type { CheckContext, SiteResources } from "../../../src/types.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("FAILs when a redirect chain dead-ends in a terminal error status", async () => {
    // Real safeFetch output: a hop entry only ever comes from safeFetch's
    // own 3xx redirect branch, so an error can never appear as a hops[]
    // entry -- it always lands on the final FetchedResource's own
    // status/ok instead. Drive the real fetch wrapper through a 301 that
    // dead-ends in a 404 so the test exercises a shape safeFetch can
    // actually produce, rather than a hand-built hops array it never would.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://acme.example/gone" } }))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const homepage = await safeFetch("https://acme.example/");
    expect(homepage.ok).toBe(false);
    expect(homepage.status).toBe(404);
    expect(homepage.hops).toEqual([{ url: "https://acme.example/", status: 301 }]);

    const result = redirectChainCheck.run(ctxWithHomepage(homepage));
    expect(result.status).toBe("FAIL");
    expect(result.message).toMatch(/HTTP 404/);
  });

  it("FAILs even for a single redirect if the chain dead-ends in an error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://acme.example/old" } }))
      .mockResolvedValueOnce(new Response("server error", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const homepage = await safeFetch("https://acme.example/");
    const result = redirectChainCheck.run(ctxWithHomepage(homepage));
    expect(result.status).toBe("FAIL");
  });
});
