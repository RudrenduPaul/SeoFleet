import { afterEach, describe, expect, it, vi } from "vitest";
import { assertHttpUrl, safeFetch } from "../src/fetch-utils.js";
import { SeoFleetError } from "../src/errors.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assertHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(assertHttpUrl("https://example.com").href).toBe("https://example.com/");
    expect(assertHttpUrl("http://example.com").href).toBe("http://example.com/");
  });

  it("rejects malformed URLs", () => {
    expect(() => assertHttpUrl("not a url")).toThrow(SeoFleetError);
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => assertHttpUrl("file:///etc/passwd")).toThrow(SeoFleetError);
    expect(() => assertHttpUrl("ftp://example.com")).toThrow(SeoFleetError);
  });
});

describe("safeFetch", () => {
  it("returns ok:false for an invalid URL without throwing", async () => {
    const result = await safeFetch("not a url");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Invalid URL/);
  });

  it("returns ok:false for a non-http(s) URL without throwing", async () => {
    const result = await safeFetch("file:///etc/passwd");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unsupported URL scheme/);
  });

  it("fetches a normal 200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("hello", { status: 200 })),
    );
    const result = await safeFetch("https://example.com");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.body).toBe("hello");
  });

  it("returns ok:false with status for a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    );
    const result = await safeFetch("https://example.com/missing");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("follows an http(s) redirect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://example.com/final" } }))
      .mockResolvedValueOnce(new Response("final page", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await safeFetch("https://example.com/start");
    expect(result.ok).toBe(true);
    expect(result.body).toBe("final page");
    expect(result.url).toBe("https://example.com/final");
  });

  it("resolves a relative redirect Location against the current URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/final" } }))
      .mockResolvedValueOnce(new Response("final page", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await safeFetch("https://example.com/start");
    expect(result.url).toBe("https://example.com/final");
  });

  it("refuses to follow a redirect into a non-http(s) scheme", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "file:///etc/passwd" } })),
    );
    const result = await safeFetch("https://example.com/start");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/non-http\(s\) scheme/);
  });

  it("gives up on a redirect with an invalid Location", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://[" } })),
    );
    const result = await safeFetch("https://example.com/start");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid location/);
  });

  it("bounds the number of redirect hops", async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: "https://example.com/loop" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await safeFetch("https://example.com/loop");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Too many redirects/);
  });

  it("returns ok:false on a network-level throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const result = await safeFetch("https://example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ECONNREFUSED/);
  });
});
