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
  .option("--json", "output structured JSON instead of human-readable text", false);

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
  .action(async (targetPath: string, _opts: unknown, command: Command) => {
    const globalOpts = command.optsWithGlobals<{ json: boolean }>();
    const result = await runCheckCommand(targetPath, { json: globalOpts.json });
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(result.exitCode);
  });

program
  .command("fleet")
  .description("Run the full check suite against every site listed in a fleet manifest")
  .argument("<config.json>", "fleet manifest file: { \"sites\": [{ \"name\", \"path\" }] }")
  .action(async (manifestPath: string, _opts: unknown, command: Command) => {
    const globalOpts = command.optsWithGlobals<{ json: boolean }>();
    const result = await runFleetCommand(manifestPath, { json: globalOpts.json });
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(result.exitCode);
  });

program.parseAsync(process.argv);
