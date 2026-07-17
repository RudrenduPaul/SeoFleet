"""
Ported from src/errors.ts.

A LLMScoutError always carries the process exit code it should map to, so
the CLI layer never has to re-derive "was this a usage error or a check
failure" from a generic exception message string.
"""
from __future__ import annotations


class LLMScoutError(Exception):
    """Raised for any usage/configuration error. Carries its own exit code."""

    def __init__(self, message: str, exit_code: int = 2) -> None:
        super().__init__(message)
        self.message = message
        self.exit_code = exit_code

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.message
