import { describe, expect, it } from "vitest";
import { twitterCardCheck } from "../../../src/checks/technical/twitter-card.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("twitterCardCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await twitterCardCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when there is no twitter:card meta tag", async () => {
    const result = await twitterCardCheck.run(makeCheckContext("<html><head></head></html>"));
    expect(result.status).toBe("WARN");
  });

  it("FAILs when twitter:card has an unrecognized value", async () => {
    const html = '<html><head><meta name="twitter:card" content="not-a-real-type"></head></html>';
    const result = await twitterCardCheck.run(makeCheckContext(html));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when twitter:card is valid but title/description/image are missing", async () => {
    const html = '<html><head><meta name="twitter:card" content="summary_large_image"></head></html>';
    const result = await twitterCardCheck.run(makeCheckContext(html));
    expect(result.status).toBe("WARN");
    expect(result.message).toContain("twitter:title");
  });

  it("PASSes when twitter:card is valid and all fields are present", async () => {
    const html = `<html><head>
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="Acme Widgets">
      <meta name="twitter:description" content="Handmade widgets since 1990.">
      <meta name="twitter:image" content="https://acme.example/twitter.png">
    </head></html>`;
    const result = await twitterCardCheck.run(makeCheckContext(html));
    expect(result.status).toBe("PASS");
  });
});
