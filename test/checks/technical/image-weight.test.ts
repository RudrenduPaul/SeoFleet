import { describe, expect, it } from "vitest";
import { imageWeightCheck } from "../../../src/checks/technical/image-weight.js";
import { makeCheckContext } from "../../test-helpers.js";
import type { FetchedResource } from "../../../src/fetch-utils.js";
import type { FetchFn } from "../../../src/types.js";

function stubByContentLength(sizes: Record<string, number>): FetchFn {
  return async (url: string): Promise<FetchedResource> => {
    const bytes = sizes[url];
    if (bytes === undefined) return { url, ok: false, status: 404, error: "not stubbed" };
    return { url, ok: true, status: 200, contentLength: bytes };
  };
}

describe("imageWeightCheck", () => {
  it("FAILs when the homepage could not be fetched", async () => {
    const result = await imageWeightCheck.run(makeCheckContext(null));
    expect(result.status).toBe("FAIL");
  });

  it("PASSes when there are no images", async () => {
    const result = await imageWeightCheck.run(makeCheckContext("<html><body><p>No images</p></body></html>"));
    expect(result.status).toBe("PASS");
  });

  it("PASSes when no <img> src is http(s) (e.g. only data: URIs)", async () => {
    const result = await imageWeightCheck.run(
      makeCheckContext('<html><body><img src="data:image/png;base64,AAAA"></body></html>'),
    );
    expect(result.status).toBe("PASS");
    expect(result.message).toMatch(/http\(s\)/);
  });

  it("PASSes and does not flag anything when no image's size could be determined", async () => {
    const result = await imageWeightCheck.run(
      makeCheckContext(
        '<html><body><img src="/a.png"></body></html>',
        {},
        "https://acme.example/",
        async (url) => ({ url, ok: false, status: 404, error: "not stubbed" }),
      ),
    );
    expect(result.status).toBe("PASS");
    expect(result.message).toMatch(/Could not determine file size/);
  });

  it("PASSes when every measured image is under the WARN threshold", async () => {
    const fetchFn = stubByContentLength({
      "https://acme.example/a.png": 50 * 1024,
      "https://acme.example/b.png": 100 * 1024,
    });
    const result = await imageWeightCheck.run(
      makeCheckContext(
        '<html><body><img src="/a.png"><img src="/b.png"></body></html>',
        {},
        "https://acme.example/",
        fetchFn,
      ),
    );
    expect(result.status).toBe("PASS");
    expect(result.message).toMatch(/150\.0 KB/);
  });

  it("WARNs when an image exceeds 200 KB but no image exceeds 500 KB", async () => {
    const fetchFn = stubByContentLength({ "https://acme.example/big.png": 300 * 1024 });
    const result = await imageWeightCheck.run(
      makeCheckContext('<html><body><img src="/big.png"></body></html>', {}, "https://acme.example/", fetchFn),
    );
    expect(result.status).toBe("WARN");
  });

  it("FAILs when an image exceeds 500 KB", async () => {
    const fetchFn = stubByContentLength({ "https://acme.example/huge.png": 600 * 1024 });
    const result = await imageWeightCheck.run(
      makeCheckContext('<html><body><img src="/huge.png"></body></html>', {}, "https://acme.example/", fetchFn),
    );
    expect(result.status).toBe("FAIL");
    expect(result.message).toMatch(/500\.0 KB/);
  });

  it("resolves a relative src against the site URL before fetching", async () => {
    let requestedUrl: string | undefined;
    const fetchFn: FetchFn = async (url: string) => {
      requestedUrl = url;
      return { url, ok: true, status: 200, contentLength: 1024 };
    };
    await imageWeightCheck.run(
      makeCheckContext('<html><body><img src="images/hero.png"></body></html>', {}, "https://acme.example/page/", fetchFn),
    );
    expect(requestedUrl).toBe("https://acme.example/page/images/hero.png");
  });

  it("issues HEAD requests, not GET", async () => {
    let seenMethod: string | undefined;
    const fetchFn: FetchFn = async (url: string, init?: RequestInit) => {
      seenMethod = init?.method;
      return { url, ok: true, status: 200, contentLength: 1024 };
    };
    await imageWeightCheck.run(
      makeCheckContext('<html><body><img src="/a.png"></body></html>', {}, "https://acme.example/", fetchFn),
    );
    expect(seenMethod).toBe("HEAD");
  });

  it("reports the single largest offender when multiple images exceed the FAIL threshold", async () => {
    const fetchFn = stubByContentLength({
      "https://acme.example/fail-a.png": 600 * 1024,
      "https://acme.example/fail-b.png": 900 * 1024,
    });
    const result = await imageWeightCheck.run(
      makeCheckContext(
        '<html><body><img src="/fail-a.png"><img src="/fail-b.png"></body></html>',
        {},
        "https://acme.example/",
        fetchFn,
      ),
    );
    expect(result.status).toBe("FAIL");
    expect(result.message).toMatch(/fail-b\.png/);
    expect(result.message).toMatch(/2 image\(s\)/);
  });

  it("reports the single largest offender when multiple images exceed the WARN threshold", async () => {
    const fetchFn = stubByContentLength({
      "https://acme.example/warn-a.png": 250 * 1024,
      "https://acme.example/warn-b.png": 350 * 1024,
    });
    const result = await imageWeightCheck.run(
      makeCheckContext(
        '<html><body><img src="/warn-a.png"><img src="/warn-b.png"></body></html>',
        {},
        "https://acme.example/",
        fetchFn,
      ),
    );
    expect(result.status).toBe("WARN");
    expect(result.message).toMatch(/warn-b\.png/);
  });

  it("mentions the FAIL is worse than the WARN, prioritizing FAIL when both apply", async () => {
    const fetchFn = stubByContentLength({
      "https://acme.example/warn.png": 300 * 1024,
      "https://acme.example/fail.png": 600 * 1024,
    });
    const result = await imageWeightCheck.run(
      makeCheckContext(
        '<html><body><img src="/warn.png"><img src="/fail.png"></body></html>',
        {},
        "https://acme.example/",
        fetchFn,
      ),
    );
    expect(result.status).toBe("FAIL");
  });
});
