# Concepts

## The check pipeline

Both the npm and PyPI packages run the same pipeline (TypeScript:
`src/cli-lib.ts`; Python: `python/src/seofleet/cli_lib.py`):

```
seofleet.json (siteUrl + checks.technical/geo flags)
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
run the selected checks (12 technical + 9 GEO, or a subset per
seofleet.json's checks.technical/checks.geo flags) against that one
shared context -- a check raising becomes a FAIL result citing the error,
never a crash of the whole run
     |
     v
PASS/WARN/FAIL per check -> exit code (0 clean / 1 any FAIL / 2 usage error)
```

A check result is always a plain structured value (`CheckResult` /
`CheckResult` dataclass), never a thrown exception -- a caller embedding
SeoFleet as a library gets a consistent contract regardless of what went
wrong (an unreachable homepage, a network timeout, a malformed
`seofleet.json`).

## Verdict taxonomy

| Status | Meaning |
| --- | --- |
| PASS | The check's condition is satisfied. |
| WARN | A missed optimization, not a broken page -- never fails the run on its own (e.g. a missing meta description, a missing llms.txt). |
| FAIL | A defect that fails the run's exit code (e.g. no `<h1>`, an unreachable robots.txt, invalid JSON-LD). |

`check`/`fleet` exit `1` if and only if at least one check result is
FAIL. A run with only WARNs still exits `0`.

## The 21 checks

### Technical SEO (12)

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

**Open Graph tags** (`open-graph`) -- `og:title`, `og:description`,
`og:image`, and `og:url` meta tags are present, for rich link previews on
social platforms. All four present is PASS; some but not all is WARN with
the missing tags named; none is WARN.

**Twitter/X Card tags** (`twitter-card`) -- a valid `twitter:card` meta tag
(`summary`, `summary_large_image`, `app`, or `player`) and its required
companion fields are present. An unrecognized card type is FAIL; missing
entirely or missing required fields is WARN; valid and complete is PASS.

**Meta robots directives** (`robots-meta-directives`) -- advanced snippet-
control directives (`max-snippet`, `max-image-preview`, `max-video-preview`)
are set in a `<meta name="robots">` tag. An outright `noindex` is FAIL;
missing or partial advanced directives is WARN; all three set is PASS.

**Image weight** (`image-weight`) -- each `<img>` with an `http(s)` `src`
is HEAD-requested to measure its actual byte size. Over 500KB for any image
is FAIL; over 200KB is WARN; everything under that (or no measurable
images) is PASS.

**Redirect chain** (`redirect-chain`) -- the homepage's actual followed
redirect chain (not just its final status). A chain that dead-ends in a
4xx/5xx status is FAIL; a chain longer than two hops is WARN; zero or one
to two hops resolving cleanly is PASS.

### GEO / generative engine optimization (9)

**Structured data** (`structured-data`) -- at least one
`<script type="application/ld+json">` block exists and parses as valid
JSON. None found is WARN (informational: not every page needs JSON-LD);
any block failing to parse is FAIL; all present blocks valid is PASS.

**llms.txt** (`llms-txt`) -- an `/llms.txt` is present at the site root.
This is an emerging, not-yet-universal convention (see
[llmstxt.org](https://llmstxt.org)), so its absence is WARN only, never a
FAIL.

**AI crawler directives** (`ai-crawler-directives`) -- reports (never
prescribes) the robots.txt allow/disallow state for seven AI crawlers,
training and search/retrieval crawlers tracked separately since OpenAI and
Anthropic run them as independently blockable user agents: `GPTBot`,
`OAI-SearchBot`, `ClaudeBot`, `Claude-SearchBot`, `PerplexityBot`,
`Google-Extended`, `Applebot-Extended`. If robots.txt is unreachable the
check WARNs (directives can't be determined); otherwise it PASSes and
states each bot's directive as `allow`/`disallow`/`unspecified`. Whether to
allow or block any of these bots is a genuine site-owner decision this
check does not take a position on.

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

**Speakable schema** (`speakable-schema`) -- a `SpeakableSpecification` is
present in JSON-LD (top-level or nested inside a `WebPage`/`Article`),
naming the CSS selectors or `xpath` a voice assistant should read aloud.
Absence is WARN only -- informational, and only relevant to content
actually suited for voice.

**Organization schema** (`organization-schema`) -- `Organization`,
`Corporation`, `LocalBusiness`, or `Person` JSON-LD is present, ideally
with a `sameAs` array of official social/profile URLs (a real Knowledge
Panel signal). Absence is WARN.

**Markdown content negotiation** (`markdown-negotiation`) -- the homepage
is re-requested with `Accept: text/markdown` and the response
`Content-Type` is checked. A `text/markdown` response is PASS; anything
else (including a request failure) is WARN -- this is an emerging,
non-standard capability, not yet supported by any major AI crawler in
practice, so its absence is never penalized as a defect.

**Link header** (`link-header`) -- whether the homepage response sends an
RFC 8288 `Link` header (e.g. advertising a feed or an API discovery
endpoint). Absence is WARN only -- informational.

## Fleet mode

`fleet <manifest.json>` runs the full 21-check suite against every site
declared in a local JSON manifest (`{"sites": [{"name", "path"}]}`) in one
invocation. Each entry's `path` points at a directory with its own
`seofleet.json`; relative paths resolve against the manifest file's own
directory (not the process's working directory), so the same manifest
works no matter where it's invoked from. Pass `--out-dir <dir>` to also
write one auto-named report file per site (named from the manifest's
`name` field) instead of only a combined stdout summary. Fleet mode reads
the local filesystem only -- there is no SSH and no remote execution; each
site's own `siteUrl` is fetched over `http(s)` exactly as `check` would
fetch it directly.

## Fetch safety

The one fetch wrapper both distributions build every request on (`src/
fetch-utils.ts`; `python/src/seofleet/fetch_utils.py`) is deliberately
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
