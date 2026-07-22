import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "image-weight";
const NAME = "Image weight";
const CATEGORY = "technical" as const;

const WARN_BYTES = 200 * 1024; // 200 KB per image
const FAIL_BYTES = 500 * 1024; // 500 KB per image

// A page with dozens of <img> tags shouldn't fire dozens of simultaneous
// HEAD requests at the target server -- capped concurrency, same spirit as
// the parallel-but-bounded fetches elsewhere in the codebase.
const CONCURRENCY = 5;

interface MeasuredImage {
  url: string;
  bytes: number;
}

/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once.
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Resolves every distinct <img src> on the page against the site URL,
 * dropping unparseable and non-http(s) srcs (e.g. `data:` URIs) -- those
 * aren't a network-weight concern this check can measure.
 */
function collectImageUrls(ctx: CheckContext): URL[] {
  const $ = ctx.$ as NonNullable<CheckContext["$"]>;
  const srcs = new Set<string>();
  $("img").each((_i, el) => {
    const src = $(el).attr("src");
    if (src) srcs.add(src);
  });

  const urls: URL[] = [];
  for (const src of srcs) {
    try {
      const resolved = new URL(src, ctx.resources.siteUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") urls.push(resolved);
    } catch {
      // an unparseable src is a markup problem, not this check's concern
    }
  }
  return urls;
}

export const imageWeightCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  async run(ctx: CheckContext): Promise<CheckResult> {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so image weight could not be checked.",
        fix: "Confirm siteUrl in llmscout.json is correct and reachable.",
      };
    }

    const urls = collectImageUrls(ctx);
    if (urls.length === 0) {
      return {
        ...base,
        status: "PASS",
        message: "No <img> tags with an http(s) src to measure.",
      };
    }

    const outcomes = await mapWithConcurrency(urls, CONCURRENCY, async (url): Promise<MeasuredImage | null> => {
      const res = await ctx.fetchFn(url.toString(), { method: "HEAD" });
      if (!res.ok || res.contentLength === undefined) return null;
      return { url: url.toString(), bytes: res.contentLength };
    });

    const measured = outcomes.filter((m): m is MeasuredImage => m !== null);
    const unmeasured = urls.length - measured.length;

    if (measured.length === 0) {
      return {
        ...base,
        status: "PASS",
        message: `Could not determine file size for any of ${urls.length} image(s) (no reachable Content-Length); nothing to flag.`,
      };
    }

    const totalBytes = measured.reduce((sum, m) => sum + m.bytes, 0);
    const failing = measured.filter((m) => m.bytes > FAIL_BYTES);
    const warning = measured.filter((m) => m.bytes > WARN_BYTES && m.bytes <= FAIL_BYTES);

    const unmeasuredNote = unmeasured > 0 ? ` (${unmeasured} image(s) could not be measured and were excluded)` : "";
    const totalNote = `Total measured page image weight: ${formatKb(totalBytes)} across ${measured.length} image(s)${unmeasuredNote}.`;

    if (failing.length > 0) {
      const worst = failing.slice().sort((a, b) => b.bytes - a.bytes)[0] as MeasuredImage;
      return {
        ...base,
        status: "FAIL",
        message: `${failing.length} image(s) exceed ${formatKb(FAIL_BYTES)} (largest: ${worst.url} at ${formatKb(worst.bytes)}). ${totalNote}`,
        fix: "Compress or resize oversized images (or serve a modern format like WebP/AVIF) so no single image exceeds 500 KB.",
      };
    }

    if (warning.length > 0) {
      const worst = warning.slice().sort((a, b) => b.bytes - a.bytes)[0] as MeasuredImage;
      return {
        ...base,
        status: "WARN",
        message: `${warning.length} image(s) exceed ${formatKb(WARN_BYTES)} (largest: ${worst.url} at ${formatKb(worst.bytes)}). ${totalNote}`,
        fix: "Consider compressing or resizing these images to keep individual image weight under 200 KB.",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: `All measured images are under ${formatKb(WARN_BYTES)}. ${totalNote}`,
    };
  },
};
