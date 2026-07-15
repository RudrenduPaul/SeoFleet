import { describe, expect, it } from "vitest";
import { hasFailure, runChecks } from "../src/runner.js";
import type { Check, CheckContext } from "../src/types.js";

const dummyCtx: CheckContext = {
  resources: {
    siteUrl: new URL("https://example.com/"),
    homepage: { url: "https://example.com/", ok: true, status: 200, body: "<html></html>" },
    robotsTxt: { url: "https://example.com/robots.txt", ok: false },
    sitemapXml: { url: "https://example.com/sitemap.xml", ok: false },
    llmsTxt: { url: "https://example.com/llms.txt", ok: false },
  },
  $: null,
};

describe("runChecks", () => {
  it("runs every check and returns one result each", async () => {
    const checks: Check[] = [
      { id: "a", name: "A", category: "technical", run: () => ({ id: "a", name: "A", category: "technical", status: "PASS", message: "ok" }) },
      { id: "b", name: "B", category: "geo", run: async () => ({ id: "b", name: "B", category: "geo", status: "WARN", message: "meh" }) },
    ];
    const results = await runChecks(checks, dummyCtx);
    expect(results).toHaveLength(2);
    expect(results[0]?.status).toBe("PASS");
    expect(results[1]?.status).toBe("WARN");
  });

  it("turns a throwing check into a FAIL result instead of aborting the run", async () => {
    const checks: Check[] = [
      {
        id: "boom",
        name: "Boom",
        category: "technical",
        run: () => {
          throw new Error("kaboom");
        },
      },
      { id: "after", name: "After", category: "technical", run: () => ({ id: "after", name: "After", category: "technical", status: "PASS", message: "ok" }) },
    ];
    const results = await runChecks(checks, dummyCtx);
    expect(results).toHaveLength(2);
    expect(results[0]?.status).toBe("FAIL");
    expect(results[0]?.message).toMatch(/kaboom/);
    expect(results[1]?.status).toBe("PASS");
  });
});

describe("hasFailure", () => {
  it("is true when any result is FAIL", () => {
    expect(
      hasFailure([
        { id: "a", name: "A", category: "technical", status: "PASS", message: "" },
        { id: "b", name: "B", category: "technical", status: "FAIL", message: "" },
      ]),
    ).toBe(true);
  });

  it("is false when no result is FAIL", () => {
    expect(
      hasFailure([
        { id: "a", name: "A", category: "technical", status: "PASS", message: "" },
        { id: "b", name: "B", category: "technical", status: "WARN", message: "" },
      ]),
    ).toBe(false);
  });
});
