import importlib
import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from conftest import load_plugin_package

load_plugin_package()
assistant = importlib.import_module("hermes_genui.tools.assistant")
tools = importlib.import_module("hermes_genui.tools")
memory = importlib.import_module("hermes_genui.core.assistant.memory")

NOW = datetime(2026, 11, 13, 9, 30, tzinfo=ZoneInfo("Asia/Kolkata"))
CONFIG_YAML = """model: x
mcp_servers:
  swisseph:
    command: node
    enabled: true
  gmail-mcp:
    url: http://localhost:9000/mcp
  supabase:
    url: https://example
    enabled: false
other: 1
"""


def setup_home(tmp_path):
    home = tmp_path / "home"
    (home / "plugin-data" / "hermes-genui" / "blocks").mkdir(parents=True)
    (home / "config.yaml").write_text(CONFIG_YAML, encoding="utf-8")
    return home


def call(name, params, home, now=NOW):
    return assistant.run(name, params, home=home, now=now)


def test_tools_before_setup_say_so(tmp_path):
    home = setup_home(tmp_path)
    for name in ("assistant_inbox", "assistant_calendar", "assistant_items"):
        assert call(name, {"action": "show"}, home) == "The assistant isn't set up."


def test_show_lists_the_sources_it_can_see(tmp_path):
    home = setup_home(tmp_path)
    shown = call("assistant_setup", {"action": "show"}, home)
    assert "demo" in shown and "swisseph" in shown and "gmail-mcp" in shown and "supabase" not in shown
    assert "Google: not signed in" in shown
    (home / "google_token.json").write_text("{}", encoding="utf-8")
    assert "Google: signed in" in call("assistant_setup", {"action": "show"}, home)


def test_setting_up_the_demo_writes_config_and_monitor_and_gives_the_job_arguments(tmp_path):
    home = setup_home(tmp_path)
    reply = call("assistant_setup", {"action": "set", "source": "demo"}, home)
    config = memory.load_config(home / "plugin-data" / "hermes-genui" / "blocks")
    assert config["source"] == "demo" and config["setup_at"] == NOW.isoformat()
    assert (home / "scripts" / "hermes-genui-assistant.py").is_file()
    job = json.loads(reply[reply.index("{"):])
    assert job["action"] == "create" and job["schedule"] == "30m" and job["deliver"] == "local"
    assert job["enabled_toolsets"] == ["hermes_genui_assistant", "no_mcp"]
    assert job["monitor"] == "hermes-genui-assistant.py"
    assert job["skills"] == ["hermes-genui:assistant-check"] and job["name"] == "Personal assistant check"


def test_a_real_source_is_an_mcp_server_of_the_profile(tmp_path):
    home = setup_home(tmp_path)
    reply = call("assistant_setup", {"action": "set", "source": "gmail-mcp"}, home)
    config = memory.load_config(home / "plugin-data" / "hermes-genui" / "blocks")
    assert config["source"] == "gmail-mcp"
    assert not (home / "scripts").exists(), "no change detector: Gmail can't be checked without the model"
    job = json.loads(reply[reply.index("{"):])
    assert job["enabled_toolsets"] == ["hermes_genui_assistant", "gmail-mcp"] and "monitor" not in job
    assert job["schedule"] == "30m" and job["deliver"] == "local" and "gmail-mcp" in job["prompt"]


def test_an_unknown_or_disabled_server_is_refused(tmp_path):
    home = setup_home(tmp_path)
    for bad in ("nope", "supabase", ""):
        assert call("assistant_setup", {"action": "set", "source": bad}, home).startswith("Not set up"), bad
    assert memory.load_config(home / "plugin-data" / "hermes-genui" / "blocks") == {}


def test_with_a_real_source_the_demo_tools_point_to_it(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "gmail-mcp"}, home)
    assert "gmail-mcp" in call("assistant_inbox", {}, home)
    assert "gmail-mcp" in call("assistant_calendar", {}, home)


def test_a_report_can_carry_the_calendar(tmp_path):
    home = setup_home(tmp_path)
    blocks = home / "plugin-data" / "hermes-genui" / "blocks"
    call("assistant_setup", {"action": "set", "source": "gmail-mcp"}, home)
    events = [{"id": "e1", "title": "Dentist", "start": "2026-11-13T11:30:00+05:30", "end": "2026-11-13T12:00:00+05:30",
               "place": "Baner"}]
    reply = call("assistant_report", {"items": [], "summary": "quiet", "calendar": events}, home)
    assert reply.startswith("Recorded")
    assert memory.load_calendar(blocks) == events
    bad = call("assistant_report", {"items": [], "calendar": [{"title": "x"}]}, home)
    assert "Not recorded: calendar.0: needs a title and a start" in bad and memory.load_calendar(blocks) == events



def test_the_monitor_prints_only_the_act_and_ids_and_is_stable(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    script = home / "scripts" / "hermes-genui-assistant.py"
    runs = [subprocess.run([sys.executable, str(script)], capture_output=True, text=True, check=True).stdout
            for _ in range(2)]
    assert runs[0] == runs[1]
    lines = runs[0].splitlines()
    assert lines[0].startswith("act 1 since ") and lines[1].endswith(" mails") and "citylight-bill" in lines
    assert all(" " not in line for line in lines[2:]) and "$" not in runs[0] and "@" not in runs[0]
    call("assistant_setup", {"action": "next"}, home)
    after = subprocess.run([sys.executable, str(script)], capture_output=True, text=True, check=True).stdout
    assert after.splitlines()[0].startswith("act 2 since ")


def test_inbox_and_calendar_after_setup(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    mails = json.loads(call("assistant_inbox", {}, home))
    assert mails and all(len(m["text"]) <= assistant.MAIL_TEXT_MAX for m in mails)
    events = json.loads(call("assistant_calendar", {"days": 3}, home))
    assert events and all(e["start"] >= "2026-11-13" for e in events)


def test_report_then_items_show_and_update_without_mail_text(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    reply = call("assistant_report", {"items": [{"ref": "airtel-bill", "pile": "bills",
                                                 "title": "Airtel ₹1,178 due Tue 17 Nov", "due": "2026-11-17",
                                                 "suggestion": "Pay the Airtel bill"}], "summary": "1 bill"}, home)
    assert reply.startswith("Recorded: 1 new")
    shown = call("assistant_items", {"action": "show"}, home)
    assert "Bills · Airtel ₹1,178 due Tue 17 Nov · suggested" in shown and "account 0021" not in shown
    item_id = shown[shown.index("[") + 1:shown.index("]")]
    assert "done" in call("assistant_items", {"action": "update", "id": item_id, "status": "done"}, home)
    assert "No open items" in call("assistant_items", {"action": "show"}, home)


def test_clear_removes_memory_and_monitor_and_names_the_task(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    reply = call("assistant_setup", {"action": "clear"}, home)
    assert "Personal assistant check" in reply
    assert not (home / "scripts" / "hermes-genui-assistant.py").exists()
    assert memory.load_config(home / "plugin-data" / "hermes-genui" / "blocks") == {}


def test_check_tools_are_in_their_own_toolset():
    by_name = {t.name: t.toolset for t in tools.TOOLS}
    assert {by_name[n] for n in ("assistant_inbox", "assistant_calendar", "assistant_report")} == \
        {"hermes_genui_assistant"}
    assert by_name["assistant_setup"] == by_name["assistant_items"] == by_name["show_blocks"] == tools.TOOLSET


def test_a_moved_plugin_gets_its_monitor_rewritten(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    script = home / "scripts" / "hermes-genui-assistant.py"
    script.write_text('DEMO = "/old/place/demo.py"\n', encoding="utf-8")
    assert assistant.refresh_monitor(home) is True
    assert str(Path(assistant.demo.__file__).resolve()) in script.read_text(encoding="utf-8")
    other = tmp_path / "other"
    (other / "plugin-data" / "hermes-genui" / "blocks").mkdir(parents=True)
    assert assistant.refresh_monitor(other) is False and not (other / "scripts").exists()


def test_reading_the_inbox_notes_when(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    call("assistant_inbox", {}, home)
    assert memory.load_config(home / "plugin-data" / "hermes-genui" / "blocks")["inbox_read_at"] == NOW.isoformat()


def test_a_missing_check_job_comes_with_its_arguments(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "gmail-mcp"}, home)
    shown = call("assistant_setup", {"action": "show"}, home)
    assert "check isn't scheduled" in shown and '"action": "create"' in shown and "gmail-mcp" in shown
    assert "ask them" in shown and "until they say yes" in shown and "without asking" not in shown
    (home / "cron").mkdir()
    (home / "cron" / "jobs.json").write_text(json.dumps({"jobs": [{"name": "Personal assistant check"}]}),
                                             encoding="utf-8")
    assert "isn't scheduled" not in call("assistant_setup", {"action": "show"}, home)


def test_no_note_before_the_assistant_is_set_up(tmp_path):
    assert assistant.restore_note(setup_home(tmp_path)) == ""



def test_a_local_only_profile_gets_no_mail_check(tmp_path, monkeypatch):
    home = setup_home(tmp_path)
    monkeypatch.setattr(assistant, "_CONFIG", [{"local_only": True}.get])
    reply = call("assistant_setup", {"action": "set", "source": "gmail-mcp"}, home)
    assert reply.startswith("Not set up") and "local" in reply
    assert memory.load_config(home / "plugin-data" / "hermes-genui" / "blocks") == {}


def _private_names() -> list[str]:
    """Names that must never be published, one per line in tests/private-names.txt. That file is git-ignored: it lives
    only on the maintainer's machine, so this guard doesn't publish the names it guards. No file, nothing to check."""
    path = Path(__file__).resolve().parents[1] / "private-names.txt"
    if not path.is_file():
        return []
    lines = (line.strip() for line in path.read_text(encoding="utf-8").splitlines())
    return [line.lower() for line in lines if line and not line.startswith("#")]


def test_no_private_names_are_published():
    """Everything that goes to the repository is checked: the plugin, its tests, the web source and the docs."""
    names = _private_names()
    if not names:
        pytest.skip("no tests/private-names.txt on this machine")
    root = Path(__file__).resolve().parents[2]
    folders = ("tools", "core", "recipes", "dashboard", "hooks", "blocks", "templates", "tests", "web/src", ".github")
    files = [f for folder in folders for f in (root / folder).rglob("*")]
    files += [*root.glob("*.md"), root / "plugin.yaml"]
    for f in files:
        if f.is_file() and f.name != "private-names.txt" and f.suffix in (
                ".py", ".md", ".json", ".ts", ".tsx", ".css", ".txt", ".yaml", ".yml"):
            text = f.read_text(encoding="utf-8", errors="ignore").lower()
            for name in names:
                assert name not in text, f"{f.relative_to(root)} names a private name"


def test_assistant_open_lists_refs_and_state(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    assert call("assistant_open", {}, home) == "No open items."
    call("assistant_report", {"items": [
        {"ref": "cl-bill", "pile": "bills", "title": "City Light", "due": "2026-11-12", "amount": "$142.36",
         "taken": "Noted the due date"},
        {"ref": "tax", "pile": "bills", "title": "Q4 tax", "due": "2027-01-15"}]}, home)
    lines = call("assistant_open", {}, home).splitlines()
    assert lines[0] == "cl-bill · bills · City Light · Overdue · 1 day · $142.36 · last: Noted the due date"
    assert lines[1].startswith("tax · bills · Q4 tax · Due 15 Jan")


def test_assistant_open_marks_user_reopened(tmp_path):
    home = setup_home(tmp_path)
    blocks = home / "plugin-data" / "hermes-genui" / "blocks"
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    call("assistant_report", {"items": [{"ref": "xf", "pile": "bills", "title": "Xfinity", "due": "2026-11-19"}]}, home)
    call("assistant_report", {"items": [{"ref": "xf", "pile": "bills", "title": "x", "status": "done", "verb": "Paid",
                                         "why": "receipt", "evidence_ref": "xf-paid"}]}, home)
    memory.user_reopen(memory.load_items(blocks)[0]["id"], NOW, blocks)
    assert call("assistant_open", {}, home).endswith("· reopened by the user")


def test_assistant_open_is_in_the_check_toolset():
    spec = next(t for t in tools.TOOLS if t.name == "assistant_open")
    assert spec.toolset == assistant.CHECK_TOOLSET


def test_setup_next_and_reset(tmp_path):
    home = setup_home(tmp_path)
    blocks = home / "plugin-data" / "hermes-genui" / "blocks"
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    config = memory.load_config(blocks)
    assert config["demo_anchor"] == "2026-11-13" and config["demo_act"] == 1
    first = [m["id"] for m in json.loads(call("assistant_inbox", {}, home))]
    assert "xfinity-bill" in first and "xfinity-paid" not in first
    call("assistant_report", {"items": [], "summary": "first check"}, home)
    later = NOW.replace(hour=11)
    assert "Act 2" in call("assistant_setup", {"action": "next"}, home, later)
    assert memory.load_config(blocks)["demo_act"] == 2
    second = [m["id"] for m in json.loads(call("assistant_inbox", {}, home, later.replace(hour=12)))]
    assert second[0] == "xfinity-paid" and "xfinity-bill" not in second
    call("assistant_report", {"items": [{"ref": "x", "pile": "bills", "title": "X"}]}, home)
    assert "reset" in call("assistant_setup", {"action": "reset"}, home, NOW.replace(day=14)).lower()
    config = memory.load_config(blocks)
    assert (config["demo_anchor"], config["demo_act"], config["last_check"]) == ("2026-11-14", 1, None)
    assert memory.load_items(blocks) == []


def test_next_needs_the_demo(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "gmail-mcp"}, home)
    assert "sample" in call("assistant_setup", {"action": "next"}, home)


def test_switching_source_starts_clean(tmp_path):
    home = setup_home(tmp_path)
    blocks = home / "plugin-data" / "hermes-genui" / "blocks"
    call("assistant_setup", {"action": "set", "source": "gmail-mcp"}, home)
    call("assistant_report", {"items": [{"ref": "real-1", "pile": "bills", "title": "Real bill"}]}, home)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    assert memory.load_items(blocks) == [] and memory.load_config(blocks)["source"] == "demo"
    call("assistant_report", {"items": [{"ref": "x", "pile": "bills", "title": "Sample"}]}, home)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    assert [i["ref"] for i in memory.load_items(blocks)] == ["x"]  # same source again: kept


def test_a_reset_wakes_the_change_detector(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    script = home / "scripts" / "hermes-genui-assistant.py"
    def out():
        return subprocess.run([sys.executable, str(script)], capture_output=True, text=True, check=True).stdout
    before = out()
    call("assistant_setup", {"action": "reset"}, home, NOW.replace(minute=45))
    assert out() != before


def test_local_only_reads_the_plugin_setting_and_fails_closed(monkeypatch):
    for value, on in ((True, True), ("yes", True), ("1", True), (False, False), ("0", False), (None, False)):
        monkeypatch.setattr(assistant, "_CONFIG", [{"local_only": value}.get])
        assert assistant.local_only() is on, value

    def broken(key):
        raise OSError("config.yaml unreadable")
    monkeypatch.setattr(assistant, "_CONFIG", [broken])
    assert assistant.local_only() is True


def test_the_env_file_no_longer_switches_local_only(tmp_path):
    home = setup_home(tmp_path)
    (home / ".env").write_text("HERMES_GENUI_LOCAL_ONLY=1\n", encoding="utf-8")
    assert assistant.local_only() is False


def _jobs(home, *names):
    (home / "cron").mkdir(exist_ok=True)
    (home / "cron" / "jobs.json").write_text(json.dumps({"jobs": [{"id": f"j{i}", "name": n}
                                                                  for i, n in enumerate(names)]}), encoding="utf-8")


def test_both_jobs_missing_are_offered_back_together_after_asking(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "gmail-mcp", "ideas": True}, home)
    note = assistant.restore_note(home)
    assert "mail check and its ideas job aren't scheduled" in note and "until they say yes" in note
    assert '"name": "Personal assistant check"' in note and '"name": "Assistant ideas"' in note
    assert "don't run it" in note and '"clear"' in note


def test_a_missing_ideas_job_alone_asks_and_on_no_turns_ideas_off(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "gmail-mcp", "ideas": True}, home)
    _jobs(home, "Personal assistant check")
    note = assistant.restore_note(home)
    assert "ideas job isn't scheduled" in note and "until they say yes" in note
    assert '"name": "Assistant ideas"' in note and '"name": "Personal assistant check"' not in note
    assert 'action "ideas" and on false' in note and '"clear"' not in note
    _jobs(home, "Personal assistant check", "Assistant ideas")
    assert assistant.restore_note(home) == ""


def test_an_ideas_job_isnt_missed_when_ideas_are_off(tmp_path):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "gmail-mcp"}, home)
    _jobs(home, "Personal assistant check")
    assert assistant.restore_note(home) == ""


def test_a_local_only_profile_isnt_offered_its_real_mail_check_back(tmp_path, monkeypatch):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "gmail-mcp", "ideas": True}, home)
    monkeypatch.setattr(assistant, "_CONFIG", [{"local_only": True}.get])
    note = assistant.restore_note(home)
    assert "stays off" in note and "cronjob_manage" not in note


def test_switching_local_only_on_stops_a_real_mail_check_that_already_exists(tmp_path, monkeypatch):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "gmail-mcp"}, home)
    assert not call("assistant_open", {}, home).startswith("Stopped")
    monkeypatch.setattr(assistant, "_CONFIG", [{"local_only": True}.get])
    for tool in ("assistant_open", "assistant_inbox", "assistant_calendar", "assistant_report"):
        reply = call(tool, {}, home)
        assert reply.startswith("Stopped") and "Skipped: local-only" in reply, tool


def test_local_only_leaves_the_demo_mailbox_alone(tmp_path, monkeypatch):
    home = setup_home(tmp_path)
    call("assistant_setup", {"action": "set", "source": "demo"}, home)
    monkeypatch.setattr(assistant, "_CONFIG", [{"local_only": True}.get])
    assert not call("assistant_inbox", {}, home).startswith("Stopped")


def test_a_local_only_refusal_tells_the_model_to_leave_the_setting_alone(tmp_path, monkeypatch):
    home = setup_home(tmp_path)
    monkeypatch.setattr(assistant, "_CONFIG", [{"local_only": True}.get])
    reply = call("assistant_setup", {"action": "set", "source": "gmail-mcp"}, home)
    assert "only the user changes that setting" in reply and "don't change it or offer to" in reply
