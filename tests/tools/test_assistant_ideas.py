import importlib
import json
from datetime import datetime
from zoneinfo import ZoneInfo

from conftest import load_plugin_package

load_plugin_package()
ideas = importlib.import_module("hermes_genui.tools.assistant_ideas")
assistant = importlib.import_module("hermes_genui.tools.assistant")
tools = importlib.import_module("hermes_genui.tools")
memory = importlib.import_module("hermes_genui.core.assistant.memory")
store = importlib.import_module("hermes_genui.core.store")

NOW = datetime(2026, 11, 16, 9, 30, tzinfo=ZoneInfo("America/Los_Angeles"))
BILL = {"ref": "cl", "pile": "bills", "title": "City Light $142.36", "due": "2026-11-15",
        "from": "Seattle City Light <billing@citylight.example>", "facts": ["Account ending 4417"],
        "detail": "secret mail detail", "prep": {"kind": "pay", "words": "Seattle City Light"}}
BDAY = {"ref": "anna", "pile": "personal", "title": "Anna's birthday",
        "prep": {"kind": "gift", "words": "birthday cake, Seattle"}}
PHOTOS = [{"url": f"https://upload.wikimedia.org/{n}.jpg", "caption": f"Cake {n}", "source": "Wikimedia Commons"}
          for n in range(6)]


def setup(tmp_path):
    home = tmp_path / "home"
    blocks = home / "plugin-data" / "hermes-genui" / "blocks"
    blocks.mkdir(parents=True)
    (home / "config.yaml").write_text("x: 1\n", encoding="utf-8")
    memory.save_config({"source": "demo", "setup_at": NOW.isoformat(), "ideas": True}, blocks)
    memory.apply_report({"items": [BILL, BDAY]}, NOW, blocks)
    return home, blocks


def call(params, home, find=lambda q, n: PHOTOS[:n]):
    return ideas.run(params, home=home, now=NOW, find=find)


def item_id(blocks, ref):
    return next(i["id"] for i in memory.load_items(blocks) if i["ref"] == ref)


def test_list_has_no_mail_text(tmp_path):
    home, blocks = setup(tmp_path)
    listed = json.loads(call({"action": "list"}, home))
    assert {(i["kind"], i["words"]) for i in listed} == {("pay", "Seattle City Light"),
                                                        ("gift", "birthday cake, Seattle")}
    pay = next(i for i in listed if i["kind"] == "pay")
    assert pay["site"] == "citylight.example" and set(pay) == {"id", "title", "kind", "words", "site"}
    assert "secret" not in json.dumps(listed) and "4417" not in json.dumps(listed)


def test_photos_are_noted_for_the_photo_rule(tmp_path):
    home, blocks = setup(tmp_path)
    found = json.loads(call({"action": "photos", "query": "birthday cake"}, home))
    assert [p["url"] for p in found] == [p["url"] for p in PHOTOS[:6]]
    assert PHOTOS[0]["url"] in store.known_photo_urls(blocks)


def test_record_rejects_unknown_photo(tmp_path):
    home, blocks = setup(tmp_path)
    call({"action": "photos", "query": "cake"}, home)
    reply = call({"action": "record", "id": item_id(blocks, "anna"), "ideas": [
        {"title": "Cake", "photo": PHOTOS[0]["url"]}, {"title": "Made up", "photo": "https://evil.example/x.jpg"}]},
        home)
    assert "1 idea" in reply and "evil.example" in reply
    item = next(i for i in memory.load_items(blocks) if i["ref"] == "anna")
    assert [i["title"] for i in item["ideas"]] == ["Cake"]


def test_record_rejects_lookalike_pay_link(tmp_path):
    home, blocks = setup(tmp_path)
    for url in ("https://citylight.example.evil.example/pay", "https://citylight-billing.example/pay",
                "http://citylight.example/pay"):
        reply = call({"action": "record", "id": item_id(blocks, "cl"), "pay_link": url}, home)
        assert "not the sender's site" in reply
    assert "pay_link" not in next(i for i in memory.load_items(blocks) if i["ref"] == "cl")


def test_record_keeps_matching_pay_link(tmp_path):
    home, blocks = setup(tmp_path)
    reply = call({"action": "record", "id": item_id(blocks, "cl"), "pay_link": "https://www.citylight.example/pay"},
                 home)
    assert "pay link kept" in reply
    item = next(i for i in memory.load_items(blocks) if i["ref"] == "cl")
    assert item["pay_link"] == "https://www.citylight.example/pay" and item["prep"]["done_at"]


def test_record_unknown_item(tmp_path):
    home, _ = setup(tmp_path)
    assert "No item" in call({"action": "record", "id": "nope"}, home)


def test_ideas_tool_in_its_own_toolset():
    spec = next(t for t in tools.TOOLS if t.name == "assistant_ideas")
    assert spec.toolset == "hermes_genui_ideas"


def test_ideas_job_has_no_mail_tools():
    job = assistant.ideas_job_arguments()
    assert job["name"] == "Assistant ideas" and job["schedule"] == "365d"
    assert job["enabled_toolsets"] == ["hermes_genui_ideas", "web", "no_mcp"]
    assert job["skills"] == ["hermes-genui:assistant-ideas"]


def test_setup_with_ideas_gives_both_jobs_and_local_only_refuses(tmp_path):
    home = tmp_path / "home"
    (home / "plugin-data" / "hermes-genui" / "blocks").mkdir(parents=True)
    (home / "config.yaml").write_text("x: 1\n", encoding="utf-8")
    reply = assistant.run("assistant_setup", {"action": "set", "source": "demo", "ideas": True}, home=home, now=NOW)
    assert "Assistant ideas" in reply
    assert memory.load_config(home / "plugin-data" / "hermes-genui" / "blocks")["ideas"] is True
    (home / ".env").write_text("HERMES_GENUI_LOCAL_ONLY=1\n", encoding="utf-8")
    off = assistant.run("assistant_setup", {"action": "ideas", "on": True}, home=home, now=NOW)
    assert "local" in off and memory.load_config(home / "plugin-data" / "hermes-genui" / "blocks")["ideas"] is False


def test_report_starts_ideas_job(tmp_path, monkeypatch):
    home, blocks = setup(tmp_path)
    (home / "cron").mkdir()
    (home / "cron" / "jobs.json").write_text(json.dumps({"jobs": [{"id": "j1", "name": "Assistant ideas"}]}))
    started = []
    monkeypatch.setattr(assistant, "LAUNCH", lambda h, job_id: started.append((h, job_id)))
    assistant.run("assistant_report", {"items": [{**BDAY, "ref": "olivia", "prep": {"kind": "recipes",
                                                                                     "words": "Thanksgiving dinner"}}]},
                  home=home, now=NOW)
    assert started == [(home, "j1")]
    memory.save_config({**memory.load_config(blocks), "ideas": False}, blocks)
    assistant.run("assistant_report", {"items": []}, home=home, now=NOW)
    assert len(started) == 1


def test_show_offers_ideas_when_off(tmp_path):
    home, blocks = setup(tmp_path)
    memory.save_config({**memory.load_config(blocks), "ideas": False}, blocks)
    shown = assistant.run("assistant_setup", {"action": "show"}, home=home, now=NOW)
    assert "Prepared ideas: off" in shown and '"ideas"' in shown
    memory.save_config({**memory.load_config(blocks), "ideas": True}, blocks)
    assert "Prepared ideas: on" in assistant.run("assistant_setup", {"action": "show"}, home=home, now=NOW)


def test_ideas_recipe_never_reads_mail():
    from pathlib import Path
    text = (Path(__file__).resolve().parents[2] / "recipes" / "assistant-ideas" / "SKILL.md").read_text("utf-8")
    steps = text.split("## Steps", 1)[1]
    assert steps.index('"action": "list"') < steps.index('"action": "photos"') < steps.index('"action": "record"')
    assert "web_search" in text and "gmail" not in text.lower() and "assistant_inbox" not in text


def test_record_stores_the_rebuilt_link_and_refuses_tricks(tmp_path):
    home, blocks = setup(tmp_path)
    assert "not the sender's site" in call({"action": "record", "id": item_id(blocks, "cl"),
                                            "pay_link": "https://evil.example\\@citylight.example/pay"}, home)
    call({"action": "record", "id": item_id(blocks, "cl"), "pay_link": " https://www.citylight.example/pay "}, home)
    assert next(i for i in memory.load_items(blocks) if i["ref"] == "cl")["pay_link"] == \
        "https://www.citylight.example/pay"


def test_a_failed_launch_is_retried_later(tmp_path, monkeypatch):
    home, blocks = setup(tmp_path)
    (home / "cron").mkdir()
    (home / "cron" / "jobs.json").write_text(json.dumps({"jobs": [{"id": "j1", "name": "Assistant ideas"}]}))
    started = []
    monkeypatch.setattr(assistant, "LAUNCH", lambda h, job_id: started.append(job_id))
    assistant.run("assistant_report", {"items": []}, home=home, now=NOW)  # items still waiting, never launched
    assert started == ["j1"]
    assistant.run("assistant_report", {"items": []}, home=home, now=NOW)  # launched a moment ago: not again
    assert started == ["j1"]
    later = NOW.replace(hour=NOW.hour + 7)
    assistant.run("assistant_report", {"items": []}, home=home, now=later)
    assert started == ["j1", "j1"]


def test_cron_run_finds_hermes(tmp_path, monkeypatch):
    seen = []
    monkeypatch.setattr(assistant.shutil, "which", lambda name: "/opt/bin/hermes")
    monkeypatch.setattr(assistant.subprocess, "Popen", lambda cmd, **kw: seen.append(cmd))
    assistant._cron_run(tmp_path / "profiles" / "genui-test", "j1")
    assert seen == [["/opt/bin/hermes", "-p", "genui-test", "cron", "run", "j1"]]


def test_demo_calendar_reaches_two_weeks(tmp_path):
    home, _ = setup(tmp_path)
    events = json.loads(assistant.run("assistant_calendar", {}, home=home, now=NOW))
    assert any(e["title"] == "Anna's birthday" for e in events)
