# CI integrations

LLMScout is meant to run as a CI check on any pipeline that publishes a
site you care about the SEO/GEO posture of. Both packages support the
same `llmscout check <path> [--json]` contract and the same exit-code
convention (`0` clean, `1` at least one FAIL, `2` usage error), so pick
whichever matches your pipeline's existing toolchain.

## GitHub Actions -- Python CLI

Published on PyPI as [`llmscout-cli`](https://pypi.org/project/llmscout-cli/).

```yaml
name: LLMScout check
on: [pull_request]

jobs:
  llmscout-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install llmscout-cli
      - name: Run LLMScout
        run: llmscout check . --json > llmscout-results.json
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: llmscout-results
          path: llmscout-results.json
```

The step's own exit code already gates the job -- `llmscout check` exits
`1` on any FAIL, which fails the step (and, if you don't add
`continue-on-error`, the job) automatically. The `--json` file it writes
is what you'd forward to another step (a PR comment, a dashboard, an
agent) that wants structured findings rather than the human-readable text
output.

## GitHub Actions -- npm CLI

Published on npm as [`llmscout-cli`](https://www.npmjs.com/package/llmscout-cli).

```yaml
name: LLMScout check
on: [pull_request]

jobs:
  llmscout-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install --save-dev llmscout-cli
      - run: npx llmscout check . --json > llmscout-results.json
```

## Pre-commit hook (Python CLI)

For a local/pre-push gate rather than CI, wire the Python CLI into
[pre-commit](https://pre-commit.com/):

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: llmscout
        name: LLMScout check
        entry: llmscout check .
        language: system
        pass_filenames: false
```

This assumes `llmscout` is already on `PATH` (installed via `pip install
llmscout-cli` in your dev environment).

## Fleet mode in CI

If your pipeline checks several client sites from one repo, use `fleet`
instead of running `check` once per site:

```yaml
      - run: pip install llmscout-cli
      - run: llmscout fleet ./fleet.json --json > fleet-results.json
```

`fleet` exits `1` if any listed site FAILed or errored (a missing
`llmscout.json`, an unreachable manifest path), so the same exit-code gate
applies without extra scripting.
