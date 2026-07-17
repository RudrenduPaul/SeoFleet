# Getting started

LLMScout checks a site for 12 technical-SEO and GEO (generative-engine-
optimization) issues and reports PASS/WARN/FAIL per check, with a fix
suggestion for anything short of a clean pass. It ships as two
independent, equally first-class packages: an npm package (`LLMScout-cli`,
JavaScript/TypeScript) and a PyPI package (`LLMScout-cli`, Python). Pick
whichever fits your toolchain, or install both.

## Install

**npm (JS/TS CLI):**

The npm package is currently blocked on a transient npm-registry rate
limit; install from source in the meantime (`git clone` + `npm install &&
npm run build && npm link` -- see the
[project README](../README.md#install)).

**pip (Python CLI + library):**

```bash
pip install LLMScout-cli
```

The Python package has **zero runtime dependencies** -- HTML parsing and
HTTP fetching both use only the standard library, so `pip install
LLMScout-cli` pulls in nothing else.

## Your first check

```bash
LLMScout init ./my-site --site-url https://example.com
LLMScout check ./my-site
```

`init` scaffolds a `LLMScout.json` (and a Claude Code skill file) in the
target directory; it is idempotent, so re-running it never clobbers an
already-configured `siteUrl`. `check` runs all 12 checks against the
configured `siteUrl` and prints one PASS/WARN/FAIL line per check.

Real output (Python CLI shown; the npm CLI's human-readable output is
line-for-line identical) against `https://example.com`:

```
LLMScout check -- https://example.com

[PASS] (technical) Title tag
  Title "Example Domain" is 14 characters, within the recommended 10-60 range.

[WARN] (technical) Meta description
  No meta description found.
  Fix: Add <meta name="description" content="..."> with 50-160 characters summarizing the page.

[FAIL] (technical) robots.txt
  robots.txt was not reachable at https://example.com/robots.txt (HTTP 404).
  Fix: Add a robots.txt file at your site root, even a permissive one, so crawlers and agents have explicit directives.

...

Summary: 4 PASS, 7 WARN, 1 FAIL (12 checks)
```

`check` exits `0` when no check FAILs, `1` when at least one check FAILs
(WARN alone never fails the run), and `2` on a usage error (a missing or
misconfigured `LLMScout.json`, an invalid URL scheme).

## Using the library instead of the CLI

Both packages export a programmatic entry point for agent frameworks that
want to call LLMScout in-process instead of shelling out to a CLI binary.

**TypeScript:**

```ts
import { loadSite, runChecks, ALL_CHECKS } from 'LLMScout-cli';

const ctx = await loadSite('https://example.com');
const results = await runChecks(ALL_CHECKS, ctx);
```

**Python:**

```python
from LLMScout import load_site, run_checks, ALL_CHECKS

ctx = load_site("https://example.com")
results = run_checks(ALL_CHECKS, ctx)
for r in results:
    print(f"[{r.status}] ({r.category}) {r.name}: {r.message}")
```

Both return the same shape of result: one entry per check with `id`,
`name`, `category`, `status`, `message`, and an optional `fix` -- see
[concepts.md](./concepts.md) for the full data model.

## Next steps

- [concepts.md](./concepts.md) -- what each of the 12 checks actually
  verifies, and how the check pipeline decides a verdict.
- [integrations/ci.md](./integrations/ci.md) -- wiring LLMScout into a CI
  pipeline.
- The [project README](../README.md) for the full tool comparison.
