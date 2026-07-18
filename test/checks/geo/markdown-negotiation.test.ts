import { describe, expect, it } from "vitest";
import { markdownNegotiationCheck } from "../../../src/checks/geo/markdown-negotiation.js";
import { makeCheckContext } from "../../test-helpers.js";
import type { FetchedResource } from "../../../src/fetch-utils.js";
import type { FetchFn } from "../../../src/types.js";

describe("markdownNegotiationCheck", () => {
  it("WARNs when the server returns standard HTML instead of markdown", async () => {
    const fetchFn: FetchFn = async (url: string): Promise<FetchedResource> => ({
      url,
      ok: true,
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<html></html>",
    });
    const result = await markdownNegotiationCheck.run(makeCheckContext(null, {}, "https://acme.example/", fetchFn));
    expect(result.status).toBe("WARN");
    expect(result.message).toMatch(/text\/html/);
  });

  it("WARNs when the negotiation request fails outright", async () => {
    const fetchFn: FetchFn = async (url: string): Promise<FetchedResource> => ({
      url,
      ok: false,
      status: 500,
      error: "boom",
    });
    const result = await markdownNegotiationCheck.run(makeCheckContext(null, {}, "https://acme.example/", fetchFn));
    expect(result.status).toBe("WARN");
    expect(result.message).toMatch(/request failed/);
  });

  it("WARNs when Content-Type is absent even though the request succeeded", async () => {
    const fetchFn: FetchFn = async (url: string): Promise<FetchedResource> => ({
      url,
      ok: true,
      status: 200,
      body: "<html></html>",
    });
    const result = await markdownNegotiationCheck.run(makeCheckContext(null, {}, "https://acme.example/", fetchFn));
    expect(result.status).toBe("WARN");
  });

  it("PASSes when the server honors Accept: text/markdown", async () => {
    const fetchFn: FetchFn = async (url: string): Promise<FetchedResource> => ({
      url,
      ok: true,
      status: 200,
      contentType: "text/markdown; charset=utf-8",
      body: "# Acme",
    });
    const result = await markdownNegotiationCheck.run(makeCheckContext(null, {}, "https://acme.example/", fetchFn));
    expect(result.status).toBe("PASS");
    expect(result.message).toMatch(/text\/markdown/);
  });

  it("sends Accept: text/markdown on the request it makes", async () => {
    let seenAccept: string | null = null;
    const fetchFn: FetchFn = async (url: string, init?: RequestInit): Promise<FetchedResource> => {
      seenAccept = new Headers(init?.headers).get("accept");
      return { url, ok: true, status: 200, contentType: "text/html", body: "<html></html>" };
    };
    await markdownNegotiationCheck.run(makeCheckContext(null, {}, "https://acme.example/", fetchFn));
    expect(seenAccept).toBe("text/markdown");
  });

  it("requests the site's own URL, not some other resource", async () => {
    let requestedUrl: string | undefined;
    const fetchFn: FetchFn = async (url: string): Promise<FetchedResource> => {
      requestedUrl = url;
      return { url, ok: true, status: 200, contentType: "text/html", body: "<html></html>" };
    };
    await markdownNegotiationCheck.run(makeCheckContext(null, {}, "https://acme.example/", fetchFn));
    expect(requestedUrl).toBe("https://acme.example/");
  });
});
