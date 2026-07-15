import { describe, expect, it } from "vitest";
import { titleCheck } from "../../../src/checks/technical/title.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("titleCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await titleCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("FAILs when there is no title tag", async () => {
    const result = await titleCheck.run(makeCheckContext("<html><head></head><body></body></html>"));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when the title is too short", async () => {
    const result = await titleCheck.run(makeCheckContext("<html><head><title>Hi</title></head></html>"));
    expect(result.status).toBe("WARN");
  });

  it("WARNs when the title is too long", async () => {
    const longTitle = "A".repeat(80);
    const result = await titleCheck.run(makeCheckContext(`<html><head><title>${longTitle}</title></head></html>`));
    expect(result.status).toBe("WARN");
  });

  it("PASSes for a well-sized title", async () => {
    const result = await titleCheck.run(
      makeCheckContext("<html><head><title>Acme Widgets -- Handmade Since 1990</title></head></html>"),
    );
    expect(result.status).toBe("PASS");
  });
});
