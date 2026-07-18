import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "link-header";
const NAME = "Link header (RFC 8288)";
const CATEGORY = "geo" as const;

export interface ParsedLink {
  url: string;
  rel?: string;
  params: Record<string, string>;
}

/**
 * Splits a raw header value on top-level commas -- i.e. commas that are
 * neither inside a `<...>` URI-reference nor inside a `"..."` quoted
 * param value. RFC 8288 link-values themselves can contain commas in a
 * quoted title param (`title="a, b"`), so a naive `split(",")` would
 * misparse a multi-link header in that case.
 */
function splitTopLevel(header: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuotes = false;
  let current = "";
  for (const ch of header) {
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === "<") depth++;
      if (ch === ">") depth = Math.max(0, depth - 1);
    }
    if (ch === "," && depth === 0 && !inQuotes) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/**
 * Parses a raw RFC 8288 Link header value into one entry per link-value,
 * e.g. `<https://example.com/feed>; rel="alternate"` becomes
 * `{ url: "https://example.com/feed", rel: "alternate", params: { rel: "alternate" } }`.
 * Entries that don't match the `<url>; params` shape are dropped rather
 * than throwing -- a malformed header is data for the check to report on,
 * not a reason to crash the run.
 */
export function parseLinkHeader(header: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  for (const rawPart of splitTopLevel(header)) {
    const part = rawPart.trim();
    if (!part) continue;

    const match = /^<([^>]*)>(.*)$/.exec(part);
    if (!match) continue;
    const url = match[1] ?? "";
    const paramsRaw = match[2] ?? "";

    const params: Record<string, string> = {};
    for (const rawParam of paramsRaw.split(";")) {
      const paramPart = rawParam.trim();
      if (!paramPart) continue;
      const eq = paramPart.indexOf("=");
      if (eq === -1) continue;
      const key = paramPart.slice(0, eq).trim().toLowerCase();
      let value = paramPart.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      params[key] = value;
    }

    links.push({ url, ...(params.rel !== undefined ? { rel: params.rel } : {}), params });
  }
  return links;
}

export const linkHeaderCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };
    const header = ctx.resources.homepage.linkHeader;

    // An RFC 8288 Link header is machine-readable service discovery
    // (alternate feeds, API entry points, rel="describedby" schemas, etc.)
    // that almost no site sends today -- its absence is informational only
    // and never fails the run, same spirit as llms-txt.ts.
    if (!header || !header.trim()) {
      return {
        ...base,
        status: "WARN",
        message: "The homepage does not send a Link response header.",
        fix: 'Optional: add an RFC 8288 Link response header (e.g. <https://example.com/feed>; rel="alternate") to advertise machine-readable service-discovery endpoints to crawlers and AI agents.',
      };
    }

    const links = parseLinkHeader(header);
    if (links.length === 0) {
      return {
        ...base,
        status: "WARN",
        message: `The homepage sends a Link header that could not be parsed as RFC 8288: "${header}".`,
        fix: 'Optional: format the Link header per RFC 8288, e.g. <https://example.com/feed>; rel="alternate".',
      };
    }

    const summary = links.map((l) => (l.rel ? `${l.url} (rel="${l.rel}")` : l.url)).join(", ");
    return {
      ...base,
      status: "PASS",
      message: `The homepage sends ${links.length} Link header entr${links.length === 1 ? "y" : "ies"}: ${summary}.`,
    };
  },
};
