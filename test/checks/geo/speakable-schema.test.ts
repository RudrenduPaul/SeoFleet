import { describe, expect, it } from "vitest";
import { speakableSchemaCheck } from "../../../src/checks/geo/speakable-schema.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("speakableSchemaCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await speakableSchemaCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs (not FAILs) when there is no Speakable schema -- not every page needs voice-search markup", async () => {
    const result = await speakableSchemaCheck.run(makeCheckContext("<html><head></head></html>"));
    expect(result.status).toBe("WARN");
  });

  it("ignores malformed JSON-LD rather than crashing", async () => {
    const result = await speakableSchemaCheck.run(
      makeCheckContext('<html><head><script type="application/ld+json">{not json</script></head></html>'),
    );
    expect(result.status).toBe("WARN");
  });

  it("PASSes when a SpeakableSpecification @type is present directly", async () => {
    const result = await speakableSchemaCheck.run(
      makeCheckContext(
        '<html><head><script type="application/ld+json">{"@type":"SpeakableSpecification","cssSelector":["h1",".summary"]}</script></head></html>',
      ),
    );
    expect(result.status).toBe("PASS");
  });

  it("PASSes when speakable is a nested property on a WebPage node", async () => {
    const html =
      '<html><head><script type="application/ld+json">' +
      '{"@context":"https://schema.org","@type":"WebPage","speakable":{"@type":"SpeakableSpecification","cssSelector":["h1"]}}' +
      "</script></head></html>";
    const result = await speakableSchemaCheck.run(makeCheckContext(html));
    expect(result.status).toBe("PASS");
  });

  it("PASSes when SpeakableSpecification is nested inside @graph", async () => {
    const html =
      '<html><head><script type="application/ld+json">' +
      '{"@graph":[{"@type":"Organization"},{"@type":"SpeakableSpecification","cssSelector":["h1"]}]}' +
      "</script></head></html>";
    const result = await speakableSchemaCheck.run(makeCheckContext(html));
    expect(result.status).toBe("PASS");
  });
});
