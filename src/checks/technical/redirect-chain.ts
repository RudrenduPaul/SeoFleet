import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "redirect-chain";
const NAME = "Redirect chain";
const CATEGORY = "technical" as const;

// A single 301/302 straight to the canonical URL is normal and harmless;
// beyond that each extra hop costs crawl budget and latency.
const WARN_HOP_THRESHOLD = 2;

export const redirectChainCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };
    const hops = ctx.resources.homepage.hops;

    if (!hops || hops.length === 0) {
      return {
        ...base,
        status: "PASS",
        message: "The homepage resolved with no redirects.",
      };
    }

    const errorHops = hops.filter((h) => h.status >= 400 && h.status < 600);
    if (errorHops.length > 0) {
      const bad = errorHops[0] as { url: string; status: number };
      return {
        ...base,
        status: "FAIL",
        message: `The homepage's redirect chain includes a hop that returned an error status: ${bad.url} (HTTP ${bad.status}).`,
        fix: "Fix or remove the broken hop so the redirect chain leads cleanly to the final page.",
      };
    }

    const chain = hops.map((h) => `${h.url} (${h.status})`).join(" -> ");

    if (hops.length > WARN_HOP_THRESHOLD) {
      return {
        ...base,
        status: "WARN",
        message: `The homepage resolves through ${hops.length} redirect hops before reaching its final URL: ${chain} -> ${ctx.resources.homepage.url}.`,
        fix: "Point links and internal references directly at the final destination URL to collapse the chain to at most one hop.",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `The homepage resolves through ${hops.length} redirect hop(s) before reaching its final URL: ${chain} -> ${ctx.resources.homepage.url}.`,
    };
  },
};
