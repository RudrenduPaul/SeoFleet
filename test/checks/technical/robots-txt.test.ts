import { describe, expect, it } from "vitest";
import { robotsTxtCheck } from "../../../src/checks/technical/robots-txt.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("robotsTxtCheck", () => {
  it("FAILs when robots.txt is unreachable", async () => {
    const result = await robotsTxtCheck.run(
      makeCheckContext(null, { robotsTxt: { url: "https://acme.example/robots.txt", ok: false, status: 404 } }),
    );
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when robots.txt is reachable but has no User-agent directive", async () => {
    const result = await robotsTxtCheck.run(
      makeCheckContext(null, {
        robotsTxt: { url: "https://acme.example/robots.txt", ok: true, status: 200, body: "just some text" },
      }),
    );
    expect(result.status).toBe("WARN");
  });

  it("PASSes when robots.txt is reachable and has a User-agent directive", async () => {
    const result = await robotsTxtCheck.run(
      makeCheckContext(null, {
        robotsTxt: { url: "https://acme.example/robots.txt", ok: true, status: 200, body: "User-agent: *\nDisallow:\n" },
      }),
    );
    expect(result.status).toBe("PASS");
  });
});
