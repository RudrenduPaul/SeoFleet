# CI integrations

LLMScout is meant to run as a CI check on any pipeline that publishes a
site you care about the SEO/GEO posture of. Both packages support the
same `LLMScout check <path> [--json]` contract and the same exit-code
convention (`0` clean, `1` at least one FAIL, `2` usage error), so pick
whichever matches your pipeline's existing toolchain.

## GitHub Actions -- Python CLI

Published on PyPI as [`LLMScout-cli`](https://pypi.org/project/LLMScout-cli/).

```yaml
name: LLMScout check
on: [pull_request]

jobs:
  LLMScout-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install LLMScout-cli
      - name: Run LLMScout
        run: LLMScout check . --json > LLMScout-results.json
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: LLMScout-results
          path: LLMScout-results.json
```

The step's own exit code already gates the job -- `LLMScout check` exits
`1` on any FAIL, which fails the step (and, if you don't add
`continue-on-error`, the job) automatically. The `--json` file it writes
is what you'd forward to another step (a PR comment, a dashboard, an
agent) that wants structured findings rather than the human-readable text
output.

## GitHub Actions -- npm CLI

Published on npm as [`LLMScout-cli`](https://www.npmjs.com/package/LLMScout-cli).

```yaml
name: LLMScout check
on: [pull_request]

jobs:
  LLMScout-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install --save-dev LLMScout-cli
      - run: npx LLMScout check . --json > LLMScout-results.json
```

## Pre-commit hook (Python CLI)

For a local/pre-push gate rather than CI, wire the Python CLI into
[pre-commit](https://pre-commit.com/):

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: LLMScout
        name: LLMScout check
        entry: LLMScout check .
        language: system
        pass_filenames: false
```

This assumes `LLMScout` is already on `PATH` (installed via `pip install
LLMScout-cli` in your dev environment).

## Fleet mode in CI

If your pipeline checks several client sites from one repo, use `fleet`
instead of running `check` once per site:

```yaml
      - run: pip install LLMScout-cli
      - run: LLMScout fleet ./fleet.json --json > fleet-results.json
```

`fleet` exits `1` if any listed site FAILed or errored (a missing
`LLMScout.json`, an unreachable manifest path), so the same exit-code gate
applies without extra scripting.
