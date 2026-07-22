import { describe, expect, it } from "vitest";
import { organizationSchemaCheck } from "../../../src/checks/geo/organization-schema.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("organizationSchemaCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await organizationSchemaCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when there is no Organization/Person schema at all", async () => {
    const result = await organizationSchemaCheck.run(makeCheckContext("<html><head></head></html>"));
    expect(result.status).toBe("WARN");
    expect(result.message).toContain("No Organization");
  });

  it("ignores malformed JSON-LD rather than crashing", async () => {
    const result = await organizationSchemaCheck.run(
      makeCheckContext('<html><head><script type="application/ld+json">{not json</script></head></html>'),
    );
    expect(result.status).toBe("WARN");
  });

  it("WARNs when Organization schema is present but has no sameAs", async () => {
    const html =
      '<html><head><script type="application/ld+json">{"@type":"Organization","name":"Acme Widgets"}</script></head></html>';
    const result = await organizationSchemaCheck.run(makeCheckContext(html));
    expect(result.status).toBe("WARN");
    expect(result.message).toContain("sameAs");
  });

  it("WARNs when sameAs is present but an empty array", async () => {
    const html =
      '<html><head><script type="application/ld+json">{"@type":"Organization","name":"Acme","sameAs":[]}</script></head></html>';
    const result = await organizationSchemaCheck.run(makeCheckContext(html));
    expect(result.status).toBe("WARN");
  });

  it("PASSes when Organization schema has a non-empty sameAs array", async () => {
    const html =
      '<html><head><script type="application/ld+json">' +
      '{"@type":"Organization","name":"Acme Widgets","sameAs":["https://twitter.com/acme","https://linkedin.com/company/acme"]}' +
      "</script></head></html>";
    const result = await organizationSchemaCheck.run(makeCheckContext(html));
    expect(result.status).toBe("PASS");
  });

  it("PASSes when @type is an array of types, per the schema.org multi-type pattern", async () => {
    const html =
      '<html><head><script type="application/ld+json">' +
      '{"@type":["Organization","LocalBusiness"],"name":"Acme Widgets","sameAs":["https://twitter.com/acme"]}' +
      "</script></head></html>";
    const result = await organizationSchemaCheck.run(makeCheckContext(html));
    expect(result.status).toBe("PASS");
  });

  it("PASSes for a Person schema with sameAs, found nested inside @graph", async () => {
    const html =
      '<html><head><script type="application/ld+json">' +
      '{"@graph":[{"@type":"WebSite"},{"@type":"Person","name":"Jane Doe","sameAs":["https://twitter.com/janedoe"]}]}' +
      "</script></head></html>";
    const result = await organizationSchemaCheck.run(makeCheckContext(html));
    expect(result.status).toBe("PASS");
  });
});
