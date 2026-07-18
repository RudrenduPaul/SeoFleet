import { describe, expect, it } from "vitest";
import { openGraphCheck } from "../../../src/checks/technical/open-graph.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("openGraphCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await openGraphCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when there are no Open Graph tags at all", async () => {
    const result = await openGraphCheck.run(makeCheckContext("<html><head></head></html>"));
    expect(result.status).toBe("WARN");
    expect(result.message).toContain("No Open Graph tags found");
  });

  it("WARNs and lists missing tags when some, but not all, are present", async () => {
    const html = `<html><head>
      <meta property="og:title" content="Acme Widgets">
      <meta property="og:description" content="Handmade widgets since 1990.">
    </head></html>`;
    const result = await openGraphCheck.run(makeCheckContext(html));
    expect(result.status).toBe("WARN");
    expect(result.message).toContain("og:image");
    expect(result.message).toContain("og:url");
  });

  it("PASSes when all required Open Graph tags are present", async () => {
    const html = `<html><head>
      <meta property="og:title" content="Acme Widgets">
      <meta property="og:description" content="Handmade widgets since 1990.">
      <meta property="og:image" content="https://acme.example/og.png">
      <meta property="og:url" content="https://acme.example/">
    </head></html>`;
    const result = await openGraphCheck.run(makeCheckContext(html));
    expect(result.status).toBe("PASS");
  });
});
