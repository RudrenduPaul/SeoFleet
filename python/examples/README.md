# Python examples

Each numbered subdirectory is a real, runnable script against the actual
`seofleet` Python library (`from seofleet import load_site, run_checks,
...`), not pseudocode. They check real live sites over `http(s)` --
`https://example.com` by default (IANA's stable example domain, the same
one this project's own README demonstrates real output against), or a
site URL you pass on the command line.

Install the package first (editable install from this checkout, or `pip
install seofleet-cli` from PyPI both work identically):

```bash
cd python
pip install -e .
```

Then run any example directly:

```bash
python3 examples/01-single-site-check/check_site.py
python3 examples/02-fleet-scan/run_fleet.py
python3 examples/03-ci-gate/gate.py
```

| Example | What it demonstrates |
| --- | --- |
| [01-single-site-check](./01-single-site-check/) | The core library call: `load_site()` + `run_checks()`, reading back each `CheckResult`, printing a human-readable summary -- the library equivalent of `seofleet check <path>`. |
| [02-fleet-scan](./02-fleet-scan/) | Fleet mode: writing a small local manifest and calling `run_fleet()` to check several sites in one pass -- the library equivalent of `seofleet fleet <manifest.json>`. |
| [03-ci-gate](./03-ci-gate/) | Using the library as an actual CI gate: real process exit-code propagation (`0` clean / `1` any FAIL) suitable to drop into a CI script directly -- see `../../docs/integrations/ci.md` for the GitHub Actions version of this same pattern. |
