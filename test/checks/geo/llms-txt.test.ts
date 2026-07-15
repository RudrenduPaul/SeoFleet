import { describe, expect, it } from "vitest";
import { llmsTxtCheck } from "../../../src/checks/geo/llms-txt.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("llmsTxtCheck", () => {
  it("WARNs (not FAILs) when llms.txt is absent -- it is an optional, emerging convention", async () => {
    const result = await llmsTxtCheck.run(
      makeCheckContext(null, { llmsTxt: { url: "https://acme.example/llms.txt", ok: false, status: 404 } }),
    );
    expect(result.status).toBe("WARN");
  });

  it("WARNs when llms.txt is reachable but empty", async () => {
    const result = await llmsTxtCheck.run(
      makeCheckContext(null, { llmsTxt: { url: "https://acme.example/llms.txt", ok: true, status: 200, body: "   " } }),
    );
    expect(result.status).toBe("WARN");
  });

  it("PASSes when llms.txt is present and non-empty", async () => {
    const result = await llmsTxtCheck.run(
      makeCheckContext(null, {
        llmsTxt: { url: "https://acme.example/llms.txt", ok: true, status: 200, body: "# Acme\nSummary." },
      }),
    );
    expect(result.status).toBe("PASS");
  });
});
