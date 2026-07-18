"""
Thin argument-parsing wrapper over LLMScout.cli_lib. Ported from src/cli.ts
(which uses `commander`); this port uses the stdlib `argparse` to avoid a
CLI-framework dependency. Flags, subcommands, and output are kept as close
as practical to the npm CLI's own `--help` output. Console entry point:
`LLMScout [options] <command>`, installed via the `LLMScout` console-script
defined in python/pyproject.toml.
"""
from __future__ import annotations

import argparse
import sys
from typing import List

from .cli_lib import run_check_command, run_fleet_command, run_init_command

_VERSION = "0.1.0"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="LLMScout",
        description=(
            "Zero-config, cross-platform SEO and GEO checks for local projects, "
            "with no extra runtime toolchain."
        ),
    )
    parser.add_argument("-V", "--version", action="version", version=f"LLMScout-cli {_VERSION}")
    parser.add_argument(
        "--json", action="store_true", default=False,
        help="output structured JSON instead of human-readable text",
    )
    parser.add_argument(
        "--user-agent", dest="user_agent", default=None,
        help="override the default User-Agent header sent on outbound fetches",
    )

    subparsers = parser.add_subparsers(dest="command")

    init_parser = subparsers.add_parser(
        "init",
        help="Scaffold a LLMScout setup (LLMScout.json + a Claude Code skill file) into a target directory",
    )
    init_parser.add_argument("path", help="target project directory")
    init_parser.add_argument(
        "--site-url", dest="site_url", default=None,
        help="set siteUrl in the scaffolded config immediately",
    )

    check_parser = subparsers.add_parser(
        "check", help="Run SEO/GEO checks against a local project's configured site"
    )
    check_parser.add_argument("path", help="local project directory containing LLMScout.json")

    fleet_parser = subparsers.add_parser(
        "fleet", help="Run the full check suite against every site listed in a fleet manifest"
    )
    fleet_parser.add_argument(
        "config_json", metavar="config.json",
        help='fleet manifest file: { "sites": [{ "name", "path" }] }',
    )

    return parser


def run_cli(argv: List[str]) -> int:
    """
    `argv` follows the sys.argv convention: argv[0] is the program name,
    the real arguments start at argv[1]. Returns the process exit code
    (0 clean / 1 check-fail / 2 usage-config error).
    """
    # Windows' console defaults stdout/stderr to the legacy cp1252 codepage,
    # so any fetched page title/meta-description containing a character
    # outside that codepage raises UnicodeEncodeError and crashes the CLI.
    # Reconfigure to UTF-8 before any output is written, matching the
    # guarantee Node's always-UTF-8 console.log already gives the npm/TS
    # CLI. Guarded by hasattr() since reconfigure() (Python 3.7+ streams)
    # may be unavailable if stdout/stderr have been replaced (e.g. in tests).
    if sys.platform == "win32":
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8")

    parser = build_parser()
    args = parser.parse_args(argv[1:])

    if args.command is None:
        parser.print_help()
        return 0

    if args.command == "init":
        result = run_init_command(args.path, args.site_url, args.json)
    elif args.command == "check":
        result = run_check_command(args.path, args.json, user_agent=args.user_agent)
    elif args.command == "fleet":
        result = run_fleet_command(args.config_json, args.json, user_agent=args.user_agent)
    else:  # pragma: no cover - argparse restricts to the registered subcommands
        parser.print_help()
        return 0

    if result.stdout:
        sys.stdout.write(result.stdout + "\n")
    if result.stderr:
        sys.stderr.write(result.stderr + "\n")
    return result.exit_code


def main() -> None:
    sys.exit(run_cli(sys.argv))


if __name__ == "__main__":
    main()
