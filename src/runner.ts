import type { Check, CheckContext, CheckResult } from "./types.js";

/**
 * Runs a list of checks against a single CheckContext, in order, and always
 * returns one CheckResult per check -- a check throwing is itself turned
 * into a FAIL result rather than aborting the whole run, so one buggy or
 * unexpectedly-erroring check never hides the other 11.
 */
export async function runChecks(checks: Check[], ctx: CheckContext): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    try {
      results.push(await check.run(ctx));
    } catch (err) {
      results.push({
        id: check.id,
        name: check.name,
        category: check.category,
        status: "FAIL",
        message: `Check errored: ${err instanceof Error ? err.message : String(err)}`,
        fix: "This is likely a bug in SeoFleet itself -- please file an issue with the site you ran against.",
      });
    }
  }
  return results;
}

export function hasFailure(results: CheckResult[]): boolean {
  return results.some((r) => r.status === "FAIL");
}
