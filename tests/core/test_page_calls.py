"""Recorded calls: the tool calls a kept page replays on every refresh."""

import importlib
from datetime import datetime
from zoneinfo import ZoneInfo

from conftest import load_plugin_package

load_plugin_package()
calls = importlib.import_module("hermes_genui.core.pages.calls")

NOW = datetime(2026, 11, 15, 9, 12, tzinfo=ZoneInfo("Asia/Kolkata"))
GOOD = {"id": "sev", "tool": "mcp__mocksecops__cindral_list_findings", "args": {"limit": 50},
        "feeds": "Findings by severity donut"}


def test_a_read_call_on_the_pages_server_passes():
    assert calls.check_calls([GOOD], ["mocksecops"]) == []
    assert calls.tool_server("mcp__mocksecops__cindral_list_findings") == "mocksecops"
    assert calls.tool_server("show_blocks") is None


def test_calls_that_change_things_are_refused():
    for tool in ("mcp__gmail__gmail_send_draft", "mcp__gmail__calendar_update_event", "mcp__gmail__gmail_trash",
                 "mcp__gmail__gmail_create_draft", "mcp__gmail__gmail_label"):
        problems = calls.check_calls([{**GOOD, "tool": tool}], ["gmail"])
        assert problems and "changes things" in problems[0], tool


def test_only_the_pages_servers():
    assert "isn't one of this page's servers" in calls.check_calls([GOOD], ["mockcrm"])[0]
    assert calls.check_calls([{**GOOD, "tool": "terminal"}], ["mocksecops"]) != []


def test_shape_and_count():
    assert calls.check_calls([{**GOOD, "args": "limit=5"}], ["mocksecops"]) != []
    assert calls.check_calls([{**GOOD, "id": ""}], ["mocksecops"]) != []
    assert calls.check_calls([GOOD, GOOD], ["mocksecops"]) == ["calls.1: ids must be unique"]
    many = [{**GOOD, "id": f"c{i}"} for i in range(calls.MAX_CALLS + 1)]
    assert calls.check_calls(many, ["mocksecops"]) == [f"calls: at most {calls.MAX_CALLS}"]


def test_dates_are_filled_at_each_refresh():
    args = {"after": "{today-7}", "query": "after:{today} -category:promotions", "n": 3,
            "nested": {"since": "{now}"}, "list": ["{today}"]}
    assert calls.fill_dates(args, NOW) == {"after": "2026-11-08", "query": "after:2026-11-15 -category:promotions",
                                           "n": 3, "nested": {"since": NOW.isoformat()}, "list": ["2026-11-15"]}


def test_write_tools_are_refused_however_they_are_named():
    for tool in ("mcp__x__sendEmail", "mcp__x__close_incident", "mcp__x__isolate_host", "mcp__x__add_comment",
                 "mcp__x__acknowledge_alert", "mcp__x__send__now", "mcp__mockcrm__corvane_update_stage"):
        server = calls.tool_server(tool)
        assert calls.check_calls([{**GOOD, "tool": tool}], [server]), tool


def test_read_verbs_win_over_nouns_that_sound_like_writes():
    for tool in ("mcp__gmail__gmail_get_draft", "mcp__x__get_post", "mcp__gmail__gmail_list_labels"):
        assert calls.check_calls([{**GOOD, "tool": tool}], [calls.tool_server(tool)]) == [], tool


def test_a_tool_hermes_marks_read_only_passes():
    tool = "mcp__gmail__gmail_send_status"  # a write word, but the server says it only reads
    assert calls.check_calls([{**GOOD, "tool": tool}], ["gmail"], read_only=lambda t: t == tool) == []


def test_sql_must_be_one_select():
    sql = "mcp__mockwarehouse__warehouse_run_sql"
    ok = {**GOOD, "tool": sql, "args": {"sql": "WITH a AS (SELECT 1) SELECT * FROM a"}}
    assert calls.check_calls([ok], ["mockwarehouse"]) == []
    for bad in ("INSERT INTO t VALUES (1)", "SELECT 1; DROP TABLE t", "select * from t; delete from t",
                "PRAGMA writable_schema=1", "SELECT * FROM t WHERE x IN (SELECT y FROM u) ; UPDATE t SET x=1"):
        assert calls.check_calls([{**ok, "args": {"sql": bad}}], ["mockwarehouse"]), bad
    cvql = {**GOOD, "tool": "mcp__mockcrm__corvane_query", "args": {"query": "SELECT Name FROM Account LIMIT 5"}}
    assert calls.check_calls([cvql], ["mockcrm"]) == []
    search = {**GOOD, "tool": "mcp__gmail__gmail_search", "args": {"query": "after:{today-1} is:unread"}}
    assert calls.check_calls([search], ["gmail"]) == []


def test_feeds_is_short_text():
    problems = calls.check_calls([{**GOOD, "feeds": "x" * 300}], ["mocksecops"])
    assert problems == ["calls.0: feeds is up to 200 characters"]
