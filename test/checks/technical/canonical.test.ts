import { describe, expect, it } from "vitest";
import { canonicalCheck } from "../../../src/checks/technical/canonical.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("canonicalCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await canonicalCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when there is no canonical tag", async () => {
    const result = await canonicalCheck.run(makeCheckContext("<html><head></head></html>"));
    expect(result.status).toBe("WARN");
  });

  it("PASSes for a valid absolute canonical", async () => {
    const result = await canonicalCheck.run(
      makeCheckContext('<html><head><link rel="canonical" href="https://acme.example/"></head></html>'),
    );
    expect(result.status).toBe("PASS");
  });

  it("PASSes for a valid root-relative canonical, resolved against siteUrl", async () => {
    const result = await canonicalCheck.run(
      makeCheckContext('<html><head><link rel="canonical" href="/page"></head></html>'),
    );
    expect(result.status).toBe("PASS");
  });

  it("FAILs when the canonical href is not a valid URL", async () => {
    const result = await canonicalCheck.run(
      makeCheckContext('<html><head><link rel="canonical" href="http://[::1"></head></html>'),
    );
    expect(result.status).toBe("FAIL");
  });
});
