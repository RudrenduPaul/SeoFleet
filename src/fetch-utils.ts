import { LLMScoutError } from "./errors.js";

/**
 * The result of fetching a single resource (a page, robots.txt, sitemap.xml,
 * llms.txt). Never throws for ordinary network failure -- callers treat an
 * unreachable resource as data (a check result), not an exception.
 */
export interface FetchedResource {
  url: string;
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
}

const MAX_REDIRECTS = 5;

/**
 * Parses a user-supplied string as a URL and rejects anything that isn't
 * http(s). This is the only place a raw string becomes a URL used for
 * network access -- every fetch in this codebase routes through here (or
 * through safeFetch, which calls this) so there is one guard to audit.
 */
export function assertHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LLMScoutError(`Invalid URL: "${raw}"`, 2);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new LLMScoutError(
      `Unsupported URL scheme "${url.protocol}" in "${raw}". Only http and https are allowed.`,
      2,
    );
  }
  return url;
}

/**
 * A fetch wrapper that:
 *   - only ever dials http(s) (assertHttpUrl guards the entry point)
 *   - follows redirects manually, one hop at a time, and refuses to follow
 *     a redirect whose Location targets a non-http(s) scheme (e.g.
 *     file:// or ftp://) -- the SSRF-adjacent trick this guards against
 *   - bounds the number of hops so a redirect loop can't hang the process
 *   - never throws for network-level failure; failures come back as
 *     `{ ok: false, error }` so callers can turn them into check results
 *     instead of crashing the whole run.
 */
export async function safeFetch(rawUrl: string, init?: RequestInit): Promise<FetchedResource> {
  let current: URL;
  try {
    current = assertHttpUrl(rawUrl);
  } catch (err) {
    return {
      url: rawUrl,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await fetch(current.toString(), { ...init, redirect: "manual" });
    } catch (err) {
      return {
        url: current.toString(),
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      const location = response.headers.get("location") as string;
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return {
          url: current.toString(),
          ok: false,
          status: response.status,
          error: `Redirect to an invalid location: "${location}"`,
        };
      }
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        return {
          url: current.toString(),
          ok: false,
          status: response.status,
          error: `Refused to follow redirect to non-http(s) scheme "${next.protocol}"`,
        };
      }
      current = next;
      continue;
    }

    const body = await response.text();
    return { url: current.toString(), ok: response.ok, status: response.status, body };
  }

  return {
    url: current.toString(),
    ok: false,
    error: `Too many redirects (> ${MAX_REDIRECTS})`,
  };
}
