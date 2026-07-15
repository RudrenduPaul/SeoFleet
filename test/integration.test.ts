import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCheckCommand, runFleetCommand, runInitCommand } from "../src/cli-lib.js";
import { GOOD_HTML, GOOD_ROBOTS_TXT, GOOD_SITEMAP_XML, makeFetchStub } from "./test-helpers.js";

let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(path.join(tmpdir(), "seofleet-integration-"));
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("init -> check end-to-end against a scratch directory", () => {
  it("scaffolds a project, then runs the full check suite against its configured site", async () => {
    const project = path.join(scratch, "my-project");

    const initResult = runInitCommand(project, { siteUrl: "https://good.example/", json: false });
    expect(initResult.exitCode).toBe(0);
    expect(existsSync(path.join(project, "seofleet.json"))).toBe(true);
    expect(existsSync(path.join(project, ".claude", "skills", "seofleet", "SKILL.md"))).toBe(true);

    const config = JSON.parse(readFileSync(path.join(project, "seofleet.json"), "utf-8"));
    expect(config.siteUrl).toBe("https://good.example/");

    const fetchStub = makeFetchStub({
      "https://good.example/": { body: GOOD_HTML },
      "https://good.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://good.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://good.example/llms.txt": { status: 404, ok: false },
    });

    const checkResult = await runCheckCommand(project, { json: true }, fetchStub);
    expect(checkResult.exitCode).toBe(0);
    const parsed = JSON.parse(checkResult.stdout ?? "");
    expect(parsed.results.length).toBeGreaterThanOrEqual(12);
    expect(parsed.summary.fail).toBe(0);
  });

  it("re-running init on the same directory is idempotent and check still works", async () => {
    const project = path.join(scratch, "my-project-2");
    runInitCommand(project, { siteUrl: "https://good.example/", json: false });
    const second = runInitCommand(project, { json: false });
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("already exists");

    const fetchStub = makeFetchStub({
      "https://good.example/": { body: GOOD_HTML },
      "https://good.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://good.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://good.example/llms.txt": { status: 404, ok: false },
    });
    const checkResult = await runCheckCommand(project, { json: false }, fetchStub);
    expect(checkResult.exitCode).toBe(0);
  });
});

describe("fleet against a multi-path scratch fixture", () => {
  it("runs check across several local client-repo paths and reports a consolidated table", async () => {
    const clients = ["alpha", "beta", "gamma"];
    for (const name of clients) {
      const clientDir = path.join(scratch, "clients", name);
      mkdirSync(clientDir, { recursive: true });
      const siteUrl = `https://${name}.example/`;
      writeFileSync(path.join(clientDir, "seofleet.json"), JSON.stringify({ siteUrl }), "utf-8");
    }

    const manifestFile = path.join(scratch, "fleet.json");
    writeFileSync(
      manifestFile,
      JSON.stringify({
        sites: clients.map((name) => ({ name, path: `./clients/${name}` })),
      }),
      "utf-8",
    );

    const fetchStub = makeFetchStub({
      "https://alpha.example/": { body: GOOD_HTML },
      "https://alpha.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://alpha.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://alpha.example/llms.txt": { status: 404, ok: false },
      "https://beta.example/": { body: GOOD_HTML },
      "https://beta.example/robots.txt": { body: GOOD_ROBOTS_TXT },
      "https://beta.example/sitemap.xml": { body: GOOD_SITEMAP_XML },
      "https://beta.example/llms.txt": { status: 404, ok: false },
      "https://gamma.example/": { status: 500, ok: false },
      "https://gamma.example/robots.txt": { status: 404, ok: false },
      "https://gamma.example/sitemap.xml": { status: 404, ok: false },
      "https://gamma.example/llms.txt": { status: 404, ok: false },
    });

    const fleetResult = await runFleetCommand(manifestFile, { json: true }, fetchStub);
    expect(fleetResult.exitCode).toBe(1); // gamma fails, so the fleet run is non-zero
    const parsed = JSON.parse(fleetResult.stdout ?? "");
    expect(parsed.summary.total).toBe(3);
    expect(parsed.summary.passed).toBe(2);
    expect(parsed.summary.failed).toBe(1);
    const gamma = parsed.sites.find((s: { name: string }) => s.name === "gamma");
    expect(gamma.ok).toBe(false);
  });
});
