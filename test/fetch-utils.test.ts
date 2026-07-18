import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_AGENT, assertHttpUrl, safeFetch, withUserAgent } from "../src/fetch-utils.js";
import { LLMScoutError } from "../src/errors.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assertHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(assertHttpUrl("https://example.com").href).toBe("https://example.com/");
    expect(assertHttpUrl("http://example.com").href).toBe("http://example.com/");
  });

  it("rejects malformed URLs", () => {
    expect(() => assertHttpUrl("not a url")).toThrow(LLMScoutError);
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => assertHttpUrl("file:///etc/passwd")).toThrow(LLMScoutError);
    expect(() => assertHttpUrl("ftp://example.com")).toThrow(LLMScoutError);
  });

  it("rejects loopback, private, and link-local IP literals", () => {
    expect(() => assertHttpUrl("http://127.0.0.1/")).toThrow(/loopback, private, or link-local/);
    expect(() => assertHttpUrl("http://169.254.169.254/latest/meta-data/")).toThrow(
      /loopback, private, or link-local/,
    );
    expect(() => assertHttpUrl("http://10.0.0.5/")).toThrow(/loopback, private, or link-local/);
    expect(() => assertHttpUrl("http://172.16.0.1/")).toThrow(/loopback, private, or link-local/);
    expect(() => assertHttpUrl("http://192.168.1.1/")).toThrow(/loopback, private, or link-local/);
    expect(() => assertHttpUrl("http://[::1]/")).toThrow(/loopback, private, or link-local/);
    expect(() => assertHttpUrl("http://localhost/")).toThrow(/loopback, private, or link-local/);
  });

  it("accepts public IP literals and ordinary hostnames", () => {
    expect(assertHttpUrl("http://8.8.8.8/").hostname).toBe("8.8.8.8");
    expect(assertHttpUrl("https://example.com").hostname).toBe("example.com");
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

  it("refuses to follow a redirect into a loopback/private/link-local host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } })),
    );
    const result = await safeFetch("https://example.com/start");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/loopback, private, or link-local/);
  });

  it("passes an abort signal with a timeout to fetch", async () => {
    const fetchMock = vi.fn(async () => new Response("hello", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await safeFetch("https://example.com");
    const callInit = fetchMock.mock.calls[0][1];
    expect(callInit.signal).toBeInstanceOf(AbortSignal);
  });

  it("caps the response body instead of buffering it unbounded", async () => {
    const oversized = "a".repeat(11 * 1024 * 1024); // over the 10 MiB cap
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(oversized, { status: 200 })),
    );
    const result = await safeFetch("https://example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exceeded.*byte limit/);
  });

  it("exposes the Content-Length header as contentLength when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("hello", { status: 200, headers: { "content-length": "5" } })),
    );
    const result = await safeFetch("https://example.com");
    expect(result.contentLength).toBe(5);
  });

  it("leaves contentLength undefined when the header is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("hello", { status: 200 })),
    );
    const result = await safeFetch("https://example.com");
    expect(result.contentLength).toBeUndefined();
  });

  it("exposes the Content-Type header as contentType when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("# Hi", { status: 200, headers: { "content-type": "text/markdown; charset=utf-8" } })),
    );
    const result = await safeFetch("https://example.com");
    expect(result.contentType).toBe("text/markdown; charset=utf-8");
  });

  it("leaves contentType undefined when the header is absent", async () => {
    // A string body makes Response auto-set Content-Type -- use a null body
    // (as a HEAD-style response would have) to get a response with truly
    // no Content-Type header.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    const result = await safeFetch("https://example.com");
    expect(result.contentType).toBeUndefined();
  });

  it("exposes the Link header as linkHeader when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("hello", { status: 200, headers: { link: '<https://example.com/feed>; rel="alternate"' } }),
      ),
    );
    const result = await safeFetch("https://example.com");
    expect(result.linkHeader).toBe('<https://example.com/feed>; rel="alternate"');
  });

  it("leaves linkHeader undefined when the header is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("hello", { status: 200 })),
    );
    const result = await safeFetch("https://example.com");
    expect(result.linkHeader).toBeUndefined();
  });

  it("has no hops for a direct, non-redirected fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("hello", { status: 200 })),
    );
    const result = await safeFetch("https://example.com");
    expect(result.hops).toBeUndefined();
  });

  it("records each redirect hop's url and status, in order, on the final result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://example.com/b" } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://example.com/c" } }))
      .mockResolvedValueOnce(new Response("final", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await safeFetch("https://example.com/a");
    expect(result.ok).toBe(true);
    expect(result.hops).toEqual([
      { url: "https://example.com/a", status: 301 },
      { url: "https://example.com/b", status: 302 },
    ]);
  });

  it("records hops seen so far even when the chain ultimately fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://example.com/b" } }))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await safeFetch("https://example.com/a");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.hops).toEqual([{ url: "https://example.com/a", status: 301 }]);
  });

  it("passes through an explicit method (e.g. HEAD) to the underlying fetch", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200, headers: { "content-length": "1234" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await safeFetch("https://example.com/image.png", { method: "HEAD" });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });
    expect(result.contentLength).toBe(1234);
  });

  it("sends a Chrome-like default User-Agent when the caller sets none", async () => {
    const fetchMock = vi.fn(async () => new Response("hello", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await safeFetch("https://example.com");
    const callInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(callInit.headers);
    expect(headers.get("user-agent")).toBe(DEFAULT_USER_AGENT);
    expect(DEFAULT_USER_AGENT).toMatch(/Chrome/);
  });

  it("lets a caller-supplied User-Agent header override the default", async () => {
    const fetchMock = vi.fn(async () => new Response("hello", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await safeFetch("https://example.com", { headers: { "User-Agent": "MyCustomBot/1.0" } });
    const callInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(callInit.headers);
    expect(headers.get("user-agent")).toBe("MyCustomBot/1.0");
  });

  it("preserves the custom User-Agent across a redirect hop", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://example.com/final" } }))
      .mockResolvedValueOnce(new Response("final page", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await safeFetch("https://example.com/start", { headers: { "User-Agent": "MyCustomBot/1.0" } });
    for (const call of fetchMock.mock.calls) {
      const headers = new Headers((call[1] as RequestInit).headers);
      expect(headers.get("user-agent")).toBe("MyCustomBot/1.0");
    }
  });
});

describe("withUserAgent", () => {
  it("builds a FetchFn that sends the given User-Agent", async () => {
    const fetchMock = vi.fn(async () => new Response("hello", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const fetchFn = withUserAgent("MyCustomBot/1.0");
    const result = await fetchFn("https://example.com");
    expect(result.ok).toBe(true);
    const callInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(callInit.headers);
    expect(headers.get("user-agent")).toBe("MyCustomBot/1.0");
  });
});
