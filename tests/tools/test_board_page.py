"""board_page: keep a chat dashboard in the sidebar, save its refreshes, and hand back what its job needs."""

import importlib
import json
from datetime import datetime
from zoneinfo import ZoneInfo

from conftest import load_plugin_package

load_plugin_package()
board_page = importlib.import_module("hermes_genui.tools.board_page")
pages = importlib.import_module("hermes_genui.core.pages.store")
blocks_store = importlib.import_module("hermes_genui.core.store")
tools = importlib.import_module("hermes_genui.tools")
assistant = importlib.import_module("hermes_genui.tools.assistant")

NOW = datetime(2026, 11, 15, 9, 12, tzinfo=ZoneInfo("Asia/Kolkata"))
CONFIG = "mcp_servers:\n  mockcrm:\n    command: x\n  mocksecops:\n    command: x\n  off:\n    enabled: false\n"
LIST = {"type": "list", "items": [{"title": "134 open criticals"}]}
NUMS = {"type": "kpis", "items": [{"label": "Critical findings", "value": 134}]}
KEEP = {"type": "actions", "items": [{"label": "Patch plan", "run": "About my Security dashboard: patch plan?"},
                                     {"label": "Keep in sidebar", "run": board_page.KEEP_RUN}]}


def tabs(*labels):
    return {"type": "tabs", "tabs": [{"label": label, "children": [NUMS]} for label in labels]}


DESIGN = [{"type": "heading", "text": "Security posture"}, LIST, tabs("Overview", "Exposure"), KEEP]


def home_at(tmp_path, name="genui-test"):
    home = tmp_path / "profiles" / name
    (home / "plugin-data" / "hermes-genui" / "blocks").mkdir(parents=True)
    (home / "config.yaml").write_text(CONFIG, encoding="utf-8")
    return home


def root(home):
    return home / "plugin-data" / "hermes-genui" / "blocks"


def call(params, home, now=NOW):
    return board_page.apply(params, home=home, now=now)


def keep(home, **over):
    board_id = blocks_store.save(DESIGN, root=root(home))
    return call({"action": "keep", "title": "Security", "servers": ["mocksecops"], "board_id": board_id, **over}, home)


def test_the_tool_is_registered():
    assert "board_page" in [t.name for t in tools.TOOLS]


def test_briefs_list_what_each_covers_and_the_servers(tmp_path):
    out = call({"action": "briefs"}, home_at(tmp_path))
    assert "security-posture" in out and "open findings by severity" in out
    assert "MCP servers: mockcrm, mocksecops" in out


def test_keep_copies_the_chat_board_without_its_keep_button(tmp_path):
    home = home_at(tmp_path)
    out = keep(home)
    page = pages.load("security", root(home))
    kept = page["snapshot"]["blocks"]
    assert kept[:3] == DESIGN[:3]
    assert kept[3] == {"type": "actions", "items": [KEEP["items"][0]]}
    assert page["servers"] == ["mocksecops"] and page["kind"] == "dashboard" and page["job_id"] is None
    assert '"schedule": "365d"' in out and '"skills": ["hermes-genui:page-refresh"]' in out
    assert '"enabled_toolsets": ["hermes_genui", "mocksecops"]' in out and "attach_job" in out


def test_a_keep_button_on_its_own_goes_with_its_block(tmp_path):
    home = home_at(tmp_path)
    alone = {"type": "actions", "items": [{"label": "Keep in sidebar", "run": board_page.KEEP_RUN}]}
    call({"action": "keep", "title": "Security", "servers": ["mocksecops"], "blocks": [LIST, alone]}, home)
    assert pages.load("security", root(home))["snapshot"]["blocks"] == [LIST]


def test_keep_refuses_an_unknown_board(tmp_path):
    home = home_at(tmp_path)
    for bad in ("0badc0de", "../x", ""):
        out = call({"action": "keep", "title": "Security", "servers": ["mocksecops"], "board_id": bad}, home)
        assert out.startswith("Not saved"), bad
    assert pages.list_pages(root(home)) == []


def test_keep_refuses_unknown_servers_and_a_local_only_profile(tmp_path, monkeypatch):
    assert keep(home_at(tmp_path), servers=["nope"]).startswith("Not saved")
    private = home_at(tmp_path, "client-work")
    monkeypatch.setattr(assistant, "_CONFIG", [{"local_only": True}.get])
    assert keep(private).startswith("Not saved") and pages.list_pages(root(private)) == []
    monkeypatch.setattr(assistant, "_CONFIG", [{}.get])
    named = home_at(tmp_path, "private-accounts")  # a profile's name alone never decides
    assert keep(named).startswith("Kept")


def test_today_is_reserved_for_todays_work_sections(tmp_path):
    home = home_at(tmp_path)
    assert keep(home, title="Today").startswith("Not saved")
    out = call({"action": "keep", "title": "Today", "kind": "today", "servers": ["mocksecops"], "blocks": [NUMS]},
               home)
    assert not out.startswith("Not saved"), out
    assert pages.load("today", root(home))["kind"] == "today"


def test_keeping_again_keeps_the_job(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    call({"action": "attach_job", "slug": "security", "job_id": "abc123"}, home)
    out = keep(home, notes="focus on Lakeside")
    page = pages.load("security", root(home))
    assert page["job_id"] == "abc123" and page["notes"] == "focus on Lakeside" and "cronjob_manage" not in out


def test_a_title_clash_is_refused(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    assert keep(home, title="SECURITY!").startswith("Not saved")


def test_save_replaces_the_blocks_and_keeps_the_previous(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    _refreshing(home)
    fresh = [DESIGN[0], LIST, tabs("Overview", "Exposure")]
    assert call({"action": "save", "slug": "security", "blocks": fresh}, home, now=NOW.replace(hour=10)).startswith(
        "Saved")
    page = pages.load("security", root(home))
    assert page["snapshot"] == {"at": NOW.replace(hour=10).isoformat(), "blocks": fresh}
    assert page["previous"]["blocks"][0] == DESIGN[0]
    assert page["refresh"] == {"requested_at": None, "error": None}


def test_a_refresh_must_keep_the_tabs(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    _refreshing(home)
    out = call({"action": "save", "slug": "security", "blocks": [LIST, tabs("Overview", "Risk")]}, home)
    assert out.startswith("Not saved") and "Overview, Exposure" in out
    assert pages.load("security", root(home))["snapshot"]["blocks"][0] == DESIGN[0]
    out = call({"action": "save", "slug": "security", "blocks": [LIST, tabs("Overview", "Risk")], "redesign": True},
               home)
    assert out.startswith("Saved")


def test_save_rejects_broken_blocks_and_keeps_the_old_snapshot(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    _refreshing(home)
    for bad in ([], [{"type": "list"}], "x"):
        assert call({"action": "save", "slug": "security", "blocks": bad}, home).startswith("Not saved"), bad
    assert pages.load("security", root(home))["snapshot"]["blocks"][0] == DESIGN[0]


def test_show_list_fail_and_remove(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    call({"action": "attach_job", "slug": "security", "job_id": "abc123"}, home)
    shown = json.loads(call({"action": "show", "slug": "security"}, home))
    assert "previous" not in shown and shown["snapshot"]["blocks"][0] == DESIGN[0]
    assert "security" in call({"action": "list"}, home)
    call({"action": "fail", "slug": "security", "reason": "mocksecops timed out"}, home)
    assert pages.load("security", root(home))["refresh"]["error"] == "mocksecops timed out"
    out = call({"action": "remove", "slug": "security"}, home)
    assert "abc123" in out and pages.load("security", root(home)) is None
    assert call({"action": "show", "slug": "nope"}, home).startswith("No page")


def test_todays_work_must_draw_inside_one_section(tmp_path):
    home = home_at(tmp_path)
    nested = [{"type": "section", "title": "Criticals", "children": [NUMS]}]
    out = call({"action": "keep", "title": "Today", "kind": "today", "servers": ["mocksecops"], "blocks": nested},
               home)
    assert out.startswith("Not saved") and "section" in out
    assert pages.load("today", root(home)) is None


def test_a_kept_page_gets_the_same_guards_as_a_chat_board(tmp_path):
    home = home_at(tmp_path)
    photo = [LIST, {"type": "image", "url": "https://evil.example/x.jpg?d=secret"}]
    assert keep(home, board_id=None, blocks=photo).startswith("Not saved")
    keep(home)
    _refreshing(home)
    for bad in (photo, [LIST, {"type": "include", "id": "7f3a09bc"}],
                [{"type": "text", "text": "x" * 1000}] * 400):
        out = call({"action": "save", "slug": "security", "blocks": bad, "redesign": True}, home)
        assert out.startswith("Not saved"), bad[1] if len(bad) > 1 else "big"
    assert pages.load("security", root(home))["snapshot"]["blocks"][0] == DESIGN[0]


def test_keeping_with_new_servers_updates_the_job(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    call({"action": "attach_job", "slug": "security", "job_id": "abc123"}, home)
    out = keep(home, servers=["mocksecops", "mockcrm"])
    assert '"action": "update"' in out and '"job_id": "abc123"' in out
    assert '"enabled_toolsets": ["hermes_genui", "mocksecops", "mockcrm"]' in out


def test_a_refresh_keeps_every_part_of_the_design(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    _refreshing(home)
    weaker = [DESIGN[0], {"type": "callout", "tone": "info", "text": "No data"}, tabs("Overview", "Exposure")]
    out = call({"action": "save", "slug": "security", "blocks": weaker}, home)
    assert out.startswith("Not saved") and "list" in out
    fresh = [DESIGN[0], LIST, tabs("Overview", "Exposure"),
             {"type": "actions", "items": [{"label": "New q", "run": "About my Security dashboard: q"}]}]
    assert call({"action": "save", "slug": "security", "blocks": fresh}, home).startswith("Saved")


def test_a_design_without_tabs_is_kept_too(tmp_path):
    home = home_at(tmp_path)
    call({"action": "keep", "title": "Flat", "servers": ["mocksecops"], "blocks": [NUMS, LIST]}, home)
    _refreshing(home, "flat")
    out = call({"action": "save", "slug": "flat", "blocks": [{"type": "callout", "tone": "info", "text": "x"}]}, home)
    assert out.startswith("Not saved")


CALLS = [{"id": "sev", "tool": "mcp__mocksecops__cindral_list_findings", "args": {"limit": 50, "since": "{today-7}"},
          "feeds": "Critical findings KPI"},
         {"id": "inc", "tool": "mcp__mocksecops__nyxor_incidents", "args": {}, "feeds": "Overview tab"}]


def test_keep_records_the_calls(tmp_path):
    home = home_at(tmp_path)
    keep(home, calls=CALLS)
    assert pages.load("security", root(home))["calls"] == CALLS


def test_keep_refuses_a_call_that_changes_things(tmp_path):
    home = home_at(tmp_path)
    bad = [{"id": "x", "tool": "mcp__mocksecops__delete_finding", "args": {}, "feeds": "x"}]
    assert keep(home, calls=bad).startswith("Not saved")
    assert pages.load("security", root(home)) is None


def test_fetch_replays_the_calls_with_todays_dates(tmp_path):
    home = home_at(tmp_path)
    keep(home, calls=CALLS)
    made = []

    def dispatch(tool, args):
        made.append((tool, args))
        return '{"count": 134}'

    out = json.loads(board_page.apply({"action": "fetch", "slug": "security"}, home=home, now=NOW, dispatch=dispatch))
    assert made == [("mcp__mocksecops__cindral_list_findings", {"limit": 50, "since": "2026-11-08"}),
                    ("mcp__mocksecops__nyxor_incidents", {})]
    assert out["results"] == {"sev": '{"count": 134}', "inc": '{"count": 134}'} and out["errors"] == {}
    assert "untrusted" in out["note"]


def test_one_failing_call_doesnt_stop_the_others(tmp_path):
    home = home_at(tmp_path)
    keep(home, calls=CALLS)

    def dispatch(tool, args):
        if "incidents" in tool:
            raise RuntimeError("server timed out")
        return "x" * (board_page.RESULT_MAX + 50)

    out = json.loads(board_page.apply({"action": "fetch", "slug": "security"}, home=home, now=NOW, dispatch=dispatch))
    assert out["errors"] == {"inc": "RuntimeError: server timed out"}
    cut = out["results"]["sev"]
    assert len(cut) < board_page.RESULT_MAX + 200 and "don't count rows from this result" in cut
    assert f"{board_page.RESULT_MAX + 50:,}" in cut


def test_fetch_without_calls_says_to_refresh_the_old_way(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    out = board_page.apply({"action": "fetch", "slug": "security"}, home=home, now=NOW, dispatch=lambda t, a: "")
    assert "no recorded calls" in out


def _refreshing(home, slug="security"):
    page = pages.load(slug, root(home))
    page["refresh"] = {"requested_at": NOW.isoformat(), "error": None}
    pages.save(page, root(home))


def test_save_only_during_a_refresh(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    fresh = [DESIGN[0], LIST, tabs("Overview", "Exposure")]
    out = call({"action": "save", "slug": "security", "blocks": fresh}, home)
    assert out.startswith("Not saved") and "save comes after fetch" in out
    _refreshing(home)
    assert call({"action": "save", "slug": "security", "blocks": fresh}, home).startswith("Saved")


def test_a_redesign_the_user_asked_for_saves_any_time(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    out = call({"action": "save", "slug": "security", "blocks": [LIST, tabs("A", "B")], "redesign": True}, home)
    assert out.startswith("Saved")


def test_an_error_from_hermes_is_an_error_not_data(tmp_path):
    home = home_at(tmp_path)
    keep(home, calls=CALLS)

    def dispatch(tool, args):
        if "incidents" in tool:
            return '{"error": "Unknown tool: mcp__mocksecops__nyxor_incidents"}'
        return {"count": 134}

    out = json.loads(board_page.apply({"action": "fetch", "slug": "security"}, home=home, now=NOW, dispatch=dispatch))
    assert out["errors"] == {"inc": "Unknown tool: mcp__mocksecops__nyxor_incidents"}
    assert out["results"]["sev"] == '{"count": 134}'


def test_fetch_opens_the_refresh_so_its_save_counts(tmp_path):
    home = home_at(tmp_path)
    keep(home, calls=CALLS)
    board_page.apply({"action": "fetch", "slug": "security"}, home=home, now=NOW, dispatch=lambda t, a: "{}")
    fresh = [DESIGN[0], LIST, tabs("Overview", "Exposure")]
    assert call({"action": "save", "slug": "security", "blocks": fresh}, home).startswith("Saved")


def test_the_refusal_doesnt_advertise_a_redesign(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    out = call({"action": "save", "slug": "security", "blocks": [LIST]}, home)
    assert out.startswith("Not saved") and "redesign" not in out and "fetch" in out


def test_all_results_share_one_budget_with_the_note_first(tmp_path):
    home = home_at(tmp_path)
    many = [{"id": f"c{i}", "tool": "mcp__mocksecops__cindral_list_findings", "args": {}, "feeds": f"part {i}"}
            for i in range(6)]
    keep(home, calls=many)
    sizes = {"c0": 80000, "c1": 80000, "c2": 500, "c3": 500, "c4": 500, "c5": 500}

    def dispatch(tool, args):
        dispatch.n += 1
        return "y" * list(sizes.values())[dispatch.n - 1]
    dispatch.n = 0
    text = board_page.apply({"action": "fetch", "slug": "security"}, home=home, now=NOW, dispatch=dispatch)
    assert len(text) <= board_page.TOTAL_MAX + 5000
    out = json.loads(text)
    assert list(out)[0] == "note" and all(len(out["results"][k]) == 500 for k in ("c2", "c3", "c4", "c5"))
    assert "cut at" in out["results"]["c0"] and "cut at" in out["results"]["c1"]


def _jobs(home, schedule):
    (home / "cron").mkdir(exist_ok=True)
    (home / "cron" / "jobs.json").write_text(json.dumps({"jobs": [{"id": "abc123", "name": "Page refresh: Security",
                                                                   "schedule": schedule}]}), encoding="utf-8")


def test_an_unasked_schedule_is_put_back_only_if_the_user_agrees(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    _jobs(home, {"kind": "cron", "expr": "0 8 * * *", "display": "every day at 8am"})
    out = call({"action": "attach_job", "slug": "security", "job_id": "abc123"}, home)
    assert "every day at 8am" in out and '"action": "update"' in out and '"schedule": "365d"' in out
    assert "Ask them" in out and "change nothing until they answer" in out and "user_schedule true" in out
    assert "without asking" not in out
    assert pages.load("security", root(home)).get("schedule") is None


def test_a_schedule_the_user_asked_for_is_kept_and_shown(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    _jobs(home, {"kind": "cron", "expr": "0 8 * * *", "display": "every day at 8am"})
    out = call({"action": "attach_job", "slug": "security", "job_id": "abc123", "user_schedule": True}, home)
    assert '"action": "update"' not in out
    assert pages.load("security", root(home))["schedule"] == "every day at 8am"


def test_the_refresh_only_schedule_needs_nothing(tmp_path):
    home = home_at(tmp_path)
    keep(home)
    _jobs(home, {"kind": "interval", "minutes": 525600, "display": "every 525600m"})
    out = call({"action": "attach_job", "slug": "security", "job_id": "abc123"}, home)
    assert '"action": "update"' not in out and pages.load("security", root(home)).get("schedule") is None


def test_keep_says_not_to_change_the_schedule(tmp_path):
    assert "don't change the schedule" in keep(home_at(tmp_path))
