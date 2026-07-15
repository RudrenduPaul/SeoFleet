import { describe, expect, it } from "vitest";
import { structuredDataCheck } from "../../../src/checks/geo/structured-data.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("structuredDataCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await structuredDataCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when there is no JSON-LD", async () => {
    const result = await structuredDataCheck.run(makeCheckContext("<html><head></head></html>"));
    expect(result.status).toBe("WARN");
  });

  it("FAILs when a JSON-LD block is malformed", async () => {
    const result = await structuredDataCheck.run(
      makeCheckContext('<html><head><script type="application/ld+json">{not valid json</script></head></html>'),
    );
    expect(result.status).toBe("FAIL");
  });

  it("PASSes when JSON-LD is present and valid", async () => {
    const result = await structuredDataCheck.run(
      makeCheckContext(
        '<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script></head></html>',
      ),
    );
    expect(result.status).toBe("PASS");
  });
});
