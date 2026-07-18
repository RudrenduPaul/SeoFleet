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
