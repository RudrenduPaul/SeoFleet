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
    const homepage = ctx.resources.homepage;
    const hops = homepage.hops;

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

    // A hop entry is only ever pushed inside safeFetch's own 3xx redirect
    // branch, so by construction every entry in `hops` is a 3xx status --
    // the errorHops filter above can never match real fetch output. When
    // the chain dead-ends in a 4xx/5xx, that status lands on the terminal
    // resource itself (its own status/ok), not as a hops entry, so it has
    // to be checked here instead.
    if (!homepage.ok && homepage.status !== undefined && homepage.status >= 400 && homepage.status < 600) {
      return {
        ...base,
        status: "FAIL",
        message: `The homepage's redirect chain leads to an error status: ${chain} -> ${homepage.url} (HTTP ${homepage.status}).`,
        fix: "Fix or remove the broken hop so the redirect chain leads cleanly to the final page.",
      };
    }

    if (hops.length > WARN_HOP_THRESHOLD) {
      return {
        ...base,
        status: "WARN",
        message: `The homepage resolves through ${hops.length} redirect hops before reaching its final URL: ${chain} -> ${homepage.url}.`,
        fix: "Point links and internal references directly at the final destination URL to collapse the chain to at most one hop.",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `The homepage resolves through ${hops.length} redirect hop(s) before reaching its final URL: ${chain} -> ${homepage.url}.`,
    };
  },
};
