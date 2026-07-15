import { describe, expect, it } from "vitest";
import { metaDescriptionCheck } from "../../../src/checks/technical/meta-description.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("metaDescriptionCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await metaDescriptionCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when there is no meta description", async () => {
    const result = await metaDescriptionCheck.run(makeCheckContext("<html><head></head></html>"));
    expect(result.status).toBe("WARN");
  });

  it("WARNs when the meta description is too short", async () => {
    const result = await metaDescriptionCheck.run(
      makeCheckContext('<html><head><meta name="description" content="Too short."></head></html>'),
    );
    expect(result.status).toBe("WARN");
  });

  it("PASSes for a well-sized meta description", async () => {
    const content = "A".repeat(100);
    const result = await metaDescriptionCheck.run(
      makeCheckContext(`<html><head><meta name="description" content="${content}"></head></html>`),
    );
    expect(result.status).toBe("PASS");
  });
});
