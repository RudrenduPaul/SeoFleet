import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI = path.resolve(__dirname, "..", "dist", "cli.js");

function runCli(args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], { encoding: "utf-8" });
    return { stdout, stderr: "", status: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", status: e.status ?? 2 };
  }
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "seofleet-cli-e2e-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("CLI", () => {
  it("prints help listing all three subcommands", () => {
    const { stdout, status } = runCli(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/init/);
    expect(stdout).toMatch(/check/);
    expect(stdout).toMatch(/fleet/);
  });

  it("lists --user-agent as a global option in help", () => {
    const { stdout, status } = runCli(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/--user-agent <string>/);
  });

  it("prints the version", () => {
    const { stdout, status } = runCli(["--version"]);
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("0.1.0");
  });

  it("scaffolds a real project directory via `init`", () => {
    const { stdout, status } = runCli(["init", dir]);
    expect(status).toBe(0);
    expect(stdout).toContain("Created");
  });

  it("supports --json on init", () => {
    const { stdout, status } = runCli(["--json", "init", dir]);
    expect(status).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  it("exits 2 on `check` against a directory with no seofleet.json", () => {
    const { status, stderr } = runCli(["check", dir]);
    expect(status).toBe(2);
    expect(stderr).toMatch(/Run `seofleet init/);
  });

  it("exits 2 on `check` against a nonexistent path", () => {
    const { status } = runCli(["check", path.join(dir, "nope")]);
    expect(status).toBe(2);
  });

  it("exits 2 on `fleet` with a missing manifest", () => {
    const { status } = runCli(["fleet", path.join(dir, "fleet.json")]);
    expect(status).toBe(2);
  });
});
