import { describe, expect, it } from "vitest";
import { robotsMetaDirectivesCheck } from "../../../src/checks/technical/robots-meta-directives.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("robotsMetaDirectivesCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await robotsMetaDirectivesCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when there is no meta robots tag", async () => {
    const result = await robotsMetaDirectivesCheck.run(makeCheckContext("<html><head></head></html>"));
    expect(result.status).toBe("WARN");
  });

  it("FAILs when the meta robots tag includes noindex", async () => {
    const html = '<html><head><meta name="robots" content="noindex, max-snippet:-1"></head></html>';
    const result = await robotsMetaDirectivesCheck.run(makeCheckContext(html));
    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("noindex");
  });

  it("WARNs when the meta robots tag has no advanced directives at all", async () => {
    const html = '<html><head><meta name="robots" content="index, follow"></head></html>';
    const result = await robotsMetaDirectivesCheck.run(makeCheckContext(html));
    expect(result.status).toBe("WARN");
  });

  it("WARNs and lists what's missing when only some advanced directives are present", async () => {
    const html = '<html><head><meta name="robots" content="max-snippet:-1"></head></html>';
    const result = await robotsMetaDirectivesCheck.run(makeCheckContext(html));
    expect(result.status).toBe("WARN");
    expect(result.message).toContain("max-image-preview");
    expect(result.message).toContain("max-video-preview");
  });

  it("PASSes when all advanced directives are present", async () => {
    const html =
      '<html><head><meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1"></head></html>';
    const result = await robotsMetaDirectivesCheck.run(makeCheckContext(html));
    expect(result.status).toBe("PASS");
  });
});
