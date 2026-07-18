import { describe, expect, it } from "vitest";
import { ALL_CHECKS, GEO_CHECKS, TECHNICAL_CHECKS } from "../../src/checks/index.js";

describe("check registry", () => {
  it("has at least 14 checks across the two categories", () => {
    expect(ALL_CHECKS.length).toBeGreaterThanOrEqual(14);
    expect(ALL_CHECKS.length).toBe(TECHNICAL_CHECKS.length + GEO_CHECKS.length);
  });

  it("every technical check is actually categorized technical", () => {
    for (const check of TECHNICAL_CHECKS) expect(check.category).toBe("technical");
  });

  it("every geo check is actually categorized geo", () => {
    for (const check of GEO_CHECKS) expect(check.category).toBe("geo");
  });

  it("has unique check ids", () => {
    const ids = ALL_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
