import { describe, expect, it } from "vitest";
import { aiCrawlerDirectivesCheck, parseAiCrawlerDirectives } from "../../../src/checks/geo/ai-crawler-directives.js";
import { makeCheckContext } from "../../test-helpers.js";

describe("parseAiCrawlerDirectives", () => {
  it("reports unspecified for every bot when robots.txt says nothing about them", () => {
    const result = parseAiCrawlerDirectives("User-agent: *\nDisallow:\n");
    expect(result["GPTBot"]).toBe("unspecified");
  });

  it("reports disallow and allow per bot", () => {
    const robots = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nAllow: /\n";
    const result = parseAiCrawlerDirectives(robots);
    expect(result["GPTBot"]).toBe("disallow");
    expect(result["ClaudeBot"]).toBe("allow");
  });

  it("treats an empty Disallow as unspecified rather than asserting allow", () => {
    const robots = "User-agent: PerplexityBot\nDisallow:\n";
    const result = parseAiCrawlerDirectives(robots);
    expect(result["PerplexityBot"]).toBe("unspecified");
  });

  it("ignores comments and blank lines", () => {
    const robots = "# comment\nUser-agent: Google-Extended\n\nDisallow: /private\n";
    const result = parseAiCrawlerDirectives(robots);
    expect(result["Google-Extended"]).toBe("disallow");
  });

  it("tracks the search-specific crawlers (OAI-SearchBot, Claude-SearchBot) separately from their training-only counterparts", () => {
    const robots =
      "User-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: Claude-SearchBot\nAllow: /\n";
    const result = parseAiCrawlerDirectives(robots);
    expect(result["GPTBot"]).toBe("disallow");
    expect(result["OAI-SearchBot"]).toBe("allow");
    expect(result["ClaudeBot"]).toBe("disallow");
    expect(result["Claude-SearchBot"]).toBe("allow");
  });

  it("tracks Applebot-Extended", () => {
    const robots = "User-agent: Applebot-Extended\nDisallow: /\n";
    const result = parseAiCrawlerDirectives(robots);
    expect(result["Applebot-Extended"]).toBe("disallow");
  });
});

describe("aiCrawlerDirectivesCheck", () => {
  it("WARNs when robots.txt is unreachable", async () => {
    const result = await aiCrawlerDirectivesCheck.run(
      makeCheckContext(null, { robotsTxt: { url: "https://acme.example/robots.txt", ok: false, status: 404 } }),
    );
    expect(result.status).toBe("WARN");
  });

  it("PASSes and reports findings (never prescribes a policy) when robots.txt is reachable", async () => {
    const result = await aiCrawlerDirectivesCheck.run(
      makeCheckContext(null, {
        robotsTxt: {
          url: "https://acme.example/robots.txt",
          ok: true,
          status: 200,
          body: "User-agent: GPTBot\nDisallow: /\n",
        },
      }),
    );
    expect(result.status).toBe("PASS");
    expect(result.message).toContain("GPTBot: disallow");
  });
});
