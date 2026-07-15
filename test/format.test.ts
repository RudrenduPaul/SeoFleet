import { describe, expect, it } from "vitest";
import {
  formatCheckResultsJson,
  formatCheckResultsText,
  formatFleetResultsJson,
  formatFleetResultsText,
  formatInitResultJson,
  formatInitResultText,
  summarizeResults,
} from "../src/format.js";
import type { CheckResult } from "../src/types.js";
import type { FleetSiteResult } from "../src/fleet.js";
import type { InitResult } from "../src/init.js";

const results: CheckResult[] = [
  { id: "title", name: "Title tag", category: "technical", status: "PASS", message: "Good title." },
  { id: "robots-txt", name: "robots.txt", category: "technical", status: "FAIL", message: "Unreachable.", fix: "Add one." },
  { id: "llms-txt", name: "llms.txt", category: "geo", status: "WARN", message: "Missing.", fix: "Optional." },
];

describe("summarizeResults", () => {
  it("counts pass/fail/warn", () => {
    expect(summarizeResults(results)).toEqual({ pass: 1, fail: 1, warn: 1 });
  });
});

describe("formatCheckResultsText", () => {
  it("includes each check's status, message, fix, and a summary line", () => {
    const text = formatCheckResultsText("https://acme.example/", results);
    expect(text).toContain("[FAIL]");
    expect(text).toContain("Unreachable.");
    expect(text).toContain("Fix: Add one.");
    expect(text).toContain("Summary: 1 PASS, 1 WARN, 1 FAIL (3 checks)");
  });
});

describe("formatCheckResultsJson", () => {
  it("emits parseable structured JSON with the same data", () => {
    const parsed = JSON.parse(formatCheckResultsJson("https://acme.example/", results));
    expect(parsed.siteUrl).toBe("https://acme.example/");
    expect(parsed.summary).toEqual({ pass: 1, warn: 1, fail: 1, total: 3 });
    expect(parsed.results).toHaveLength(3);
  });
});

const fleetResults: FleetSiteResult[] = [
  { name: "client-a", path: "/clients/a", ok: true, results: [results[0] as CheckResult] },
  { name: "client-b", path: "/clients/b", ok: false, results: results },
  { name: "client-c", path: "/clients/c", ok: false, results: [], error: "boom" },
];

describe("formatFleetResultsText", () => {
  it("reports each site's status and an overall fleet summary", () => {
    const text = formatFleetResultsText(fleetResults);
    expect(text).toContain("[PASS] client-a");
    expect(text).toContain("[FAIL] client-b");
    expect(text).toContain("[ERROR] client-c");
    expect(text).toContain("Fleet summary: 1 site(s) passed, 1 site(s) failed, 1 site(s) errored (3 total).");
  });
});

describe("formatFleetResultsJson", () => {
  it("emits parseable structured JSON", () => {
    const parsed = JSON.parse(formatFleetResultsJson(fleetResults));
    expect(parsed.summary).toEqual({ passed: 1, failed: 1, errored: 1, total: 3 });
    expect(parsed.sites).toHaveLength(3);
  });
});

const initResult: InitResult = {
  projectPath: "/proj",
  configFile: "/proj/LLMScout.json",
  configCreated: true,
  skillFile: "/proj/.claude/skills/LLMScout/SKILL.md",
  skillCreated: true,
};

describe("formatInitResultText", () => {
  it("reports what was created and next steps when the config is new", () => {
    const text = formatInitResultText(initResult);
    expect(text).toContain("Created /proj/LLMScout.json");
    expect(text).toContain("Next:");
  });

  it("reports files were left untouched when already present", () => {
    const text = formatInitResultText({ ...initResult, configCreated: false, skillCreated: false });
    expect(text).toContain("already exists, left untouched");
    expect(text).not.toContain("Next:");
  });
});

describe("formatInitResultJson", () => {
  it("emits the result object as JSON", () => {
    expect(JSON.parse(formatInitResultJson(initResult))).toEqual(initResult);
  });
});
