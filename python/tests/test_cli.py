"""Ported from test/cli.test.ts and test/cli-lib.test.ts."""
from __future__ import annotations

import email.message
import io
import json
import sys
from unittest.mock import patch

from seofleet import fetch_utils
from seofleet.cli import run_cli
from seofleet.cli_lib import run_check_command, run_fleet_command, run_init_command

from .conftest import GOOD_HTML, make_fetch_stub


class _FakeHttpResponse:
    """Minimal stand-in for the object `_opener.open(...)` returns -- see
    test_fetch_utils.py for the same helper."""

    def __init__(self, body: bytes = b"", status: int = 200) -> None:
        self.status = status
        self.headers = email.message.Message()
        self._buf = io.BytesIO(body)

    def read(self, size: int = -1) -> bytes:
        return self._buf.read(size)

    def __enter__(self) -> "_FakeHttpResponse":
        return self

    def __exit__(self, *exc_info: object) -> bool:
        return False


def test_run_init_command_creates_scaffold(tmp_path):
    output = run_init_command(str(tmp_path), "https://example.com", json_output=False)
    assert output.exit_code == 0
    assert "Created" in output.stdout


def test_run_check_command_no_config_is_usage_error(tmp_path):
    output = run_check_command(str(tmp_path), json_output=False)
    assert output.exit_code == 2
    assert "Error:" in output.stderr


def test_run_check_command_exit_code_reflects_failure(tmp_path):
    (tmp_path / "seofleet.json").write_text(json.dumps({"siteUrl": "https://acme.example/"}))
    stub = make_fetch_stub({"https://acme.example/": {"body": GOOD_HTML, "status": 200}})
    output = run_check_command(str(tmp_path), json_output=False, fetch_fn=stub)
    # robots.txt/sitemap.xml/llms.txt are all unstubbed -> 404 -> robots-txt FAILs
    assert output.exit_code == 1


def test_run_check_command_json_output_is_valid_json(tmp_path):
    (tmp_path / "seofleet.json").write_text(json.dumps({"siteUrl": "https://acme.example/"}))
    stub = make_fetch_stub({"https://acme.example/": {"body": GOOD_HTML, "status": 200}})
    output = run_check_command(str(tmp_path), json_output=True, fetch_fn=stub)
    payload = json.loads(output.stdout)
    assert payload["summary"]["total"] == 21


def test_run_check_command_sends_user_agent_override_when_no_fetch_fn_stub(tmp_path, monkeypatch):
    (tmp_path / "seofleet.json").write_text(json.dumps({"siteUrl": "https://good.example/"}))
    seen_user_agents = []

    def _fake_open(request, timeout=None):
        seen_user_agents.append(request.headers.get("User-agent"))
        return _FakeHttpResponse()

    monkeypatch.setattr(fetch_utils._opener, "open", _fake_open)
    run_check_command(str(tmp_path), json_output=True, user_agent="MyCustomBot/1.0")

    assert len(seen_user_agents) > 0
    assert all(ua == "MyCustomBot/1.0" for ua in seen_user_agents)


def test_run_check_command_prefers_explicit_fetch_fn_over_user_agent_override(tmp_path):
    (tmp_path / "seofleet.json").write_text(json.dumps({"siteUrl": "https://acme.example/"}))
    stub = make_fetch_stub({"https://acme.example/": {"body": GOOD_HTML, "status": 200}})
    output = run_check_command(str(tmp_path), json_output=True, fetch_fn=stub, user_agent="MyCustomBot/1.0")
    assert json.loads(output.stdout)["summary"]["total"] == 21


def test_run_fleet_command_reports_site_errors(tmp_path):
    manifest = tmp_path / "fleet.json"
    manifest.write_text(json.dumps({"sites": [{"name": "missing", "path": "./nope"}]}))
    output = run_fleet_command(str(manifest), json_output=False)
    assert output.exit_code == 1


def test_run_cli_no_command_prints_help_and_exits_zero(capsys):
    exit_code = run_cli(["seofleet"])
    assert exit_code == 0
    captured = capsys.readouterr()
    assert "usage: seofleet" in captured.out


def test_run_cli_help_lists_user_agent_option(capsys):
    exit_code = run_cli(["seofleet"])
    assert exit_code == 0
    captured = capsys.readouterr()
    assert "--user-agent" in captured.out


def test_run_cli_version_flag_exits_cleanly():
    try:
        run_cli(["seofleet", "--version"])
    except SystemExit as exc:
        assert exc.code == 0


def test_run_cli_init_writes_scaffold(tmp_path, capsys):
    exit_code = run_cli(["seofleet", "init", str(tmp_path), "--site-url", "https://example.com"])
    assert exit_code == 0
    captured = capsys.readouterr()
    assert "Created" in captured.out


def test_run_cli_reconfigures_stdout_and_stderr_to_utf8_on_win32(tmp_path):
    # Regression test: on Windows, stdout/stderr default to the legacy
    # cp1252 codepage, so a fetched page title/meta-description containing
    # a character outside cp1252 raises UnicodeEncodeError and crashes the
    # CLI before any output is written. run_cli must reconfigure both
    # streams to UTF-8 up front whenever sys.platform == "win32".
    with patch.object(sys, "platform", "win32"), \
            patch.object(sys, "stdout") as mock_stdout, \
            patch.object(sys, "stderr") as mock_stderr:
        run_cli(["seofleet"])

    mock_stdout.reconfigure.assert_called_once_with(encoding="utf-8")
    mock_stderr.reconfigure.assert_called_once_with(encoding="utf-8")


def test_run_cli_does_not_reconfigure_streams_on_non_windows(tmp_path):
    with patch.object(sys, "platform", "linux"), \
            patch.object(sys, "stdout") as mock_stdout, \
            patch.object(sys, "stderr") as mock_stderr:
        run_cli(["seofleet"])

    mock_stdout.reconfigure.assert_not_called()
    mock_stderr.reconfigure.assert_not_called()


def test_run_cli_tolerates_streams_without_reconfigure_on_win32(tmp_path):
    # Some stream replacements (e.g. certain test/CI harnesses) don't
    # expose reconfigure(). run_cli must not crash in that case.
    class _StreamNoReconfigure:
        def write(self, _text: str) -> int:
            return 0

    with patch.object(sys, "platform", "win32"), \
            patch.object(sys, "stdout", _StreamNoReconfigure()), \
            patch.object(sys, "stderr", _StreamNoReconfigure()):
        exit_code = run_cli(["seofleet"])

    assert exit_code == 0
