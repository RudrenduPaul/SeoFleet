# seofleet-cli (Python)

Zero-config SEO and GEO (generative engine optimization) checker: 21 checks
against a live site, plus a multi-site fleet mode for agencies checking
several client sites at once, in pure Python with no extra runtime
toolchain -- no headless browser, no separate interpreter to provision.

[![PyPI version](https://img.shields.io/pypi/v/seofleet-cli.svg)](https://pypi.org/project/seofleet-cli/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/RudrenduPaul/SeoFleet/blob/main/LICENSE)
[![Python versions](https://img.shields.io/pypi/pyversions/seofleet-cli.svg)](https://pypi.org/project/seofleet-cli/)
[![CI](https://github.com/RudrenduPaul/SeoFleet/actions/workflows/ci.yml/badge.svg)](https://github.com/RudrenduPaul/SeoFleet/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/seofleet-cli.svg)](https://www.npmjs.com/package/seofleet-cli)

## Why this exists

SeoFleet checks a website for 21 technical-SEO and GEO issues --
title/meta description length, canonical tags, robots.txt/sitemap.xml
reachability (with a robots.txt `Sitemap:` fallback), heading structure,
image alt coverage and weight, Open Graph and Twitter Card tags, meta
robots directives, redirect-chain health, JSON-LD structured data, llms.txt,
AI-crawler directives (training and search crawlers tracked separately --
GPTBot/OAI-SearchBot, ClaudeBot/Claude-SearchBot, PerplexityBot,
Google-Extended, Applebot-Extended), FAQ schema, Speakable schema,
Organization schema, Markdown content negotiation, an RFC 8288 Link header,
and content-extraction friendliness -- and reports PASS/WARN/FAIL with a
fix suggestion for anything short of a clean pass. This package is the
Python distribution of the tool: a genuine, independent port of the npm
CLI's logic, not a wrapper around the Node binary. It ships with **zero
runtime dependencies** -- HTML parsing and HTTP fetching both use only the
Python standard library.

## Install

```bash
pip install seofleet-cli
```

or with [uv](https://docs.astral.sh/uv/):

```bash
uv add seofleet-cli
```

The complementary JS/TS distribution installs from npm:
`npm install -g seofleet-cli` -- see the
[project README](https://github.com/RudrenduPaul/SeoFleet#readme) for that
package. Both packages read the same 21-check spec and are intended to
report the same PASS/WARN/FAIL verdicts for the same site; neither is
deprecated in favor of the other.

## Quickstart

```bash
seofleet init ./my-site --site-url https://example.com
seofleet check ./my-site
```

`init` scaffolds a `seofleet.json` config (and a Claude Code skill file) in
the target directory; `check` runs all 21 checks against the configured
`siteUrl` and prints a PASS/WARN/FAIL line per check plus a summary. Pass
`--json` before the subcommand for structured output an agent can parse:

```bash
seofleet --json check ./my-site
```

Or call the library directly (the agent-native path, no subprocess):

```python
from seofleet import load_site, run_checks, ALL_CHECKS

ctx = load_site("https://example.com")
results = run_checks(ALL_CHECKS, ctx)
for r in results:
    print(f"[{r.status}] ({r.category}) {r.name}: {r.message}")
```

## How it works

```
seofleet.json -> site URL -> fetch homepage + robots.txt + sitemap.xml + llms.txt (parallel)
   -> 21 checks (12 technical + 9 GEO) run against the shared fetched context
   -> PASS / WARN / FAIL per check -> exit code (0 clean / 1 any FAIL / 2 usage error)
```

Full data model, the 21 checks explained, and fleet-mode semantics are in
[docs/concepts.md](https://github.com/RudrenduPaul/SeoFleet/blob/main/docs/concepts.md)
and [docs/getting-started.md](https://github.com/RudrenduPaul/SeoFleet/blob/main/docs/getting-started.md).
The checks are reimplemented as genuine Python logic against the same
check contract the npm package uses (`Check.run(ctx) -> CheckResult`) --
see those docs for what each check actually verifies.

## Fleet mode

```bash
seofleet fleet ./fleet.json
```

Runs the full 21-check suite against every site declared in a local JSON
manifest (`{"sites": [{"name": ..., "path": ...}]}`) in one invocation --
local filesystem only, no SSH, no remote execution. Aimed at agencies or
teams checking several client repos side by side. Add `--out-dir ./reports`
to also write one auto-named report file per site, named from the
manifest's `name` field.

## CI integration

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
- run: pip install seofleet-cli
- run: seofleet check ./my-site --json > results.json
```

Full walkthrough in
[docs/integrations/ci.md](https://github.com/RudrenduPaul/SeoFleet/blob/main/docs/integrations/ci.md).

## Security

seofleet's fetch layer only ever dials `http(s)`, follows redirects
manually one hop at a time, refuses to follow a redirect whose `Location`
targets a non-`http(s)` scheme, and bounds the redirect chain at 5 hops so
a redirect loop can't hang the process -- see
[SECURITY.md](https://github.com/RudrenduPaul/SeoFleet/blob/main/SECURITY.md)
for the full policy and how to report a vulnerability. **Honest note**:
this project does not currently publish SLSA provenance, Sigstore
signatures, or an SBOM, and has no OpenSSF Scorecard badge set up -- none
of that infrastructure exists yet for either distribution, so it isn't
claimed here.

## Contributing

See [CONTRIBUTING.md](https://github.com/RudrenduPaul/SeoFleet/blob/main/CONTRIBUTING.md).

```bash
cd python
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

## License

MIT, see [LICENSE](https://github.com/RudrenduPaul/SeoFleet/blob/main/LICENSE).
