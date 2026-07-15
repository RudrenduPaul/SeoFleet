import { describe, expect, it } from "vitest";
import { faqSchemaCheck } from "../../../src/checks/geo/faq-schema.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("faqSchemaCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await faqSchemaCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs (not FAILs) when there is no FAQPage schema -- not every page has FAQ content", async () => {
    const result = await faqSchemaCheck.run(makeCheckContext("<html><head></head></html>"));
    expect(result.status).toBe("WARN");
  });

  it("ignores malformed JSON-LD rather than crashing", async () => {
    const result = await faqSchemaCheck.run(
      makeCheckContext('<html><head><script type="application/ld+json">{not json</script></head></html>'),
    );
    expect(result.status).toBe("WARN");
  });

  it("PASSes when FAQPage schema is present directly", async () => {
    const result = await faqSchemaCheck.run(
      makeCheckContext(
        '<html><head><script type="application/ld+json">{"@type":"FAQPage","mainEntity":[]}</script></head></html>',
      ),
    );
    expect(result.status).toBe("PASS");
  });

  it("PASSes when FAQPage schema is nested inside @graph", async () => {
    const result = await faqSchemaCheck.run(
      makeCheckContext(
        '<html><head><script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":"FAQPage"}]}</script></head></html>',
      ),
    );
    expect(result.status).toBe("PASS");
  });
});
