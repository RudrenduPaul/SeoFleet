#!/usr/bin/env python3
"""
01 -- single site check.

The simplest possible use of the LLMScout library: load_site() fetches the
homepage plus robots.txt/sitemap.xml/llms.txt, then run_checks() runs all
12 checks against that shared context. This is the library equivalent of
`LLMScout check <path>` (minus the LLMScout.json file -- here the site URL
is passed directly).

Checks a real live site over https -- example.com by default (IANA's
stable example domain), or a URL passed on the command line.

Run:
    python3 examples/01-single-site-check/check_site.py
    python3 examples/01-single-site-check/check_site.py https://your-site.example
"""
import sys

from LLMScout import ALL_CHECKS, load_site, run_checks


def main() -> None:
    site_url = sys.argv[1] if len(sys.argv) > 1 else "https://example.com"

    ctx = load_site(site_url)
    results = run_checks(ALL_CHECKS, ctx)

    print(f"LLMScout check -- {site_url}\n")
    for r in results:
        print(f"[{r.status}] ({r.category}) {r.name}")
        print(f"  {r.message}")
        if r.fix:
            print(f"  Fix: {r.fix}")

    pass_count = sum(1 for r in results if r.status == "PASS")
    warn_count = sum(1 for r in results if r.status == "WARN")
    fail_count = sum(1 for r in results if r.status == "FAIL")
    print(f"\nSummary: {pass_count} PASS, {warn_count} WARN, {fail_count} FAIL ({len(results)} checks)")


if __name__ == "__main__":
    main()
