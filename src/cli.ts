#!/usr/bin/env node
import { Command } from "commander";
import { runInitCommand, runCheckCommand, runFleetCommand } from "./cli-lib.js";

const program = new Command();

program
  .name("LLMScout")
  .description(
    "Zero-config, cross-platform SEO and GEO checks for local projects, with no Python or headless-browser dependency.",
  )
  .version("0.1.0")
  .option("--json", "output structured JSON instead of human-readable text", false)
  .option("--user-agent <string>", "override the default User-Agent header sent on outbound fetches");

program
  .command("init")
  .description("Scaffold a LLMScout setup (LLMScout.json + a Claude Code skill file) into a target directory")
  .argument("<path>", "target project directory")
  .option("--site-url <url>", "set siteUrl in the scaffolded config immediately")
  .action((targetPath: string, opts: { siteUrl?: string }, command: Command) => {
    const globalOpts = command.optsWithGlobals<{ json: boolean }>();
    const result = runInitCommand(targetPath, {
      ...(opts.siteUrl !== undefined ? { siteUrl: opts.siteUrl } : {}),
      json: globalOpts.json,
    });
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(result.exitCode);
  });

program
  .command("check")
  .description("Run SEO/GEO checks against a local project's configured site")
  .argument("<path>", "local project directory containing LLMScout.json")
  .option("--out-dir <dir>", "also write an auto-named report file for this site into this directory")
  .action(async (targetPath: string, opts: { outDir?: string }, command: Command) => {
    const globalOpts = command.optsWithGlobals<{ json: boolean; userAgent?: string }>();
    const result = await runCheckCommand(targetPath, {
      json: globalOpts.json,
      ...(globalOpts.userAgent !== undefined ? { userAgent: globalOpts.userAgent } : {}),
      ...(opts.outDir !== undefined ? { outDir: opts.outDir } : {}),
    });
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(result.exitCode);
  });

program
  .command("fleet")
  .description("Run the full check suite against every site listed in a fleet manifest")
  .argument("<config.json>", "fleet manifest file: { \"sites\": [{ \"name\", \"path\" }] }")
  .option("--out-dir <dir>", "also write one auto-named report file per site (named from the manifest's \"name\" field) into this directory")
  .action(async (manifestPath: string, opts: { outDir?: string }, command: Command) => {
    const globalOpts = command.optsWithGlobals<{ json: boolean; userAgent?: string }>();
    const result = await runFleetCommand(manifestPath, {
      json: globalOpts.json,
      ...(globalOpts.userAgent !== undefined ? { userAgent: globalOpts.userAgent } : {}),
      ...(opts.outDir !== undefined ? { outDir: opts.outDir } : {}),
    });
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(result.exitCode);
  });

program.parseAsync(process.argv);
