# Concepts

## The check pipeline

Both the npm and PyPI packages run the same pipeline (TypeScript:
`src/cli-lib.ts`; Python: `python/src/LLMScout/cli_lib.py`):

```
LLMScout.json (siteUrl + checks.technical/geo flags)
     |
     v
fetch homepage + robots.txt + sitemap.xml + llms.txt, in parallel
(each fetch never raises -- an unreachable resource comes back as
 { ok: false }/FetchedResource(ok=False) for checks to interpret)
     |
     v
parse the homepage once (cheerio on the TS side; a small stdlib
html.parser-based tree on the Python side) into a shared CheckContext
     |
     v
run the selected checks (7 technical + 5 GEO, or a subset per
LLMScout.json's checks.technical/checks.geo flags) against that one
shared context -- a check raising becomes a FAIL result citing the error,
never a crash of the whole run
     |
     v
PASS/WARN/FAIL per check -> exit code (0 clean / 1 any FAIL / 2 usage error)
```

A check result is always a plain structured value (`CheckResult` /
`CheckResult` dataclass), never a thrown exception -- a caller embedding
LLMScout as a library gets a consistent contract regardless of what went
wrong (an unreachable homepage, a network timeout, a malformed
`LLMScout.json`).

## Verdict taxonomy

| Status | Meaning |
| --- | --- |
| PASS | The check's condition is satisfied. |
| WARN | A missed optimization, not a broken page -- never fails the run on its own (e.g. a missing meta description, a missing llms.txt). |
| FAIL | A defect that fails the run's exit code (e.g. no `<h1>`, an unreachable robots.txt, invalid JSON-LD). |

`check`/`fleet` exit `1` if and only if at least one check result is
FAIL. A run with only WARNs still exits `0`.

## The 12 checks

### Technical SEO (7)

**Title tag** (`title`) -- a `<title>` exists and is 10-60 characters.
Missing/empty is FAIL; too short or too long is WARN; in-range is PASS.

**Meta description** (`meta-description`) -- a
`<meta name="description">` exists and is 50-160 characters. Missing is
WARN (search engines auto-generate a snippet as a fallback, so this is a
missed optimization, not a broken page); out-of-range length is WARN;
in-range is PASS.

**Canonical tag** (`canonical`) -- a `<link rel="canonical">` exists and
its `href` resolves to a valid URL. A relative `href` is resolved against
the site's own URL before validating, so a root-relative canonical isn't
penalized. Missing is WARN; an unparseable `href` is FAIL; valid is PASS.

**robots.txt** (`robots-txt`) -- `/robots.txt` is reachable and contains
at least one `User-agent:` directive. Unreachable is FAIL; reachable but
missing a `User-agent:` line is WARN; both conditions met is PASS.

**sitemap.xml** (`sitemap-xml`) -- `/sitemap.xml` is reachable and looks
like valid sitemap XML (a `<urlset>` or `<sitemapindex>` root element).
Unreachable is WARN (a site can be well-indexed without a literal
`/sitemap.xml`, e.g. one declared under a different name in robots.txt);
reachable but not sitemap-shaped is FAIL; valid is PASS.

**Heading structure** (`heading-structure`) -- exactly one `<h1>`, and no
skipped heading level (e.g. an `<h1>` directly followed by an `<h3>` with
no `<h2>` between them). No `<h1>` is FAIL; more than one `<h1>` or a
skipped level is WARN; a clean single-`<h1>` hierarchy is PASS.

**Image alt coverage** (`image-alt`) -- `<img>` tags carry an `alt`
attribute. An `alt=""` (empty but present) counts as covered -- that's the
correct, intentional markup for a decorative image; only a fully missing
`alt` attribute counts against coverage. No images is PASS; ≥80% coverage
with some gaps is WARN; below 80% is FAIL.

### GEO / generative engine optimization (5)

**Structured data** (`structured-data`) -- at least one
`<script type="application/ld+json">` block exists and parses as valid
JSON. None found is WARN (informational: not every page needs JSON-LD);
any block failing to parse is FAIL; all present blocks valid is PASS.

**llms.txt** (`llms-txt`) -- an `/llms.txt` is present at the site root.
This is an emerging, not-yet-universal convention (see
[llmstxt.org](https://llmstxt.org)), so its absence is WARN only, never a
FAIL.

**AI crawler directives** (`ai-crawler-directives`) -- reports (never
prescribes) the robots.txt allow/disallow state for four AI crawlers:
`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`. If robots.txt is
unreachable the check WARNs (directives can't be determined); otherwise it
PASSes and states each bot's directive as `allow`/`disallow`/
`unspecified`. Whether to allow or block any of these bots is a genuine
site-owner decision this check does not take a position on.

**FAQ schema** (`faq-schema`) -- `FAQPage` JSON-LD structured data is
present (including a `FAQPage` type nested inside an `@graph` array).
Absence is WARN only -- it's informational and only relevant to pages that
actually have FAQ content.

**Content extraction friendliness** (`content-extraction`) -- a heuristic
for whether a generative engine can chunk the page's content: it looks for
heading/paragraph structure inside `<main>` (or `<body>` if there's no
`<main>`) versus a large block of text with no internal heading/paragraph
structure (over an 800-character threshold). No heading or paragraph
structure at all is WARN; a large unstructured block is WARN; reasonable
structure is PASS. **Documented limitation**: this check reads static HTML
only -- it cannot evaluate content that only appears after client-side
JavaScript renders, and it cannot judge semantic quality. Treat a WARN
here as "worth a manual look," not a definitive verdict.

## Fleet mode

`fleet <manifest.json>` runs the full 12-check suite against every site
declared in a local JSON manifest (`{"sites": [{"name", "path"}]}`) in one
invocation. Each entry's `path` points at a directory with its own
`LLMScout.json`; relative paths resolve against the manifest file's own
directory (not the process's working directory), so the same manifest
works no matter where it's invoked from. Fleet mode reads the local
filesystem only -- there is no SSH and no remote execution; each site's
own `siteUrl` is fetched over `http(s)` exactly as `check` would fetch it
directly.

## Fetch safety

The one fetch wrapper both distributions build every request on (`src/
fetch-utils.ts`; `python/src/LLMScout/fetch_utils.py`) is deliberately
narrow:

- Only ever dials `http(s)` -- a `file://`, `ftp://`, or any other scheme
  is rejected before any request is made.
- Follows redirects manually, one hop at a time, and refuses to follow a
  redirect whose `Location` targets a non-`http(s)` scheme.
- Bounds the redirect chain at 5 hops, so a redirect loop can't hang the
  process.
- Never raises for an ordinary network failure (timeout, DNS failure, a
  non-2xx status) -- it comes back as `{ ok: false }` /
  `FetchedResource(ok=False)` for the calling check to turn into a
  WARN/FAIL result, not an unhandled exception.
