import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initProject } from "../src/init.js";
import { configPath } from "../src/config.js";
import { LLMScoutError } from "../src/errors.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "llmscout-init-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("initProject", () => {
  it("creates llmscout.json and a Claude Code skill file", () => {
    const result = initProject(dir);
    expect(result.configCreated).toBe(true);
    expect(result.skillCreated).toBe(true);
    expect(existsSync(result.configFile)).toBe(true);
    expect(existsSync(result.skillFile)).toBe(true);
    const config = JSON.parse(readFileSync(result.configFile, "utf-8"));
    expect(config.siteUrl).toBe("");
  });

  it("creates the target directory if it doesn't exist yet", () => {
    const nested = path.join(dir, "nested", "project");
    const result = initProject(nested);
    expect(existsSync(nested)).toBe(true);
    expect(existsSync(result.configFile)).toBe(true);
  });

  it("writes the given siteUrl into the scaffolded config", () => {
    const result = initProject(dir, { siteUrl: "https://acme.example/" });
    const config = JSON.parse(readFileSync(result.configFile, "utf-8"));
    expect(config.siteUrl).toBe("https://acme.example/");
  });

  it("rejects an invalid siteUrl before writing anything", () => {
    expect(() => initProject(dir, { siteUrl: "not a url" })).toThrow(LLMScoutError);
    expect(existsSync(configPath(dir))).toBe(false);
  });

  it("is idempotent -- re-running does not overwrite an existing config", () => {
    initProject(dir, { siteUrl: "https://first.example/" });
    writeFileSync(configPath(dir), JSON.stringify({ siteUrl: "https://user-edited.example/" }), "utf-8");

    const second = initProject(dir, { siteUrl: "https://second.example/" });
    expect(second.configCreated).toBe(false);
    expect(second.skillCreated).toBe(false);

    const config = JSON.parse(readFileSync(configPath(dir), "utf-8"));
    expect(config.siteUrl).toBe("https://user-edited.example/");
  });
});
