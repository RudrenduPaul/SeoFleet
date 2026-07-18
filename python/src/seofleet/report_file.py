"""Ported from src/report-file.ts."""
from __future__ import annotations

import os
from typing import Dict, Optional

from .errors import SeoFleetError
from .slugify import slugify


def write_report_file(
    out_dir: str,
    stem: str,
    json_output: bool,
    content: str,
    used_stems: Optional[Dict[str, int]] = None,
) -> str:
    """
    Writes one auto-named report file into `out_dir` -- `<slug(stem)>.json`
    or `.txt` depending on `json_output` -- creating `out_dir`
    (recursively) if it doesn't already exist. Returns the absolute path
    written so callers can surface it back to the user.

    `used_stems`, when passed, lets a caller writing several files in one
    run (fleet mode, one call per manifest site) dedupe two sites that
    slugify to the same stem -- e.g. two manifest entries both named
    "Blog" -- into `blog.txt` and `blog-2.txt` instead of the second
    silently overwriting the first.
    """
    try:
        os.makedirs(out_dir, exist_ok=True)
    except OSError as err:
        raise SeoFleetError(f'Could not create --out-dir "{out_dir}": {err}', 2) from err

    slug = slugify(stem)
    if used_stems is not None:
        seen_count = used_stems.get(slug, 0)
        used_stems[slug] = seen_count + 1
        if seen_count > 0:
            slug = f"{slug}-{seen_count + 1}"

    ext = "json" if json_output else "txt"
    file_path = os.path.join(out_dir, f"{slug}.{ext}")
    try:
        with open(file_path, "w", encoding="utf-8") as fh:
            fh.write(content)
    except OSError as err:
        raise SeoFleetError(f'Could not write report file "{file_path}": {err}', 2) from err
    return file_path
