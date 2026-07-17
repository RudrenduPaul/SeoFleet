# Contributing to SeoFleet

SeoFleet ships two independently maintained, equally first-class
distributions of the same 12-check tool: an npm package (`seofleet-cli`,
TypeScript, repo root) and a PyPI package (`seofleet-cli`, Python,
`python/`). Both run the same 12 checks (7 technical-SEO, 5 GEO) and are
expected to produce the same PASS/WARN/FAIL verdicts against the same
target site. Please read this whole file before opening a PR -- which
section applies depends on which codebase you're touching.

## Ground rules

- Every change lands with tests. Neither test suite is optional scaffolding
  -- both are the mechanism that keeps the two implementations in parity.
- A check-behavior change (a new threshold, a changed status, a changed
  message) must be made in **both** `src/checks/` (TypeScript) and
  `python/src/seofleet/checks/` (Python), with equivalent test coverage
  added to both suites. A check that only exists in one language is a
  silent behavior gap between the two CLIs -- avoid it.
- Messages, fix text, and exit codes should read identically between the
  two CLIs wherever the underlying behavior is the same. If you
  intentionally diverge the two, say so explicitly in the PR description.
- No `child_process`/`subprocess`/`eval`/`exec` of anything derived from a
  fetched site's content, in either codebase. Both CLIs only ever read and
  parse fetched HTML/text; they never execute it.

## Working on the TypeScript package (repo root)

```bash
npm install
npm run build
npm test
npm run typecheck
npm run lint
```

- Source lives under `src/`; individual checks under `src/checks/technical/`
  and `src/checks/geo/`.
- Tests use `vitest` (`test/**/*.test.ts`, one file per module, plus
  `test/test-helpers.ts` for shared fixtures and a fetch stub).
- `npm run build` compiles to `dist/`, which is what the `bin` entry
  (`seofleet`) resolves to.

## Working on the Python package (`python/`)

```bash
cd python
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

- Source lives under `python/src/seofleet/`, laid out to mirror the
  TypeScript module structure 1:1 (`checks/technical/`, `checks/geo/`,
  `fetch_utils.py`, `config.py`, `fleet.py`, `runner.py`, `format.py`,
  `init.py`, `cli.py`, `cli_lib.py`, `types.py`, `errors.py`) so a change
  in one codebase has an obvious counterpart to check in the other. The
  one Python-only module is `html_util.py` -- a small `html.parser`-based
  tree builder standing in for the TypeScript side's `cheerio` dependency;
  there was no TypeScript module to port it from.
- Tests use `pytest` (`python/tests/test_*.py`), including an end-to-end
  test that runs the full `init` -> `check` pipeline against a scratch
  directory with a fetch stub -- no real network calls in the suite.
- Build and verify a real install before opening a PR that touches
  packaging. Build the venv **outside** `python/` so it never gets swept
  into the sdist:
  ```bash
  python3 -m venv /tmp/seofleet-verify-venv
  /tmp/seofleet-verify-venv/bin/pip install build
  /tmp/seofleet-verify-venv/bin/python3 -m build python --outdir python/dist
  /tmp/seofleet-verify-venv/bin/pip install python/dist/*.whl
  /tmp/seofleet-verify-venv/bin/seofleet check <some-project-dir>
  ```

## Adding a 13th check

Adding a check is intentionally small on both sides:

- **TypeScript**: implement the `Check` interface (`src/types.ts`) in a
  new file under `src/checks/technical/` or `src/checks/geo/`, then
  register it in `src/checks/index.ts`.
- **Python**: build a `Check` (`seofleet.types.Check`) in a new module
  under `python/src/seofleet/checks/technical/` or `.../checks/geo/`, then
  register it in `python/src/seofleet/checks/__init__.py`.

Add the same check, with the same id/name/category/thresholds, to both
sides in the same PR, with tests in both suites.

## Reporting a security issue

Do not open a public issue for a security vulnerability. See
[SECURITY.md](./SECURITY.md).

## License

By contributing, you agree your contribution is licensed under the same
MIT License that covers the rest of this repository (see
[LICENSE](./LICENSE)).
