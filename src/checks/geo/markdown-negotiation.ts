import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "markdown-negotiation";
const NAME = "Markdown content negotiation";
const CATEGORY = "geo" as const;

export const markdownNegotiationCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  async run(ctx: CheckContext): Promise<CheckResult> {
    const base = { id: ID, name: NAME, category: CATEGORY };
    const url = ctx.resources.siteUrl.toString();

    const res = await ctx.fetchFn(url, { headers: { Accept: "text/markdown" } });
    const contentType = (res.contentType ?? "").toLowerCase();

    // Markdown content negotiation (responding to `Accept: text/markdown`
    // with an actual text/markdown body) is an emerging, forward-looking
    // convention that almost no site supports yet -- its absence is
    // informational only and never fails the run, same spirit as
    // llms-txt.ts.
    if (!res.ok || !contentType.includes("text/markdown")) {
      const message = res.ok
        ? `Requesting ${url} with "Accept: text/markdown" returned Content-Type "${res.contentType ?? "unknown"}" instead of text/markdown.`
        : `Could not verify Markdown content negotiation at ${url} (the request failed).`;
      return {
        ...base,
        status: "WARN",
        message,
        fix: 'Optional: serve a text/markdown representation of pages when the client sends "Accept: text/markdown" so LLM-based agents can fetch clean Markdown directly instead of parsing HTML.',
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `${url} returns Content-Type "${res.contentType}" when requested with "Accept: text/markdown".`,
    };
  },
};
