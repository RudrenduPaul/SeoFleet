# LLMScout-cli (Python)

Zero-config SEO and GEO (generative engine optimization) checker: 12 checks
against a live site, plus a multi-site fleet mode for agencies checking
several client sites at once, in pure Python with no extra runtime
toolchain -- no headless browser, no separate interpreter to provision.

[![PyPI version](https://img.shields.io/pypi/v/LLMScout-cli.svg)](https://pypi.org/project/LLMScout-cli/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/RudrenduPaul/LLMScout/blob/main/LICENSE)
[![Python versions](https://img.shields.io/pypi/pyversions/LLMScout-cli.svg)](https://pypi.org/project/LLMScout-cli/)
[![CI](https://github.com/RudrenduPaul/LLMScout/actions/workflows/ci.yml/badge.svg)](https://github.com/RudrenduPaul/LLMScout/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/LLMScout-cli.svg)](https://www.npmjs.com/package/LLMScout-cli)

## Why this exists

LLMScout checks a website for 12 common technical-SEO and GEO issues --
title/meta description length, canonical tags, robots.txt/sitemap.xml
reachability, heading structure, image alt coverage, JSON-LD structured
data, llms.txt, AI-crawler directives, FAQ schema, and content-extraction
friendliness -- and reports PASS/WARN/FAIL with a fix suggestion for
anything short of a clean pass. This package is the Python
distribution of the tool: a genuine, independent port of the npm CLI's
logic, not a wrapper around the Node binary. It ships with **zero runtime
dependencies** -- HTML parsing and HTTP fetching both use only the Python
standard library.

## Install

```bash
pip install LLMScout-cli
```

or with [uv](https://docs.astral.sh/uv/):

```bash
uv add LLMScout-cli
```

The complementary JS/TS distribution installs from npm:
`npm install --save-dev LLMScout-cli` -- see the
[project README](https://github.com/RudrenduPaul/LLMScout#readme) for that
package. **Note**: as of this writing the npm package has a completed
`npm login` but is pending only a transient npm-registry rate limit
(HTTP 429), not a code-readiness issue; install from source in the
meantime per the project README's Install section. Both packages read the
same 12-check spec and are intended to report the same PASS/WARN/FAIL
verdicts for the same site; neither is deprecated in favor of the other.

## Quickstart

```bash
LLMScout init ./my-site --site-url https://example.com
LLMScout check ./my-site
```

`init` scaffolds a `LLMScout.json` config (and a Claude Code skill file) in
the target directory; `check` runs all 12 checks against the configured
`siteUrl` and prints a PASS/WARN/FAIL line per check plus a summary. Pass
`--json` before the subcommand for structured output an agent can parse:

```bash
LLMScout --json check ./my-site
```

Or call the library directly (the agent-native path, no subprocess):

```python
from LLMScout import load_site, run_checks, ALL_CHECKS

ctx = load_site("https://example.com")
results = run_checks(ALL_CHECKS, ctx)
for r in results:
    print(f"[{r.status}] ({r.category}) {r.name}: {r.message}")
```

## How it works

```
LLMScout.json -> site URL -> fetch homepage + robots.txt + sitemap.xml + llms.txt (parallel)
   -> 12 checks (7 technical + 5 GEO) run against the shared fetched context
   -> PASS / WARN / FAIL per check -> exit code (0 clean / 1 any FAIL / 2 usage error)
```

Full data model, the 12 checks explained, and fleet-mode semantics are in
[docs/concepts.md](https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md)
and [docs/getting-started.md](https://github.com/RudrenduPaul/LLMScout/blob/main/docs/getting-started.md).
The checks are reimplemented as genuine Python logic against the same
check contract the npm package uses (`Check.run(ctx) -> CheckResult`) --
see those docs for what each check actually verifies.

## Fleet mode

```bash
LLMScout fleet ./fleet.json
```

Runs the full 12-check suite against every site declared in a local JSON
manifest (`{"sites": [{"name": ..., "path": ...}]}`) in one invocation --
local filesystem only, no SSH, no remote execution. Aimed at agencies or
teams checking several client repos side by side.

## CI integration

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
- run: pip install LLMScout-cli
- run: LLMScout check ./my-site --json > results.json
```

Full walkthrough in
[docs/integrations/ci.md](https://github.com/RudrenduPaul/LLMScout/blob/main/docs/integrations/ci.md).

## Security

LLMScout's fetch layer only ever dials `http(s)`, follows redirects
manually one hop at a time, refuses to follow a redirect whose `Location`
targets a non-`http(s)` scheme, and bounds the redirect chain at 5 hops so
a redirect loop can't hang the process -- see
[SECURITY.md](https://github.com/RudrenduPaul/LLMScout/blob/main/SECURITY.md)
for the full policy and how to report a vulnerability. **Honest note**:
this project does not currently publish SLSA provenance, Sigstore
signatures, or an SBOM, and has no OpenSSF Scorecard badge set up -- none
of that infrastructure exists yet for either distribution, so it isn't
claimed here.

## Contributing

See [CONTRIBUTING.md](https://github.com/RudrenduPaul/LLMScout/blob/main/CONTRIBUTING.md).

```bash
cd python
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

## License

MIT, see [LICENSE](https://github.com/RudrenduPaul/LLMScout/blob/main/LICENSE).
