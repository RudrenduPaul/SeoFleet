import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadFleetManifest, runFleet } from "../src/fleet.js";
import { LLMScoutError } from "../src/errors.js";
import { GOOD_HTML, GOOD_ROBOTS_TXT, GOOD_SITEMAP_XML, makeFetchStub } from "./test-helpers.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "LLMScout-fleet-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeManifest(relPath: string, obj: unknown): string {
  const file = path.join(dir, relPath);
  writeFileSync(file, JSON.stringify(obj), "utf-8");
  return file;
}

describe("loadFleetManifest", () => {
  it("throws a usage error when the manifest file is missing", () => {
    expect(() => loadFleetManifest(path.join(dir, "nope.json"))).toThrow(LLMScoutError);
  });

  it("throws a usage error on malformed JSON", () => {
    const file = path.join(dir, "manifest.json");
    writeFileSync(file, "{not json", "utf-8");
    expect(() => loadFleetManifest(file)).toThrow(/not valid JSON/);
  });

  it("throws a usage error when sites is missing or not an array", () => {
    const file = writeManifest("manifest.json", { sites: "nope" });
    expect(() => loadFleetManifest(file)).toThrow(/"sites" array/);
  });

  it("throws a usage error when an entry is missing name or path", () => {
    const file = writeManifest("manifest.json", { sites: [{ name: "client-a" }] });
    expect(() => loadFleetManifest(file)).toThrow(/missing a "path"/);
  });

  it("resolves relative paths against the manifest's own directory", () => {
    mkdirSync(path.join(dir, "clients", "a"), { recursive: true });
    const file = writeManifest("manifest.json", { sites: [{ name: "client-a", path: "./clients/a" }] });
    const manifest = loadFleetManifest(file);
    expect(manifest.sites[0]?.path).toBe(path.join(dir, "clients", "a"));
  });
});

describe("runFleet", () => {
  it("runs the full check suite against every site and reports per-site pass/fail", async () => {
    const clientA = path.join(dir, "client-a");
    const clientB = path.join(dir, "client-b");
    mkdirSync(clientA, { recursive: true });
    mkdirSync(clientB, { recursive: true });
    writeFileSync(path.join(clientA, "LLMScout.json"), JSON.stringify({ siteUrl: "https://good.example/" }), "utf-8");
    writeFileSync(path.join(clientB, "LLMScout.json"), JSON.stringify({ siteUrl: "https://bad.example/" }), "utf-8");

    const manifestFile = writeManifest("fleet.json", {
      sites: [
        { name: "client-a", path: "./client-a" },
        { name: "client-b", path: "./client-b" },
      ],
    });

    const fetchStub = makeFetchStub({
      "https://good.example/": { body: GOOD_HTML },
      "https://good.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://good.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://good.example/llms.txt": { status: 404, ok: false },
      "https://bad.example/": { status: 500, ok: false },
      "https://bad.example/robots.txt": { status: 404, ok: false },
      "https://bad.example/sitemap.xml": { status: 404, ok: false },
      "https://bad.example/llms.txt": { status: 404, ok: false },
    });

    const results = await runFleet(manifestFile, fetchStub);
    expect(results).toHaveLength(2);
    const a = results.find((r) => r.name === "client-a");
    const b = results.find((r) => r.name === "client-b");
    expect(a?.ok).toBe(true);
    expect(b?.ok).toBe(false);
  });

  it("captures a per-site error (e.g. missing LLMScout.json) without aborting the rest of the fleet", async () => {
    const clientA = path.join(dir, "client-a");
    mkdirSync(clientA, { recursive: true }); // no LLMScout.json written
    const manifestFile = writeManifest("fleet.json", { sites: [{ name: "client-a", path: "./client-a" }] });

    const results = await runFleet(manifestFile, makeFetchStub({}));
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.error).toMatch(/Run `LLMScout init/);
  });

  it("writes one auto-named report .txt file per site into outDir, named from the manifest's own name field", async () => {
    const clientA = path.join(dir, "client-a");
    const clientB = path.join(dir, "client-b");
    mkdirSync(clientA, { recursive: true });
    mkdirSync(clientB, { recursive: true });
    writeFileSync(path.join(clientA, "LLMScout.json"), JSON.stringify({ siteUrl: "https://good.example/" }), "utf-8");
    writeFileSync(path.join(clientB, "LLMScout.json"), JSON.stringify({ siteUrl: "https://bad.example/" }), "utf-8");

    const manifestFile = writeManifest("fleet.json", {
      sites: [
        { name: "Client A", path: "./client-a" },
        { name: "Client B", path: "./client-b" },
      ],
    });

    const fetchStub = makeFetchStub({
      "https://good.example/": { body: GOOD_HTML },
      "https://good.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://good.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://good.example/llms.txt": { status: 404, ok: false },
      "https://bad.example/": { status: 500, ok: false },
      "https://bad.example/robots.txt": { status: 404, ok: false },
      "https://bad.example/sitemap.xml": { status: 404, ok: false },
      "https://bad.example/llms.txt": { status: 404, ok: false },
    });

    const outDir = path.join(dir, "reports");
    await runFleet(manifestFile, fetchStub, { outDir });

    const written = readdirSync(outDir).sort();
    expect(written).toEqual(["client-a.txt", "client-b.txt"]);
    expect(readFileSync(path.join(outDir, "client-a.txt"), "utf-8")).toContain("LLMScout check -- https://good.example/");
    expect(readFileSync(path.join(outDir, "client-b.txt"), "utf-8")).toContain("[FAIL]");
  });

  it("writes .json report files when json:true is passed", async () => {
    const clientA = path.join(dir, "client-a");
    mkdirSync(clientA, { recursive: true });
    writeFileSync(path.join(clientA, "LLMScout.json"), JSON.stringify({ siteUrl: "https://good.example/" }), "utf-8");
    const manifestFile = writeManifest("fleet.json", { sites: [{ name: "client-a", path: "./client-a" }] });
    const fetchStub = makeFetchStub({
      "https://good.example/": { body: GOOD_HTML },
      "https://good.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://good.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://good.example/llms.txt": { status: 404, ok: false },
    });

    const outDir = path.join(dir, "reports");
    await runFleet(manifestFile, fetchStub, { outDir, json: true });

    const filePath = path.join(outDir, "client-a.json");
    expect(existsSync(filePath)).toBe(true);
    expect(() => JSON.parse(readFileSync(filePath, "utf-8"))).not.toThrow();
  });

  it("does not write a report file for a site that errors before producing check results", async () => {
    const manifestFile = writeManifest("fleet.json", { sites: [{ name: "broken", path: "./missing" }] });
    const outDir = path.join(dir, "reports");

    const results = await runFleet(manifestFile, makeFetchStub({}), { outDir });
    expect(results[0]?.error).toBeDefined();
    expect(existsSync(outDir)).toBe(true); // still created up front
    expect(readdirSync(outDir)).toHaveLength(0);
  });

  it("does not write any report files when outDir is not passed", async () => {
    const clientA = path.join(dir, "client-a");
    mkdirSync(clientA, { recursive: true });
    writeFileSync(path.join(clientA, "LLMScout.json"), JSON.stringify({ siteUrl: "https://good.example/" }), "utf-8");
    const manifestFile = writeManifest("fleet.json", { sites: [{ name: "client-a", path: "./client-a" }] });
    const fetchStub = makeFetchStub({
      "https://good.example/": { body: GOOD_HTML },
      "https://good.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://good.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://good.example/llms.txt": { status: 404, ok: false },
    });

    await runFleet(manifestFile, fetchStub);
    expect(existsSync(path.join(dir, "reports"))).toBe(false);
  });
});
