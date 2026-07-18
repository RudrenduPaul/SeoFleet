import { describe, expect, it } from "vitest";
import { sitemapXmlCheck } from "../../../src/checks/technical/sitemap-xml.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("sitemapXmlCheck", () => {
  it("WARNs when sitemap.xml is unreachable", async () => {
    const result = await sitemapXmlCheck.run(
      makeCheckContext(null, { sitemapXml: { url: "https://acme.example/sitemap.xml", ok: false, status: 404 } }),
    );
    expect(result.status).toBe("WARN");
  });

  it("FAILs when sitemap.xml is reachable but not valid sitemap XML", async () => {
    const result = await sitemapXmlCheck.run(
      makeCheckContext(null, {
        sitemapXml: { url: "https://acme.example/sitemap.xml", ok: true, status: 200, body: "<html>not a sitemap</html>" },
      }),
    );
    expect(result.status).toBe("FAIL");
  });

  it("FAILs with a CDN-interception message when the reachable body is HTML-shaped (e.g. Cloudflare challenge page)", async () => {
    const result = await sitemapXmlCheck.run(
      makeCheckContext(null, {
        sitemapXml: {
          url: "https://acme.example/sitemap.xml",
          ok: true,
          status: 200,
          body: "<!doctype html><html><head><title>Attention Required!</title></head><body>Cloudflare</body></html>",
        },
      }),
    );
    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("CDN");
    expect(result.message).toContain("Cloudflare");
    expect(result.message).not.toContain("missing <urlset> or <sitemapindex>");
  });

  it("FAILs with a CDN-interception message when the body is a bare <html> tag with leading whitespace", async () => {
    const result = await sitemapXmlCheck.run(
      makeCheckContext(null, {
        sitemapXml: {
          url: "https://acme.example/sitemap.xml",
          ok: true,
          status: 200,
          body: "\n  <html><body>Access denied</body></html>",
        },
      }),
    );
    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("CDN");
  });

  it("FAILs with the generic malformed-XML message when the body is not HTML-shaped", async () => {
    const result = await sitemapXmlCheck.run(
      makeCheckContext(null, {
        sitemapXml: {
          url: "https://acme.example/sitemap.xml",
          ok: true,
          status: 200,
          body: "<urlst><url><loc>https://acme.example/</loc></url></urlst>",
        },
      }),
    );
    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("missing <urlset> or <sitemapindex>");
    expect(result.message).not.toContain("CDN");
  });

  it("PASSes when sitemap.xml is reachable and looks valid", async () => {
    const result = await sitemapXmlCheck.run(
      makeCheckContext(null, {
        sitemapXml: {
          url: "https://acme.example/sitemap.xml",
          ok: true,
          status: 200,
          body: '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://acme.example/</loc></url></urlset>',
        },
      }),
    );
    expect(result.status).toBe("PASS");
  });

  it("PASSes when /sitemap.xml fails but a robots.txt-discovered candidate is valid", async () => {
    const result = await sitemapXmlCheck.run(
      makeCheckContext(null, {
        sitemapXml: { url: "https://acme.example/sitemap.xml", ok: false, status: 404 },
        additionalSitemaps: [
          {
            url: "https://acme.example/sitemap_index.xml",
            ok: true,
            status: 200,
            body: '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://acme.example/s1.xml</loc></sitemap></sitemapindex>',
          },
        ],
      }),
    );
    expect(result.status).toBe("PASS");
    expect(result.message).toContain("sitemap_index.xml");
  });

  it("FAILs when /sitemap.xml is unreachable and the only reachable candidate is invalid XML", async () => {
    const result = await sitemapXmlCheck.run(
      makeCheckContext(null, {
        sitemapXml: { url: "https://acme.example/sitemap.xml", ok: false, status: 404 },
        additionalSitemaps: [
          { url: "https://acme.example/sitemap_index.xml", ok: true, status: 200, body: "<html>not a sitemap</html>" },
        ],
      }),
    );
    expect(result.status).toBe("FAIL");
  });

  it("WARNs only once both /sitemap.xml and every robots.txt-discovered candidate fail", async () => {
    const result = await sitemapXmlCheck.run(
      makeCheckContext(null, {
        sitemapXml: { url: "https://acme.example/sitemap.xml", ok: false, status: 404 },
        additionalSitemaps: [{ url: "https://acme.example/sitemap_index.xml", ok: false, status: 404 }],
      }),
    );
    expect(result.status).toBe("WARN");
    expect(result.message).toContain("sitemap.xml");
    expect(result.message).toContain("sitemap_index.xml");
  });
});
