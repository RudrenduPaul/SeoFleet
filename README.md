# LLMScout

LLMScout runs 12 technical-SEO and GEO (generative-engine-optimization) checks against your site from a single Node CLI, with zero Python and zero headless-browser dependency, so a fresh install behaves the same on macOS, Linux, and Windows.

[![CI](https://github.com/RudrenduPaul/LLMScout/actions/workflows/ci.yml/badge.svg)](https://github.com/RudrenduPaul/LLMScout/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

<!-- TODO: record demo -->

## Contents

- [Install](#install)
- [Features](#features)
- [Quickstart](#quickstart)
- [The 12 checks](#the-12-checks)
- [CLI reference](#cli-reference)
- [Fleet mode](#fleet-mode)
- [Comparison](#comparison)
- [What is LLMScout, and why does it exist](#what-is-LLMScout-and-why-does-it-exist)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

## Install

LLMScout is a TypeScript/Node CLI. It targets Node 18 or newer (declared in `package.json` `engines`).

The npm package is not published yet, so the current install path is from source:

```bash
git clone https://github.com/RudrenduPaul/LLMScout.git
cd LLMScout
npm install
npm run build
npm link          # puts a `LLMScout` binary on your PATH
```

Then, in any project you want to check:

```bash
LLMScout init .
```

That scaffolds a `LLMScout.json` config and a small Claude Code skill file into the target directory. Set your site URL and run `LLMScout check .`. The two runtime dependencies are `cheerio` (HTML parsing) and `commander` (argument parsing) — there is no Python interpreter, no `pip install`, and no Playwright/Chromium download anywhere in the install.

## Features

- **12 checks across two categories.** 7 technical-SEO checks and 5 GEO checks, listed by name in [The 12 checks](#the-12-checks).
- **Zero external toolchain.** Pure TypeScript/Node. `child_process` is never imported anywhere in the source — the checks run inside the Node process, not by shelling out to Python scripts or a headless browser. This is the entire reason the tool exists (see [below](#what-is-LLMScout-and-why-does-it-exist)).
- **Cross-platform by construction.** Because there is no `python3`-versus-`py -3` shelling and no relative-path script resolution, the same install runs identically on Windows, macOS, and Linux.
- **Hardened fetch.** The single fetch wrapper (`src/fetch-utils.ts`) rejects any non-`http(s)` scheme on the initial URL, follows redirects manually one hop at a time, refuses to follow a redirect whose `Location` points at a non-`http(s)` scheme (for example `file://` or `ftp://`), and bounds the chain at 5 hops so a redirect loop cannot hang the process.
- **Fleet mode.** `LLMScout fleet manifest.json` runs the full suite across many local client-repo paths declared in one JSON manifest, in a single invocation. It reads the local filesystem only — no SSH, no remote execution.
- **Structured output.** Every command accepts a global `--json` flag for machine-readable output, so an agent invoking the CLI can parse results programmatically.
- **Well tested.** 129 tests, ~98.6% line coverage, and `npm audit` reports 0 vulnerabilities (all reproducible locally with `npm run test:coverage` and `npm audit`).

## Quickstart

Scaffold a config and run a check against a live site:

```bash
LLMScout init ./my-site --site-url https://example.com
LLMScout check ./my-site
```

Real output from `LLMScout check` against `https://example.com`:

```
LLMScout check -- https://example.com

[PASS] (technical) Title tag
  Title "Example Domain" is 14 characters, within the recommended 10-60 range.

[WARN] (technical) Meta description
  No meta description found.
  Fix: Add <meta name="description" content="..."> with 50-160 characters summarizing the page.

[WARN] (technical) Canonical tag
  No <link rel="canonical"> tag found.
  Fix: Add a canonical link tag pointing at the preferred URL for this page.

[FAIL] (technical) robots.txt
  robots.txt was not reachable at https://example.com/robots.txt (HTTP 404).
  Fix: Add a robots.txt file at your site root, even a permissive one, so crawlers and agents have explicit directives.

[WARN] (technical) sitemap.xml
  sitemap.xml was not reachable at https://example.com/sitemap.xml (HTTP 404).
  Fix: Add a sitemap.xml at your site root to help search engines discover pages.

[PASS] (technical) Heading structure
  Exactly one <h1> and no skipped heading levels detected.

[PASS] (technical) Image alt coverage
  No <img> tags found on the page.

[WARN] (geo) Structured data (JSON-LD)
  No JSON-LD structured data found.
  Fix: Add schema.org JSON-LD markup (e.g. Organization, WebSite, or Article) so generative engines can understand the page's entities.

[WARN] (geo) llms.txt
  No llms.txt found at https://example.com/llms.txt.
  Fix: Optional: add an llms.txt at your site root summarizing the site for LLM-based agents (see llmstxt.org).

[WARN] (geo) AI crawler directives
  robots.txt is unreachable, so AI-crawler directives could not be determined.
  Fix: Add a reachable robots.txt if you want to state an explicit policy for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended).

[WARN] (geo) FAQ schema
  No FAQPage structured data found.
  Fix: If this page has an FAQ section, mark it up with FAQPage JSON-LD so generative engines can surface individual answers.

[PASS] (geo) Content extraction friendliness
  Found 1 heading(s) and 1 structured text block(s); content appears reasonably extractable. (Heuristic: cannot assess semantic quality or JS-rendered content.)

Summary: 4 PASS, 7 WARN, 1 FAIL (12 checks)
```

The same run with `--json`:

```bash
LLMScout --json check ./my-site
```

```json
{
  "siteUrl": "https://example.com",
  "summary": {
    "pass": 4,
    "warn": 7,
    "fail": 1,
    "total": 12
  },
  "results": [
    {
      "id": "title",
      "name": "Title tag",
      "category": "technical",
      "status": "PASS",
      "message": "Title \"Example Domain\" is 14 characters, within the recommended 10-60 range."
    }
  ]
}
```

`check` exits `0` when no check FAILs, `1` when at least one check FAILs (WARN alone does not fail the run), and `2` on a usage error such as a missing or misconfigured `LLMScout.json`.

## The 12 checks

Each check reports `PASS`, `WARN`, or `FAIL`, with a fix suggestion for anything that is not a clean PASS. A `WARN` is a missed optimization, not a broken page, and never fails the run on its own.

### Technical SEO (7)

| Check (`id`) | What it verifies |
| --- | --- |
| Title tag (`title`) | A `<title>` exists and is within 10–60 characters. |
| Meta description (`meta-description`) | A `<meta name="description">` exists and is within 50–160 characters. |
| Canonical tag (`canonical`) | A `<link rel="canonical">` exists and its href is a valid URL (relative hrefs are resolved, not penalized). |
| robots.txt (`robots-txt`) | `/robots.txt` is reachable and contains at least one `User-agent` directive. |
| sitemap.xml (`sitemap-xml`) | `/sitemap.xml` is reachable and looks like valid sitemap XML (`<urlset>` or `<sitemapindex>`). |
| Heading structure (`heading-structure`) | Exactly one `<h1>`, and no skipped heading levels (for example an `<h1>` followed directly by an `<h3>`). |
| Image alt coverage (`image-alt`) | `<img>` tags have an `alt` attribute (an intentional `alt=""` for decorative images counts as covered). |

### GEO / generative engine optimization (5)

| Check (`id`) | What it verifies |
| --- | --- |
| Structured data (`structured-data`) | JSON-LD `<script type="application/ld+json">` blocks exist and parse as valid JSON. |
| llms.txt (`llms-txt`) | An `/llms.txt` is present at the site root (an emerging convention; absence is informational). |
| AI crawler directives (`ai-crawler-directives`) | Reports the robots.txt allow/disallow state for GPTBot, ClaudeBot, PerplexityBot, and Google-Extended. This is a report of what is configured, never a recommendation to allow or block. |
| FAQ schema (`faq-schema`) | `FAQPage` JSON-LD is present (informational; only relevant to pages that actually have an FAQ). |
| Content extraction friendliness (`content-extraction`) | Heuristic: the page has heading/paragraph structure an engine can chunk, rather than one large unstructured block. It cannot see content that only appears after client-side JavaScript, by design. |

You can run only one category by editing the `checks` block in `LLMScout.json` (`{ "checks": { "technical": true, "geo": false } }`).

## CLI reference

Transcribed from the tool's own `--help` output.

```
$ LLMScout --help
Usage: LLMScout [options] [command]

Zero-config, cross-platform SEO and GEO checks for local projects, with no
Python or headless-browser dependency.

Options:
  -V, --version          output the version number
  --json                 output structured JSON instead of human-readable text
                         (default: false)
  -h, --help             display help for command

Commands:
  init [options] <path>  Scaffold a LLMScout setup (LLMScout.json + a Claude
                         Code skill file) into a target directory
  check <path>           Run SEO/GEO checks against a local project's
                         configured site
  fleet <config.json>    Run the full check suite against every site listed in
                         a fleet manifest
  help [command]         display help for command
```

| Command | Argument | Options | Purpose |
| --- | --- | --- | --- |
| `init` | `<path>` target directory | `--site-url <url>` set `siteUrl` immediately | Scaffold `LLMScout.json` plus a Claude Code skill file. Idempotent: existing files are left untouched. |
| `check` | `<path>` project directory containing `LLMScout.json` | (global `--json`) | Run the selected checks against the configured `siteUrl`. |
| `fleet` | `<config.json>` fleet manifest | (global `--json`) | Run the full suite against every site in the manifest. |

`--json`, `-V`/`--version`, and `-h`/`--help` are the only global options.

```
$ LLMScout init --help
Usage: LLMScout init [options] <path>

Scaffold a LLMScout setup (LLMScout.json + a Claude Code skill file) into a
target directory

Arguments:
  path              target project directory

Options:
  --site-url <url>  set siteUrl in the scaffolded config immediately
  -h, --help        display help for command
```

```
$ LLMScout check --help
Usage: LLMScout check [options] <path>

Run SEO/GEO checks against a local project's configured site

Arguments:
  path        local project directory containing LLMScout.json

Options:
  -h, --help  display help for command
```

```
$ LLMScout fleet --help
Usage: LLMScout fleet [options] <config.json>

Run the full check suite against every site listed in a fleet manifest

Arguments:
  config.json  fleet manifest file: { "sites": [{ "name", "path" }] }

Options:
  -h, --help   display help for command
```

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | `init` succeeded, or `check`/`fleet` completed with no FAIL. |
| `1` | `check`: at least one check FAILed. `fleet`: at least one site FAILed or errored. |
| `2` | Usage error: invalid URL scheme, missing/unreadable/invalid `LLMScout.json`, blank `siteUrl`, missing manifest, or any other configuration error. |

## Fleet mode

`fleet` is aimed at agencies or teams that maintain several client sites side by side as local repos. You declare each site in one manifest and check them all in a single command:

```json
{
  "sites": [
    { "name": "client-a", "path": "./clients/client-a" },
    { "name": "client-b", "path": "./clients/client-b" }
  ]
}
```

```bash
LLMScout fleet ./fleet.json
```

```
LLMScout fleet report

[FAIL] client-a (/abs/path/clients/client-a) -- 4 PASS, 7 WARN, 1 FAIL
[PASS] client-b (/abs/path/clients/client-b) -- 10 PASS, 2 WARN, 0 FAIL

Fleet summary: 1 site(s) passed, 1 site(s) failed, 0 site(s) errored (2 total).
```

Each entry's `path` points at a directory that has its own `LLMScout.json`. Relative paths resolve against the manifest file's own directory (not the process working directory), so the same manifest works no matter where you invoke it from. Everything is local filesystem access — there is no SSH and no remote-execution surface.

## Comparison

Every cell below is drawn from a verifiable source (a repo file, a package manifest, or an open issue), cited under the table. "Checker" means the tool audits an existing live site; "generator" means it emits SEO/GEO asset files for you to publish.

| | LLMScout | claude-seo (AgriciDaniel) | geo-optimizer-skill (Auriti-Labs) | @glincker/geo-seo |
| --- | --- | --- | --- | --- |
| Requires Python | No | Yes (Python 3.10+) | Yes (Python 3.9+) | No |
| Requires Playwright / headless browser | No | Optional (Chromium auto-installed by `install.sh` for SPA rendering) | Not required for core function | No |
| Install | npm / from source (deps: `cheerio`, `commander`) | `git clone` + `install.sh` / `install.ps1`, or Claude Code `/plugin` | `pip install` or `uvx` | `npm install -g` / `npx` (dep: `chalk`) |
| Cross-platform / Windows out of the box | Yes (no shelling, no path resolution) | Ships a Windows `install.ps1`, but fresh-install/Windows/path failures are open: issues #137, #138, #139 | pip/uv are cross-platform; not verified further | Yes (npm-only) |
| Role | Checker | Checker | Checker | Generator |
| Coverage | Technical + GEO | Technical + GEO (broad) | Technical + GEO | GEO + technical asset generation |
| License | MIT | MIT | MIT | MIT |

Sources: LLMScout — this repo's `package.json`, `src/fetch-utils.ts`, and the absence of `child_process` in `src/`. claude-seo — its README install section (Python 3.10+, `install.sh`/`install.ps1`, `/plugin`), its MIT license, and open issues [#137](https://github.com/AgriciDaniel/claude-seo/issues/137) (plugin install does not provision Python deps or Playwright), [#138](https://github.com/AgriciDaniel/claude-seo/issues/138) (skill instructions hardcode `python3`, fail on Windows), and [#139](https://github.com/AgriciDaniel/claude-seo/issues/139) (skills invoke `scripts/*.py` via a relative path that does not resolve in plugin installs), all open as of this writing. geo-optimizer-skill — its README (Python 3.9+, `pip install geo-optimizer-skill` / `uvx`, MIT, CLI with audit/fix commands). @glincker/geo-seo — its npm registry manifest (v0.4.0, `bin: geo-seo`, single `chalk` dependency, MIT, description "Framework-agnostic GEO asset generator — llms.txt, JSON-LD, robots.txt, and sitemap").

Hosted analytics products such as Profound, Peec, and Evertune are a different category (paid, hosted GEO-tracking dashboards, not installable OSS checkers) and are intentionally not in this table.

## What is LLMScout, and why does it exist

LLMScout is an independent, open-source command-line tool that checks a website for 12 common technical-SEO and generative-engine-optimization issues. It is written entirely in TypeScript and runs on Node.js. It has two runtime dependencies, `cheerio` and `commander`, and it never invokes an external interpreter or browser: `child_process` does not appear anywhere in its source.

It exists to replace the install flow of an existing project, [`AgriciDaniel/claude-seo`](https://github.com/AgriciDaniel/claude-seo), for one specific class of problem. That project is a Claude Code SEO/GEO skill that carries out its checks by shelling out to Python scripts (Playwright-based rendering, `pip`-installed dependencies) from skill instructions. That external-toolchain-plus-path-resolution chain is the root cause behind three still-open bugs filed against it — [#137](https://github.com/AgriciDaniel/claude-seo/issues/137) (a fresh `/plugin` install provisions neither the Python dependencies nor Playwright Chromium, so it is non-functional until manual setup), [#138](https://github.com/AgriciDaniel/claude-seo/issues/138) (skill instructions hardcode `python3`, which does not exist on a stock Windows install where the launcher is `py -3` or `python`), and [#139](https://github.com/AgriciDaniel/claude-seo/issues/139) (skills call `scripts/*.py` through a relative path that does not resolve when the scripts live under the plugin root).

LLMScout is not a fork of claude-seo. It shares no code, has a different name, and reimplements the equivalent checks from scratch in pure TypeScript. The design choice that matters is what it does not do: because the checks run inside the Node process rather than by launching Python and a headless browser, the entire failure class behind those three bugs does not exist here. There is no interpreter to provision, no `pip install` to run, no browser binary to download, and no relative script path to resolve, so a fresh install behaves the same on every platform. The direct cost of that choice is that the content-extraction check is a static-HTML heuristic and cannot evaluate content that only appears after client-side JavaScript renders — the check documents this limitation in its own output.

LLMScout is at v0.1 and is not yet published to npm.

## FAQ

**Does LLMScout require Python?**
No. It is pure TypeScript/Node with two npm dependencies (`cheerio`, `commander`). There is no `pip install` step and no Python interpreter involved at any point.

**Does it use Playwright or a headless browser?**
No. It fetches HTML over `http(s)` and parses it with `cheerio`. There is no Chromium download and no `child_process` usage anywhere in the source. The trade-off is that the content-extraction check reads static HTML only and cannot see JavaScript-rendered content — it says so in its own result message.

**What does "zero-config" mean here, concretely?**
`LLMScout init <path>` writes a working `LLMScout.json` and a Claude Code skill file with no prompts. The one value you must supply is your live site URL (via `--site-url` or by editing the file), because the tool cannot infer a project's public URL from its local files. After that, `LLMScout check <path>` runs with no further configuration; all 12 checks run by default.

**Why not just fix claude-seo directly instead of building a separate tool?**
The three open issues share a single root cause: checks are performed by shelling out to an external Python-plus-Playwright toolchain from skill instructions. Patching each symptom (provision the deps, detect the Windows launcher, resolve the script path) leaves that architecture in place. LLMScout removes the architecture instead — with no external toolchain, that class of install and path failure cannot recur. It is an independent reimplementation, not a patch.

**Can I run it against many sites at once?**
Yes. `LLMScout fleet manifest.json` runs the full suite against every site listed in a local JSON manifest in one invocation. It reads the local filesystem only, with no SSH or remote-execution surface.

**Can an agent or script consume the output?**
Yes. Pass the global `--json` flag to any command for structured JSON, including per-check `id`, `status`, `message`, and `fix` fields, plus a summary object. Exit codes are stable: `0` clean, `1` at least one FAIL, `2` a usage/config error.

**Is it on npm?**
Not yet. Install from source for now (see [Install](#install)).

## Contributing

There is no `CONTRIBUTING.md` in this repo yet. In the meantime, the useful commands are:

```bash
npm install
npm run build       # tsc build to dist/
npm run typecheck   # tsc --noEmit
npm test            # vitest run (129 tests)
npm run test:coverage
npm run lint        # eslint src test
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, build, coverage, and `npm audit --audit-level=high` on every push and pull request to `main`. Issues and pull requests are welcome at <https://github.com/RudrenduPaul/LLMScout/issues>.

Adding a 13th check is intentionally small: implement the `Check` interface (`src/types.ts`) in a new file under `src/checks/`, then register it in `src/checks/index.ts`. Nothing else needs to change.

## License

MIT. See [LICENSE](./LICENSE).
