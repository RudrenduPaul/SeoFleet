import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeReportFile } from "../src/report-file.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "llmscout-report-file-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("writeReportFile", () => {
  it("writes a .txt file named from a slugified stem", () => {
    const outDir = path.join(dir, "reports");
    const filePath = writeReportFile(outDir, "https://good.example/", false, "report body");
    expect(filePath).toBe(path.join(outDir, "good-example.txt"));
    expect(readFileSync(filePath, "utf-8")).toBe("report body");
  });

  it("writes a .json file when json is true", () => {
    const outDir = path.join(dir, "reports");
    const filePath = writeReportFile(outDir, "client-a", true, "{}");
    expect(filePath).toBe(path.join(outDir, "client-a.json"));
  });

  it("creates outDir recursively when it doesn't already exist", () => {
    const outDir = path.join(dir, "nested", "reports");
    expect(existsSync(outDir)).toBe(false);
    writeReportFile(outDir, "client-a", false, "x");
    expect(existsSync(outDir)).toBe(true);
  });

  it("dedupes two stems that slugify identically via the shared usedStems map", () => {
    const outDir = path.join(dir, "reports");
    const usedStems = new Map<string, number>();
    const first = writeReportFile(outDir, "Blog", false, "first", usedStems);
    const second = writeReportFile(outDir, "Blog", false, "second", usedStems);
    expect(first).toBe(path.join(outDir, "blog.txt"));
    expect(second).toBe(path.join(outDir, "blog-2.txt"));
    expect(readFileSync(first, "utf-8")).toBe("first");
    expect(readFileSync(second, "utf-8")).toBe("second");
  });

  it("does not dedupe across separate calls when usedStems isn't passed", () => {
    const outDir = path.join(dir, "reports");
    writeReportFile(outDir, "Blog", false, "first");
    writeReportFile(outDir, "Blog", false, "second");
    // Same stem, no shared usedStems map -> second call overwrites the first.
    expect(readFileSync(path.join(outDir, "blog.txt"), "utf-8")).toBe("second");
  });
});
