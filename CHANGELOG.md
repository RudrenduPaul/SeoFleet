# Changelog

All notable changes to LLMScout are documented in this file. This
changelog covers both distributions -- the npm package (`LLMScout-cli`,
TypeScript) and the PyPI package (`LLMScout-cli`, Python) -- since they
run the same 12 checks; entries note which distribution they apply to.

## [Python 0.1.0] - 2026-07-16

Initial public release of the Python port, published to PyPI as
`LLMScout-cli` (`pip install LLMScout-cli`). Complementary to, not a
replacement for, the existing npm package -- both are first-class and
maintained together. See `python/README.md` for Python-specific usage.

### Added

- `LLMScout [init|check|fleet]` CLI (console script `LLMScout`, package
  `LLMScout`) with the same commands and `--json` global flag as the npm
  CLI's own `--help` output.
- Programmatic library API: `from LLMScout import load_site, run_checks,
  ALL_CHECKS, TECHNICAL_CHECKS, GEO_CHECKS`, returning the same
  `CheckResult` shape (`id`, `name`, `category`, `status`, `message`,
  optional `fix`) as the CLI's own JSON output.
- All 12 checks reimplemented as genuine Python logic against the same
  check contract the npm package uses (7 technical: title, meta
  description, canonical tag, robots.txt, sitemap.xml, heading structure,
  image alt coverage; 5 GEO: structured data / JSON-LD, llms.txt, AI
  crawler directives, FAQ schema, content extraction friendliness) -- the
  same thresholds, the same PASS/WARN/FAIL verdicts, and the same message/
  fix text as the TypeScript originals.
- Fleet mode (`LLMScout fleet <manifest.json>`): runs the full 12-check
  suite against every site declared in a local JSON manifest in one
  invocation, ported from `src/fleet.ts`.
- **Zero runtime dependencies.** Unlike the npm package (which uses
  `cheerio` for HTML parsing and `commander` for argument parsing), the
  Python port uses only the standard library: a small `html.parser`-based
  tree builder (`LLMScout.html_util`, no TypeScript equivalent needed --
  cheerio provided this directly on that side) in place of cheerio, and
  `argparse` in place of commander. There is no third-party HTTP library
  either -- the redirect-following, scheme-validating fetch wrapper
  (`LLMScout.fetch_utils.safe_fetch`) is built on `urllib.request`.
- Full pytest suite (106 tests) ported from the TypeScript vitest suite,
  covering all 12 checks (FAIL/WARN/PASS branches), the HTML tree builder,
  the fetch wrapper's URL/redirect validation, config loading, fleet
  manifest loading, output formatting, `init` scaffolding, the CLI, and an
  end-to-end init-then-check pipeline test -- all served by fetch stubs, no
  real network calls in the automated suite.

## [0.1.0] - npm, initial public release

The original TypeScript/Node CLI. See the
[project README](https://github.com/RudrenduPaul/LLMScout#readme) for its
own history; this changelog file was added alongside the Python port and
does not retroactively document npm-only changes that predate it.
