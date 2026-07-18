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
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MiB

function parseIPv4(hostname: string): [number, number, number, number] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return null;
  const octets = match.slice(1, 5).map(Number);
  return octets.every((o) => o <= 255) ? (octets as [number, number, number, number]) : null;
}

function isPrivateIPv4([a, b]: [number, number, number, number]): boolean {
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC 1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
  if (a === 192 && b === 168) return true; // RFC 1918
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata (169.254.169.254)
  if (a === 0) return true; // "this network"
  return false;
}

/**
 * True if `hostname` is an IP literal (or "localhost") in loopback,
 * private, or link-local address space -- the obvious SSRF payloads
 * (http://127.0.0.1, http://169.254.169.254/..., http://192.168.x.x).
 *
 * This does NOT resolve DNS names to see where they point: a public
 * hostname that resolves to a private address at connect time (DNS
 * rebinding) isn't caught here, since Node's fetch doesn't expose the
 * resolved address to pin against. Closing that fully would need a
 * connect-time IP check, which is a larger change than this guard.
 */
function isBlockedHost(hostname: string): boolean {
  // WHATWG URL keeps brackets on an IPv6 hostname (e.g. "[::1]") -- strip
  // them so the literal-address checks below match the bare address.
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost") return true;

  const ipv4 = parseIPv4(host);
  if (ipv4) return isPrivateIPv4(ipv4);

  if (host === "::1" || host === "::") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true; // link-local / unique-local IPv6

  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(host);
  if (mapped?.[1]) {
    const mappedOctets = parseIPv4(mapped[1]);
    if (mappedOctets) return isPrivateIPv4(mappedOctets);
  }

  return false;
}

/**
 * Parses a user-supplied string as a URL and rejects anything that isn't
 * http(s), or that targets a loopback/private/link-local host. This is the
 * only place a raw string becomes a URL used for network access -- every
 * fetch in this codebase routes through here (or through safeFetch, which
 * calls this and re-runs the host check on every redirect hop) so there is
 * one guard to audit.
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
  if (isBlockedHost(url.hostname)) {
    throw new LLMScoutError(
      `Refused to fetch "${raw}": target host is a loopback, private, or link-local address.`,
      2,
    );
  }
  return url;
}

/**
 * Reads a response body up to maxBytes, cancelling the stream instead of
 * buffering it unbounded once the cap is exceeded -- a stalling or huge
 * response can't hang or OOM an unattended fleet scan.
 */
async function readBodyCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    return await response.text();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response body exceeded ${maxBytes}-byte limit`);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

/**
 * A fetch wrapper that:
 *   - only ever dials http(s) at a non-loopback/private/link-local host
 *     (assertHttpUrl guards the entry point; the same check re-runs on
 *     every redirect hop below)
 *   - follows redirects manually, one hop at a time, and refuses to follow
 *     a redirect whose Location targets a non-http(s) scheme (e.g.
 *     file:// or ftp://) or a blocked host -- the SSRF-adjacent tricks
 *     this guards against
 *   - bounds the number of hops so a redirect loop can't hang the process
 *   - bounds the connection with a timeout and the response body with a
 *     byte cap, so a stalling or oversized response can't hang or OOM an
 *     unattended fleet scan
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
      response = await fetch(current.toString(), {
        ...init,
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
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
      if (isBlockedHost(next.hostname)) {
        return {
          url: current.toString(),
          ok: false,
          status: response.status,
          error: `Refused to follow redirect to a loopback, private, or link-local address`,
        };
      }
      current = next;
      continue;
    }

    let body: string;
    try {
      body = await readBodyCapped(response, MAX_BODY_BYTES);
    } catch (err) {
      return {
        url: current.toString(),
        ok: false,
        status: response.status,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    return { url: current.toString(), ok: response.ok, status: response.status, body };
  }

  return {
    url: current.toString(),
    ok: false,
    error: `Too many redirects (> ${MAX_REDIRECTS})`,
  };
}
