"""Ported from test/report-file.test.ts."""
from __future__ import annotations

import os

from llmscout.report_file import write_report_file


def test_write_report_file_writes_txt_named_from_slugified_stem(tmp_path):
    out_dir = str(tmp_path / "reports")
    file_path = write_report_file(out_dir, "https://good.example/", False, "report body")
    assert file_path == os.path.join(out_dir, "good-example.txt")
    with open(file_path, "r", encoding="utf-8") as fh:
        assert fh.read() == "report body"


def test_write_report_file_writes_json_when_json_output_true(tmp_path):
    out_dir = str(tmp_path / "reports")
    file_path = write_report_file(out_dir, "client-a", True, "{}")
    assert file_path == os.path.join(out_dir, "client-a.json")


def test_write_report_file_creates_out_dir_recursively(tmp_path):
    out_dir = str(tmp_path / "nested" / "reports")
    assert not os.path.exists(out_dir)
    write_report_file(out_dir, "client-a", False, "x")
    assert os.path.exists(out_dir)


def test_write_report_file_dedupes_identical_stems_via_shared_used_stems(tmp_path):
    out_dir = str(tmp_path / "reports")
    used_stems: dict = {}
    first = write_report_file(out_dir, "Blog", False, "first", used_stems)
    second = write_report_file(out_dir, "Blog", False, "second", used_stems)
    assert first == os.path.join(out_dir, "blog.txt")
    assert second == os.path.join(out_dir, "blog-2.txt")
    with open(first, "r", encoding="utf-8") as fh:
        assert fh.read() == "first"
    with open(second, "r", encoding="utf-8") as fh:
        assert fh.read() == "second"


def test_write_report_file_does_not_dedupe_across_calls_without_used_stems(tmp_path):
    out_dir = str(tmp_path / "reports")
    write_report_file(out_dir, "Blog", False, "first")
    write_report_file(out_dir, "Blog", False, "second")
    with open(os.path.join(out_dir, "blog.txt"), "r", encoding="utf-8") as fh:
        assert fh.read() == "second"
