import { describe, expect, it } from "vitest";
import { contentExtractionCheck } from "../../../src/checks/geo/content-extraction.js";
import { BAD_HTML, GOOD_HTML, makeCheckContext } from "../../test-helpers.js";

describe("contentExtractionCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await contentExtractionCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("WARNs when there is no heading or paragraph structure at all", async () => {
    const result = await contentExtractionCheck.run(
      makeCheckContext("<html><body><div>just text, nothing else, no structure whatsoever</div></body></html>"),
    );
    expect(result.status).toBe("WARN");
  });

  it("WARNs when a large block of text has no internal structure", async () => {
    const result = await contentExtractionCheck.run(makeCheckContext(BAD_HTML));
    expect(result.status).toBe("WARN");
  });

  it("PASSes for well-structured content with headings and paragraphs", async () => {
    const result = await contentExtractionCheck.run(makeCheckContext(GOOD_HTML));
    expect(result.status).toBe("PASS");
  });
});
