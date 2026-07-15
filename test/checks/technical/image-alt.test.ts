import { describe, expect, it } from "vitest";
import { imageAltCheck } from "../../../src/checks/technical/image-alt.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("imageAltCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await imageAltCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("PASSes when there are no images", async () => {
    const result = await imageAltCheck.run(makeCheckContext("<html><body><p>No images here</p></body></html>"));
    expect(result.status).toBe("PASS");
  });

  it("PASSes when every image has an alt attribute", async () => {
    const result = await imageAltCheck.run(
      makeCheckContext('<html><body><img src="a.png" alt="A"><img src="b.png" alt=""></body></html>'),
    );
    expect(result.status).toBe("PASS");
  });

  it("WARNs when most images have alt but a few are missing it", async () => {
    const imgs = Array.from({ length: 9 }, (_, i) => `<img src="${i}.png" alt="img ${i}">`).join("") + '<img src="missing.png">';
    const result = await imageAltCheck.run(makeCheckContext(`<html><body>${imgs}</body></html>`));
    expect(result.status).toBe("WARN");
  });

  it("FAILs when most images are missing alt", async () => {
    const result = await imageAltCheck.run(
      makeCheckContext('<html><body><img src="a.png"><img src="b.png"><img src="c.png" alt="ok"></body></html>'),
    );
    expect(result.status).toBe("FAIL");
  });
});
