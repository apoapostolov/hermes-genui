"""Refresh: a page's Refresh starts its job once, and the page knows when that refresh is running, done or stuck."""

import importlib
import subprocess
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from conftest import load_plugin_package

load_plugin_package()
refresh = importlib.import_module("hermes_genui.core.pages.refresh")

NOW = datetime(2026, 11, 15, 9, 12, tzinfo=ZoneInfo("Asia/Kolkata"))


def page(**over):
    return {"slug": "executive", "title": "Executive", "job_id": "abc123",
            "snapshot": {"at": (NOW - timedelta(hours=1)).isoformat(), "slots": {}},
            "refresh": {"requested_at": None, "error": None}, **over}


def test_a_quiet_page_shows_its_last_snapshot_time():
    assert refresh.status(page(), NOW) == {"at": (NOW - timedelta(hours=1)).isoformat(), "refreshing": False,
                                           "error": None}


def test_refresh_starts_the_job_once():
    runs, p = [], page()
    first = refresh.start(p, NOW, runs.append)
    second = refresh.start(p, NOW + timedelta(seconds=5), runs.append)
    assert runs == ["abc123"]
    assert first["refreshing"] and second["refreshing"]
    assert p["refresh"]["requested_at"] == NOW.isoformat()


def test_a_new_snapshot_ends_refreshing():
    p = page()
    refresh.start(p, NOW, lambda job: None)
    p["snapshot"] = {"at": (NOW + timedelta(minutes=2)).isoformat(), "slots": {}}
    assert refresh.status(p, NOW + timedelta(minutes=3))["refreshing"] is False


def test_a_refresh_that_never_finishes_times_out():
    p = page()
    refresh.start(p, NOW, lambda job: None)
    later = refresh.status(p, NOW + timedelta(minutes=16))
    assert later["refreshing"] is False and later["error"] == "The last refresh didn't finish."
    runs = []
    refresh.start(p, NOW + timedelta(minutes=16), runs.append)  # and it can be started again
    assert runs == ["abc123"]


def test_a_page_without_a_job_says_so():
    out = refresh.start(page(job_id=None), NOW, lambda job: None)
    assert out["error"] == "This page has no refresh job; ask Hermes to redesign it." and not out["refreshing"]


def test_a_job_that_wont_start_reports_why():
    def boom(job):
        raise subprocess.CalledProcessError(1, ["hermes"], stderr=b"Permission denied\nmore")

    out = refresh.start(page(), NOW, boom)
    assert out["error"].startswith("Couldn't start the refresh") and not out["refreshing"]


def test_a_reported_failure_shows_with_the_old_time():
    p = page(refresh={"requested_at": NOW.isoformat(), "error": "mockcrm timed out"})
    assert refresh.status(p, NOW + timedelta(minutes=1)) == {
        "at": (NOW - timedelta(hours=1)).isoformat(), "refreshing": False, "error": "mockcrm timed out"}


def test_start_marks_the_refresh_before_running_the_job():
    saved = []
    p = page()
    refresh.start(p, NOW, lambda job: saved.append(dict(p["refresh"])), save=lambda pg: None)
    assert saved == [{"requested_at": NOW.isoformat(), "error": None}]


def test_a_job_that_ends_without_saving_says_so():
    p = page()
    refresh.start(p, NOW, lambda job: None)
    assert refresh.finish(p, NOW.isoformat(), 0, "") is True
    assert refresh.status(p, NOW + timedelta(minutes=1))["error"] == "The refresh ended without saving a snapshot."


def test_a_job_that_fails_later_shows_its_last_line():
    p = page()
    refresh.start(p, NOW, lambda job: None)
    refresh.finish(p, NOW.isoformat(), 1, "working\nError: rate limited by provider\n")
    error = refresh.status(p, NOW + timedelta(minutes=1))["error"]
    assert error == "The refresh failed: Error: rate limited by provider"


def test_a_job_that_saved_is_left_alone():
    p = page()
    refresh.start(p, NOW, lambda job: None)
    p["snapshot"] = {"at": (NOW + timedelta(minutes=1)).isoformat(), "slots": {}}
    assert refresh.finish(p, NOW.isoformat(), 0, "") is False
    assert refresh.status(p, NOW + timedelta(minutes=2))["error"] is None


def test_a_finish_for_an_older_refresh_changes_nothing():
    p = page()
    refresh.start(p, NOW, lambda job: None)
    assert refresh.finish(p, (NOW - timedelta(minutes=5)).isoformat(), 1, "boom") is False


def test_a_removed_job_says_so_in_plain_words():
    def gone(job):
        raise subprocess.CalledProcessError(1, ["hermes"], output=b"Failed to run job: Job not found: abc123\n")

    assert refresh.start(page(), NOW, gone)["error"] == refresh.NO_JOB
    p = page()
    refresh.start(p, NOW, lambda job: None)
    refresh.finish(p, NOW.isoformat(), 1, "Failed to run job: Job not found: abc123")
    assert refresh.status(p, NOW)["error"] == refresh.NO_JOB
