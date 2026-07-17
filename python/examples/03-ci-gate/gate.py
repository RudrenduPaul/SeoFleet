#!/usr/bin/env python3
"""
03 -- CI gate.

Demonstrates using the seofleet library as an actual CI gate script: takes
a site URL from the command line (falling back to https://example.com so
it's runnable with zero arguments), prints a summary, and propagates the
real check exit-code convention (0 clean / 1 any FAIL) as the process exit
code -- exactly what you'd drop into a CI pipeline step (see
../../../docs/integrations/ci.md for the GitHub Actions version of this
same pattern).

Run:
    python3 examples/03-ci-gate/gate.py
    python3 examples/03-ci-gate/gate.py https://your-site.example
"""
import sys

from seofleet import ALL_CHECKS, has_failure, load_site, run_checks


def main() -> int:
    site_url = sys.argv[1] if len(sys.argv) > 1 else "https://example.com"

    ctx = load_site(site_url)
    results = run_checks(ALL_CHECKS, ctx)

    if not has_failure(results):
        warn_count = sum(1 for r in results if r.status == "WARN")
        print(f"PASS: {site_url} -- no FAILs ({warn_count} WARN).")
        return 0

    fail_results = [r for r in results if r.status == "FAIL"]
    print(f"FAIL: {site_url} -- {len(fail_results)} check(s) FAILed:", file=sys.stderr)
    for r in fail_results:
        print(f"  ({r.category}) {r.name}: {r.message}", file=sys.stderr)
        if r.fix:
            print(f"    Fix: {r.fix}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
