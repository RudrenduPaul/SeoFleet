"""Ported from test/runner.test.ts."""
from __future__ import annotations

from seofleet.runner import has_failure, run_checks
from seofleet.types import Check, CheckResult

from .conftest import make_check_context


def _ok_check(check_id="ok"):
    return Check(id=check_id, name="OK", category="technical", run=lambda ctx: CheckResult(check_id, "OK", "technical", "PASS", "fine"))


def _raising_check():
    def _run(ctx):
        raise RuntimeError("boom")

    return Check(id="broken", name="Broken", category="technical", run=_run)


def test_run_checks_returns_one_result_per_check():
    ctx = make_check_context("<html></html>")
    results = run_checks([_ok_check("a"), _ok_check("b")], ctx)
    assert [r.id for r in results] == ["a", "b"]


def test_a_raising_check_becomes_a_fail_result_not_a_crash():
    ctx = make_check_context("<html></html>")
    results = run_checks([_ok_check("a"), _raising_check(), _ok_check("c")], ctx)
    assert [r.id for r in results] == ["a", "broken", "c"]
    assert results[1].status == "FAIL"
    assert "boom" in results[1].message


def test_has_failure_true_when_any_fail():
    results = [CheckResult("a", "A", "technical", "PASS", "ok"), CheckResult("b", "B", "technical", "FAIL", "bad")]
    assert has_failure(results) is True


def test_has_failure_false_when_no_fail():
    results = [CheckResult("a", "A", "technical", "PASS", "ok"), CheckResult("b", "B", "technical", "WARN", "meh")]
    assert has_failure(results) is False
