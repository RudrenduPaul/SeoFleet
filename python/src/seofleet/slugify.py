"""Ported from src/slugify.ts."""
from __future__ import annotations

import re

_SCHEME_RE = re.compile(r"^[a-z][a-z0-9+.\-]*://", re.IGNORECASE)
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")
_EDGE_HYPHEN_RE = re.compile(r"^-+|-+$")


def slugify(text: str) -> str:
    """
    Turns a site URL or a fleet manifest's site `name` into a
    filesystem-safe slug usable as a per-site report filename stem:
    lowercased, any URL scheme stripped, and every run of characters that
    isn't a letter or digit collapsed to a single hyphen (with
    leading/trailing hyphens trimmed). `https://good.example/blog/post`
    becomes `good-example-blog-post`; a manifest name like "Client A"
    becomes `client-a`. Falls back to `"site"` for input that slugifies to
    nothing (e.g. an empty string or a URL made up entirely of
    punctuation), so a caller never ends up writing to a blank filename.
    """
    without_scheme = _SCHEME_RE.sub("", text)
    slug = _EDGE_HYPHEN_RE.sub("", _NON_ALNUM_RE.sub("-", without_scheme.lower()))
    return slug or "site"
