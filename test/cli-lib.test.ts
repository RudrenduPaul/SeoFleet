import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCheckCommand, runFleetCommand, runInitCommand } from "../src/cli-lib.js";
import { GOOD_HTML, GOOD_ROBOTS_TXT, GOOD_SITEMAP_XML, makeFetchStub } from "./test-helpers.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "seofleet-cli-lib-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runInitCommand", () => {
  it("returns exit code 0 and text output by default", () => {
    const result = runInitCommand(dir, { json: false });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("SeoFleet init");
  });

  it("returns JSON output when json:true", () => {
    const result = runInitCommand(dir, { json: true });
    expect(result.exitCode).toBe(0);
    expect(() => JSON.parse(result.stdout ?? "")).not.toThrow();
  });

  it("returns exit code 2 with a stderr message for an invalid siteUrl", () => {
    const result = runInitCommand(dir, { siteUrl: "not a url", json: false });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/Error:/);
  });
});

describe("runCheckCommand", () => {
  it("returns exit code 2 when the target is not a directory", async () => {
    const result = await runCheckCommand(path.join(dir, "does-not-exist"), { json: false });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/is not a directory/);
  });

  it("returns exit code 2 when seofleet.json is missing", async () => {
    const result = await runCheckCommand(dir, { json: false });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/Run `seofleet init/);
  });

  it("returns exit code 0 when every check passes", async () => {
    writeFileSync(path.join(dir, "seofleet.json"), JSON.stringify({ siteUrl: "https://good.example/" }), "utf-8");
    const fetchStub = makeFetchStub({
      "https://good.example/": { body: GOOD_HTML },
      "https://good.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://good.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://good.example/llms.txt": { status: 404, ok: false },
    });
    const result = await runCheckCommand(dir, { json: true }, fetchStub);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout ?? "");
    expect(parsed.summary.fail).toBe(0);
  });

  it("returns exit code 1 when at least one check fails", async () => {
    writeFileSync(path.join(dir, "seofleet.json"), JSON.stringify({ siteUrl: "https://bad.example/" }), "utf-8");
    const fetchStub = makeFetchStub({
      "https://bad.example/": { status: 500, ok: false },
      "https://bad.example/robots.txt": { status: 404, ok: false },
      "https://bad.example/sitemap.xml": { status: 404, ok: false },
      "https://bad.example/llms.txt": { status: 404, ok: false },
    });
    const result = await runCheckCommand(dir, { json: false }, fetchStub);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("[FAIL]");
  });
});

describe("runFleetCommand", () => {
  it("returns exit code 2 when the manifest is missing", async () => {
    const result = await runFleetCommand(path.join(dir, "nope.json"), { json: false });
    expect(result.exitCode).toBe(2);
  });

  it("returns exit code 0 when every site in the fleet passes", async () => {
    const clientA = path.join(dir, "client-a");
    writeFileSync(path.join(dir, "fleet.json"), JSON.stringify({ sites: [{ name: "a", path: "./client-a" }] }), "utf-8");
    const fs = await import("node:fs");
    fs.mkdirSync(clientA, { recursive: true });
    fs.writeFileSync(path.join(clientA, "seofleet.json"), JSON.stringify({ siteUrl: "https://good.example/" }), "utf-8");

    const fetchStub = makeFetchStub({
      "https://good.example/": { body: GOOD_HTML },
      "https://good.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://good.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://good.example/llms.txt": { status: 404, ok: false },
    });

    const result = await runFleetCommand(path.join(dir, "fleet.json"), { json: true }, fetchStub);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout ?? "");
    expect(parsed.summary.failed).toBe(0);
  });
});
