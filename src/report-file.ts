import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { LLMScoutError } from "./errors.js";
import { slugify } from "./slugify.js";

/**
 * Writes one auto-named report file into `outDir` -- `<slug(stem)>.json`
 * or `.txt` depending on `json` -- creating `outDir` (recursively) if it
 * doesn't already exist. Returns the absolute path written so callers can
 * surface it back to the user.
 *
 * `usedStems`, when passed, lets a caller writing several files in one run
 * (fleet mode, one call per manifest site) dedupe two sites that slugify
 * to the same stem -- e.g. two manifest entries both named "Blog" -- into
 * `blog.txt` and `blog-2.txt` instead of the second silently overwriting
 * the first.
 */
export function writeReportFile(
  outDir: string,
  stem: string,
  json: boolean,
  content: string,
  usedStems?: Map<string, number>,
): string {
  try {
    mkdirSync(outDir, { recursive: true });
  } catch (err) {
    throw new LLMScoutError(
      `Could not create --out-dir "${outDir}": ${err instanceof Error ? err.message : String(err)}`,
      2,
    );
  }

  let slug = slugify(stem);
  if (usedStems) {
    const seenCount = usedStems.get(slug) ?? 0;
    usedStems.set(slug, seenCount + 1);
    if (seenCount > 0) slug = `${slug}-${seenCount + 1}`;
  }

  const filePath = path.join(outDir, `${slug}.${json ? "json" : "txt"}`);
  try {
    writeFileSync(filePath, content, "utf-8");
  } catch (err) {
    throw new LLMScoutError(
      `Could not write report file "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
      2,
    );
  }
  return filePath;
}
