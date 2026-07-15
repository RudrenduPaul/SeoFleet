import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_FILENAME, configPath, defaultConfig, loadConfig, selectChecks } from "../src/config.js";
import { SeoFleetError } from "../src/errors.js";
import { ALL_CHECKS, GEO_CHECKS, TECHNICAL_CHECKS } from "../src/checks/index.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "seofleet-config-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("configPath / defaultConfig", () => {
  it("joins the project path with the config filename", () => {
    expect(configPath("/a/b")).toBe(path.join("/a/b", CONFIG_FILENAME));
  });

  it("defaults to both check categories enabled", () => {
    expect(defaultConfig("https://example.com").checks).toEqual({ technical: true, geo: true });
  });
});

describe("loadConfig", () => {
  it("throws a usage error when the config file is missing", () => {
    expect(() => loadConfig(dir)).toThrow(SeoFleetError);
    expect(() => loadConfig(dir)).toThrow(/Run `seofleet init/);
  });

  it("throws a usage error on malformed JSON", () => {
    writeFileSync(configPath(dir), "{not json", "utf-8");
    expect(() => loadConfig(dir)).toThrow(/not valid JSON/);
  });

  it("throws a usage error when the file is not a JSON object", () => {
    writeFileSync(configPath(dir), "[1,2,3]", "utf-8");
    expect(() => loadConfig(dir)).toThrow(/must contain a JSON object/);
  });

  it("throws a usage error when siteUrl is missing or blank", () => {
    writeFileSync(configPath(dir), JSON.stringify({ siteUrl: "" }), "utf-8");
    expect(() => loadConfig(dir)).toThrow(/no siteUrl configured/);
  });

  it("loads a valid config with explicit checks flags", () => {
    writeFileSync(
      configPath(dir),
      JSON.stringify({ siteUrl: "https://acme.example/", checks: { technical: true, geo: false } }),
      "utf-8",
    );
    const config = loadConfig(dir);
    expect(config.siteUrl).toBe("https://acme.example/");
    expect(config.checks).toEqual({ technical: true, geo: false });
  });

  it("defaults checks to both enabled when the checks field is absent", () => {
    writeFileSync(configPath(dir), JSON.stringify({ siteUrl: "https://acme.example/" }), "utf-8");
    const config = loadConfig(dir);
    expect(config.checks).toEqual({ technical: true, geo: true });
  });
});

describe("selectChecks", () => {
  it("returns all checks when both categories are enabled", () => {
    expect(selectChecks(defaultConfig("https://a.com"))).toBe(ALL_CHECKS);
  });

  it("returns only technical checks when geo is disabled", () => {
    const result = selectChecks({ siteUrl: "https://a.com", checks: { technical: true, geo: false } });
    expect(result).toBe(TECHNICAL_CHECKS);
  });

  it("returns only geo checks when technical is disabled", () => {
    const result = selectChecks({ siteUrl: "https://a.com", checks: { technical: false, geo: true } });
    expect(result).toBe(GEO_CHECKS);
  });

  it("returns no checks when both categories are disabled", () => {
    const result = selectChecks({ siteUrl: "https://a.com", checks: { technical: false, geo: false } });
    expect(result).toEqual([]);
  });
});
