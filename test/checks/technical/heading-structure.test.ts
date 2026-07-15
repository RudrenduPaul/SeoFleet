import { describe, expect, it } from "vitest";
import { headingStructureCheck } from "../../../src/checks/technical/heading-structure.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("headingStructureCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await headingStructureCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("FAILs when there is no h1", async () => {
    const result = await headingStructureCheck.run(makeCheckContext("<html><body><h2>Sub</h2></body></html>"));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when there is more than one h1", async () => {
    const result = await headingStructureCheck.run(
      makeCheckContext("<html><body><h1>One</h1><h1>Two</h1></body></html>"),
    );
    expect(result.status).toBe("WARN");
  });

  it("WARNs when heading levels skip", async () => {
    const result = await headingStructureCheck.run(
      makeCheckContext("<html><body><h1>One</h1><h3>Skipped to h3</h3></body></html>"),
    );
    expect(result.status).toBe("WARN");
  });

  it("PASSes for a single h1 with a sane hierarchy", async () => {
    const result = await headingStructureCheck.run(
      makeCheckContext("<html><body><h1>One</h1><h2>Two</h2><h3>Three</h3></body></html>"),
    );
    expect(result.status).toBe("PASS");
  });
});
