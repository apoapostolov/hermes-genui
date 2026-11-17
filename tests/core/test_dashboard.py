import importlib
import json
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
spec = importlib.import_module("hermes_genui.core.dashboard.spec")
assemble = importlib.import_module("hermes_genui.core.dashboard.assemble")
sources = assemble._sources()  # the copy assembly runs (loaded by path, as the dashboard API does)
memory = importlib.import_module("hermes_genui.core.assistant.memory")

NOW = datetime(2026, 11, 14, 9, 30, tzinfo=ZoneInfo("America/Los_Angeles"))  # a Saturday


@pytest.fixture
def ctx(tmp_path):
    home = tmp_path / "home"
    blocks = home / "plugin-data" / "hermes-genui" / "blocks"
    blocks.mkdir(parents=True)
    memory.save_config({"source": "demo", "setup_at": NOW.isoformat(), "last_check": None}, blocks)
    memory.apply_report({"items": [
        {"ref": "xfinity-bill-20261114", "pile": "bills", "title": "Xfinity $89.98 due Wed 18 Nov", "due": "2026-11-18",
         "amount": "$89.98", "suggestion": "Pay the Xfinity bill of $89.98"},
        {"ref": "pge-bill-20261114", "pile": "bills", "title": "PG&E $142.36", "due": "2026-11-20",
         "amount": "$142.36"},
        {"ref": "amazon-placed-20261114", "pile": "orders", "title": "Sony headphones", "detail": "Arriving Sun"},
        {"ref": "emma-saturday-20261114", "pile": "replies", "title": "Emma asks about Saturday",
         "suggestion": "Reply to Emma: yes to 7:30"},
        {"ref": "old", "pile": "bills", "title": "Old bill", "status": "done", "taken": "Closed: paid"},
    ], "summary": ""}, NOW, blocks)
    return sources.Context(now=NOW, home=home, blocks_root=blocks, client=None)


ALL = ["calendar.today", "calendar.upnext", "assistant.summary", "assistant.open", "assistant.suggestions",
       "assistant.bills", "assistant.orders", "assistant.replies", "assistant.done", "tasks"]


@pytest.mark.parametrize("name", ALL)
def test_every_source_and_view_gives_valid_blocks(ctx, name):
    for view in sources.views_for(name):
        blocks = assemble.section_blocks({"from": name, "as": view}, ctx)
        assert blocks and check_blocks(blocks) == [], (name, view, blocks)


def test_calendar_today_is_the_new_calendar_block_with_a_busy_day(ctx):
    [block] = assemble.section_blocks({"from": "calendar.today"}, ctx)
    assert block["type"] == "calendar" and block["date"] == "2026-11-14"
    assert len(block["events"]) >= 3 and len(block["week"]) == 7


def test_upnext_mixes_bills_and_notable_events(ctx):
    [block] = assemble.section_blocks({"from": "calendar.upnext"}, ctx)
    kinds = {i["kind"] for i in block["items"]}
    assert block["type"] == "upnext" and "bill" in kinds and len(block["items"]) <= 12
    assert all(i["date"] >= "2026-11-14" for i in block["items"])


def test_open_items_as_a_checklist_carry_their_ids(ctx):
    [block] = assemble.section_blocks({"from": "assistant.open", "as": "checklist"}, ctx)
    ids = {i["id"] for i in memory.load_items(ctx.blocks_root) if i["status"] == "suggested"}
    assert {i["id"] for i in block["items"]} == ids


def test_summary_counts_and_sums_dollars(ctx):
    [block] = assemble.section_blocks({"from": "assistant.summary"}, ctx)
    values = {i["label"]: i["value"] for i in block["items"]}
    assert values["Needs you"] == 4 and values["Bills due"] == 232.34 and values["Arriving"] == 1


def test_an_empty_pile_and_a_failing_source_become_callouts(ctx, monkeypatch):
    [empty] = assemble.section_blocks({"from": "assistant.alerts"}, ctx)
    assert empty["type"] == "callout" and "Nothing" in empty["text"]

    def boom(*args):
        raise RuntimeError("down")

    monkeypatch.setitem(sources.SOURCES, "assistant.bills", sources.SOURCES["assistant.bills"]._replace(make=boom))
    [warn] = assemble.section_blocks({"from": "assistant.bills"}, ctx)
    assert warn == {"type": "callout", "tone": "warn", "text": "Couldn't load Bills just now."}


def test_without_the_assistant_its_sources_say_how_to_start(tmp_path):
    home = tmp_path / "home"
    blocks = home / "plugin-data" / "hermes-genui" / "blocks"
    blocks.mkdir(parents=True)
    bare = sources.Context(now=NOW, home=home, blocks_root=blocks, client=None)
    [note] = assemble.section_blocks({"from": "calendar.today"}, bare)
    assert note["type"] == "callout" and "personal dashboard" in note["text"]


def test_a_whole_spec_assembles_with_titles_and_tabs(ctx):
    board = assemble.assemble({"title": "Today", "sections": [
        {"from": "calendar.today"},
        {"from": "assistant.summary", "title": "At a glance"},
        {"tabs": [{"label": "Needs you", "sections": [{"from": "assistant.open", "as": "checklist"}]},
                  {"label": "Bills", "sections": [{"from": "assistant.bills", "as": "table"}]}]}]}, ctx)
    types = [b["type"] for b in board["blocks"]]
    assert types == ["calendar", "heading", "kpis", "tabs"]
    assert board["title"] == "Today" and board["live"] is False
    assert check_blocks(board["blocks"]) == []


def test_tabs_show_how_many_open_items_they_hold(ctx):
    # an item in two of a tab's sections (open and suggested) counts once
    board = assemble.assemble({"sections": [{"tabs": [
        {"label": "Needs you", "sections": [{"from": "assistant.open", "as": "checklist"},
                                            {"from": "assistant.suggestions"}]},
        {"label": "Bills", "sections": [{"from": "assistant.bills"}]},
        {"label": "Money", "sections": [{"from": "assistant.bills"}, {"from": "assistant.orders"}]},
        {"label": "Alerts", "sections": [{"from": "assistant.alerts"}]},
        {"label": "Done", "sections": [{"from": "assistant.done"}]},
        {"label": "Mac", "sections": [{"from": "tasks"}]}]}]}, ctx)
    tabs = board["blocks"][0]["tabs"]
    assert [t.get("badge") for t in tabs] == [4, 2, 3, None, None, None]
    assert check_blocks(board["blocks"]) == []


def test_tabs_have_no_badges_before_the_assistant_is_set_up(tmp_path):
    bare = sources.Context(now=NOW, home=tmp_path, blocks_root=tmp_path / "blocks", client=None)
    board = assemble.assemble({"sections": [{"tabs": [
        {"label": "Needs you", "sections": [{"from": "assistant.open"}]},
        {"label": "Bills", "sections": [{"from": "assistant.bills"}]}]}]}, bare)
    assert [t.get("badge") for t in board["blocks"][0]["tabs"]] == [None, None]


def test_specs_are_checked_against_the_sources(ctx):
    assert spec.check_spec({"sections": [{"from": "assistant.bills", "as": "table"}]}) == []
    unknown = spec.check_spec({"sections": [{"from": "mail.inbox"}]})
    assert unknown[0].startswith("sections.0: unknown source 'mail.inbox'")
    assert spec.check_spec({"sections": [{"from": "assistant.summary", "as": "chart"}]}) == [
        "sections.0: assistant.summary shows as kpis"]
    assert spec.check_spec({"sections": [{"tabs": [{"label": "One", "sections": [{"from": "tasks"}]}]}]}) == [
        "sections.0: tabs need 2-6 tabs"]
    assert spec.check_spec({"sections": []}) == ["sections: 1-20 sections"]
    assert spec.check_spec({"sections": [{"from": "weather.Seattle"}, {"from": "stock.NVDA", "as": "chart"}]}) == []


def test_old_and_unknown_keys_are_ignored(tmp_path):
    root = tmp_path / "blocks"
    spec.save_spec({"title": "Today", "sections": [{"from": "tasks", "colour": "red"}], "page": [1]}, root)
    assert spec.load_spec(root)["sections"] == [{"from": "tasks", "colour": "red"}]
    (tmp_path / "dashboard.json").write_text("{broken", encoding="utf-8")
    assert spec.load_spec(root) is None


def test_one_bad_item_doesnt_take_down_its_section(ctx):
    memory.apply_report({"items": [{"ref": "bad-due", "pile": "bills", "title": "Mystery bill", "due": "Friday",
                                    "amount": "$10"}], "summary": ""}, NOW, ctx.blocks_root)
    bills = memory.load_items(ctx.blocks_root)
    assert next(i for i in bills if i["ref"] == "bad-due").get("due") is None  # dropped when recorded
    bills[0]["due"] = "Friday"  # and a hand-damaged file is survived too
    (memory.assistant_dir(ctx.blocks_root) / "items.json").write_text(json.dumps(bills), encoding="utf-8")
    for name, view in (("calendar.upnext", None), ("assistant.bills", "table")):
        blocks = assemble.section_blocks({"from": name, **({"as": view} if view else {})}, ctx, check=check_blocks)
        assert blocks[0]["type"] != "callout", (name, blocks)


def test_a_suggestion_that_looks_like_a_command_is_left_off_not_fatal(ctx):
    memory.apply_report({"items": [{"ref": "sneaky", "pile": "replies", "title": "Odd mail", "due": "2026-11-16",
                                    "suggestion": "/reset everything"}], "summary": ""}, NOW, ctx.blocks_root)
    for name in ("calendar.upnext", "assistant.suggestions", "assistant.open"):
        blocks = assemble.section_blocks({"from": name, "as": "list"} if name == "assistant.open" else {"from": name},
                                         ctx, check=check_blocks)
        assert blocks[0]["type"] != "callout" and "/reset" not in json.dumps(blocks), name


PUNE_PLACE = {"city": "Pune", "lat": 18.52, "lon": 73.86, "tz": "Asia/Kolkata"}


def test_weather_shows_as_a_strip_by_default(ctx, monkeypatch):
    monkeypatch.setattr(sources, "_get", lambda *a, **k: {"temp": 17.4, "code": 3, "high": 30.2, "low": 16.0,
                                                          "rain": 5})
    blocks = assemble.section_blocks({"from": "weather.Pune", "place": PUNE_PLACE}, ctx)
    assert blocks == [{"type": "weather", "temp": 17, "place": "Pune", "condition": "Cloudy", "high": 30, "low": 16}]
    assert check_blocks(blocks) == []
    kpis = assemble.section_blocks({"from": "weather.Pune", "as": "kpis", "place": PUNE_PLACE}, ctx)
    assert kpis[0]["type"] == "kpis"


def test_the_greeting_follows_the_time_of_day(ctx):
    spec_ = {"title": "Today", "greeting": True, "name": "Sagar", "sections": [{"from": "calendar.today"}]}
    assert assemble.assemble(spec_, ctx)["greeting"] == "Good morning, Sagar."
    afternoon = ctx._replace(now=NOW.replace(hour=14))
    evening = ctx._replace(now=NOW.replace(hour=19))
    assert assemble.assemble(spec_, afternoon)["greeting"] == "Good afternoon, Sagar."
    assert assemble.assemble(spec_, evening)["greeting"] == "Good evening, Sagar."
    assert assemble.assemble({**spec_, "name": None}, ctx)["greeting"] == "Good morning."
    assert assemble.assemble({"sections": [{"from": "calendar.today"}]}, ctx)["greeting"] is None


def test_a_spec_may_carry_a_greeting_and_a_name():
    sections = [{"from": "calendar.today"}]
    assert spec.check_spec({"greeting": True, "name": "Sagar", "sections": sections}) == []
    assert spec.check_spec({"greeting": "yes", "sections": sections}) == ["greeting: true or false"]
    assert spec.check_spec({"name": "x" * 41, "sections": sections}) == ["name: plain text up to 40 characters"]


def _today_page(blocks_root, snapshot=True):
    pages_store = importlib.import_module("hermes_genui.core.pages.store")
    snap = {"at": "2026-11-14T09:12:00-08:00", "blocks": [
        {"type": "kpis", "items": [{"label": "Open criticals", "value": 14}]}]} if snapshot else None
    pages_store.save({"slug": "today", "title": "Today", "kind": "today", "servers": ["mocksecops"], "notes": "",
                      "job_id": "j1", "snapshot": snap, "previous": None,
                      "refresh": {"requested_at": None, "error": None}}, blocks_root)


def test_todays_work_sections_come_from_the_today_page(ctx):
    _today_page(ctx.blocks_root)
    assert spec.check_spec({"sections": [{"from": "page.today"}]}) == []
    blocks = assemble.section_blocks({"from": "page.today"}, ctx)
    assert blocks == [{"type": "section", "title": "Work · 09:12", "children": [
        {"type": "kpis", "items": [{"label": "Open criticals", "value": 14}]}]}]
    board = assemble.assemble({"sections": [{"from": "page.today"}]}, ctx)
    assert board["snapshots"] == {"at": "2026-11-14T09:12:00-08:00", "refreshing": False, "error": None}
    assert "snapshots" not in assemble.assemble({"sections": [{"from": "calendar.today"}]}, ctx)


def test_work_not_filled_yet_says_so(ctx):
    _today_page(ctx.blocks_root, snapshot=False)
    blocks = assemble.section_blocks({"from": "page.today"}, ctx)
    assert blocks[0]["type"] == "callout" and "Not filled yet" in blocks[0]["text"]


def test_older_work_shows_its_day(ctx):
    _today_page(ctx.blocks_root)
    later = ctx._replace(now=NOW.replace(day=16))
    assert assemble.section_blocks({"from": "page.today"}, later)[0]["title"] == "Work · Sat 14 Nov 09:12"


def test_a_slot_style_work_section_asks_for_a_redesign(ctx):
    _today_page(ctx.blocks_root)
    blocks = assemble.section_blocks({"from": "page.today.criticals"}, ctx)
    assert blocks[0]["type"] == "callout" and "design your Today page again" in blocks[0]["text"]



def test_with_a_real_source_today_draws_the_saved_calendar(tmp_path):
    home = tmp_path / "home"
    blocks = home / "plugin-data" / "hermes-genui" / "blocks"
    blocks.mkdir(parents=True)
    memory.save_config({"source": "gmail", "setup_at": NOW.isoformat(), "last_check": None}, blocks)
    memory.save_calendar([
        {"id": "a", "title": "Dentist", "start": "2026-11-14T11:30:00-08:00", "end": "2026-11-14T12:00:00-08:00",
         "place": "Baner"},
        {"id": "b", "title": "Flight to Austin", "start": "2026-11-17T08:00:00-08:00",
         "end": "2026-11-17T11:00:00-08:00", "place": ""}], blocks)
    real = sources.Context(now=NOW, home=home, blocks_root=blocks, client=None)
    cal = assemble.section_blocks({"from": "calendar.today"}, real)[0]
    assert [e["title"] for e in cal["events"]] == ["Dentist"]
    up = assemble.section_blocks({"from": "calendar.upnext"}, real)[0]
    assert "Flight to Austin" in [i["title"] for i in up["items"]]


MON = datetime(2026, 11, 16, 9, 0, tzinfo=ZoneInfo("America/Los_Angeles"))


@pytest.fixture
def tracked(tmp_path):
    home = tmp_path / "home2"
    blocks = home / "plugin-data" / "hermes-genui" / "blocks"
    blocks.mkdir(parents=True)
    memory.save_config({"source": "demo", "setup_at": MON.isoformat(), "last_check": None,
                        "demo_anchor": "2026-11-16", "demo_act": 1}, blocks)
    memory.apply_report({"items": [
        {"ref": "cl", "pile": "bills", "title": "Seattle City Light", "due": "2026-11-15", "amount": "$142.36",
         "from": "Seattle City Light <billing@citylight.example>", "received": "2026-11-11T08:15:00-08:00",
         "facts": ["Amount $142.36", "Account ending 4417"], "suggestion": "Help me pay City Light",
         "taken": "Noted the due date", "prep": {"kind": "pay", "words": "Seattle City Light"}},
        {"ref": "xf", "pile": "bills", "title": "Xfinity", "due": "2026-11-19", "amount": "$89.98",
         "from": "Xfinity <online.communications@xfinity.example>", "suggestion": "Help me pay Xfinity"},
        {"ref": "dol", "pile": "renewals", "title": "Driver's licence", "due": "2026-11-19",
         "from": "WA DOL <no-reply@dol.wa.example>", "suggestion": "Help me renew"},
        {"ref": "phones", "pile": "orders", "title": "Sony headphones", "due": "2026-11-16",
         "detail": "Arriving today · code 4821 for the driver", "taken": "Started following the order"},
        {"ref": "ship", "pile": "orders", "title": "Target pickup", "due": "2026-11-18", "taken": "Following"},
        {"ref": "fake", "pile": "alerts", "title": "Fake City Light mail", "flag": "fake",
         "suggestion": "Why does it look fake?"},
        {"ref": "anna", "pile": "personal", "title": "Anna's birthday", "due": "2026-11-25",
         "prep": {"kind": "gift", "words": "birthday cake"}},
        {"ref": "past", "pile": "events", "title": "Old dinner", "due": "2026-11-10"},
    ]}, MON, blocks)
    items = {i["ref"]: i for i in memory.load_items(blocks)}
    memory.set_prep_result(items["cl"]["id"], [], "https://www.citylight.example/pay", MON, blocks)
    memory.set_prep_result(items["anna"]["id"], [
        {"title": "Chocolate cake", "note": "Fremont bakery", "photo": "https://upload.wikimedia.org/a.jpg"},
        {"title": "Peonies", "photo": "https://upload.wikimedia.org/b.jpg"}], None, MON, blocks)
    memory.apply_report({"items": [{"ref": "xf", "pile": "bills", "title": "Xfinity", "status": "done",
                                    "verb": "Paid", "why": "confirmation mail 16 Nov", "evidence_ref": "xf-paid"}]},
                        MON, blocks)
    return sources.Context(now=MON, home=home, blocks_root=blocks, client=None)


def test_assistant_today_columns(tracked):
    [cols] = assemble.section_blocks({"from": "assistant.today"}, tracked)
    assert cols["type"] == "columns" and check_blocks([cols], page=True) == []
    tracker, prepared = cols["children"]
    need = [c["id"] for c in tracker["need"]]
    titles = [c["title"] for c in tracker["need"]]
    assert titles[:2] == ["Seattle City Light", "Fake City Light mail"] and "Old dinner" not in titles
    assert "Sony headphones" in titles and "Target pickup" not in titles
    city = tracker["need"][0]
    assert (city["state"], city["stateText"], city["help"]) == ("overdue", "Overdue · 1 day", "Help me pay City Light")
    assert city["link"] == {"label": "Pay on citylight.example", "url": "https://www.citylight.example/pay"}
    assert city["details"]["about"] == ["Amount $142.36", "Account ending 4417"]
    assert city["details"]["from"] == "Seattle City Light <billing@citylight.example>"
    assert city["details"]["received"] == "Wed 11 Nov, 8:15 AM"
    assert city["details"]["trail"][0] == "Noticed Mon 16 Nov" and "Overdue · 1 day" in city["details"]["trail"]
    rows = {r["title"]: r for r in tracker["handled"]}
    assert rows["Xfinity"]["verb"] == "Paid" and rows["Xfinity"]["reopen"] is True
    assert rows["Fake City Light mail"]["kind"] == "protected" and rows["Target pickup"]["kind"] == "tracking"
    assert len(need) == len(set(need))
    assert prepared["groups"][0]["title"] == "Anna's birthday" and len(prepared["groups"][0]["ideas"]) == 2
    assert prepared["groups"][0]["ask"]["label"] == "Help me pick a gift"


def test_tracker_card_link_only_when_same_site(tracked):
    items = memory.load_items(tracked.blocks_root)
    dol = next(i for i in items if i["ref"] == "dol")
    memory.set_prep_result(dol["id"], [], None, MON, tracked.blocks_root)
    [cols] = assemble.section_blocks({"from": "assistant.today"}, tracked)
    card = next(c for c in cols["children"][0]["need"] if c["title"] == "Driver's licence")
    assert "link" not in card
    raw = memory.load_items(tracked.blocks_root)
    for i in raw:
        if i["ref"] == "dol":
            i["pay_link"] = "https://dol.wa.example.evil.example/renew"
    memory._write(memory.assistant_dir(tracked.blocks_root) / "items.json", raw)
    [cols] = assemble.section_blocks({"from": "assistant.today"}, tracked)
    card = next(c for c in cols["children"][0]["need"] if c["title"] == "Driver's licence")
    assert "link" not in card
    for i in raw:
        if i["ref"] == "dol":
            i["pay_link"] = "https://www.dol.wa.example/renew"
    memory._write(memory.assistant_dir(tracked.blocks_root) / "items.json", raw)
    [cols] = assemble.section_blocks({"from": "assistant.today"}, tracked)
    card = next(c for c in cols["children"][0]["need"] if c["title"] == "Driver's licence")
    assert card["link"]["label"] == "Renew on dol.wa.example"


def test_briefing_counts_without_weather(tracked):
    [block] = assemble.section_blocks({"from": "today.briefing.Seattle"}, tracked)
    assert block["type"] == "briefing" and check_blocks([block], page=True) == []
    assert block["counts"]["overdue"] == 1 and block["counts"]["handled"] >= 3  # the fake mail is not a late bill
    assert block["date"] == "Monday 16 November" and "temp" not in block


def test_briefing_with_weather(tracked, monkeypatch):
    monkeypatch.setattr(sources, "_get", lambda key, interval, fetch, deadline=3.0: {
        "temp": 9.2, "code": 61, "high": 11.4, "low": 6.0, "rain": 80})
    section = {"from": "today.briefing.Seattle", "place": {"city": "Seattle", "lat": 47.6, "lon": -122.3,
                                                          "tz": "America/Los_Angeles"}}
    [block] = assemble.section_blocks(section, tracked)
    assert (block["temp"], block["sky"], block["place"], block["high"], block["low"]) == (9, "rain", "Seattle", 11, 6)
    assert block["condition"]


def test_today_greeting_goes_into_the_briefing(tracked):
    board = assemble.assemble({"title": "Today", "greeting": True, "name": "Sam",
                               "sections": [{"from": "today.briefing.Seattle"}]}, tracked)
    assert board["blocks"][0]["greeting"] == "Good morning, Sam."


def test_upnext_overdue_first_with_states_and_compact(tracked):
    [block] = assemble.section_blocks({"from": "calendar.upnext", "compact": True}, tracked)
    assert block["compact"] is True and check_blocks([block]) == []
    first = block["items"][0]
    assert (first["title"], first["state"], first["stateText"]) == ("Seattle City Light", "overdue", "Overdue · 1 day")
    assert "Old dinner" not in [i["title"] for i in block["items"]]
    assert "Anna's birthday" in [i["title"] for i in block["items"]]


def test_piles_render_as_lists(tracked):
    blocks = assemble.section_blocks({"from": "assistant.bills", "as": "table"}, tracked)
    assert blocks[0]["type"] == "list"


def test_demo_calendar_uses_the_anchor(tracked):
    memory.save_config({**memory.load_config(tracked.blocks_root), "demo_anchor": "2026-11-14"}, tracked.blocks_root)
    events = sources._calendar(tracked, 14)
    anna = next(e for e in events if e["title"] == "Anna's birthday")
    assert anna["start"][:10] == "2026-11-23"


def test_assistant_today_can_leave_out_ideas(tracked):
    [tracker] = assemble.section_blocks({"from": "assistant.today", "ideas": False}, tracked)
    assert tracker["type"] == "tracker"


def test_fake_card_has_no_link_and_only_the_why_button(tracked):
    raw = memory.load_items(tracked.blocks_root)
    for i in raw:
        if i["ref"] == "fake":
            i.update(pay_link="https://citylight-billing.example/pay", suggestion="Pay now",
                     **{"from": "x <a@citylight-billing.example>"})
    memory._write(memory.assistant_dir(tracked.blocks_root) / "items.json", raw)
    [cols] = assemble.section_blocks({"from": "assistant.today"}, tracked)
    card = next(c for c in cols["children"][0]["need"] if c["title"] == "Fake City Light mail")
    assert "link" not in card and card["help"] == "Why does it look fake?"


def test_link_is_rebuilt_from_its_parts(tracked):
    raw = memory.load_items(tracked.blocks_root)
    for i in raw:
        if i["ref"] == "cl":
            i["pay_link"] = "https://evil.example\\@citylight.example/pay"
    memory._write(memory.assistant_dir(tracked.blocks_root) / "items.json", raw)
    [cols] = assemble.section_blocks({"from": "assistant.today"}, tracked)
    assert "link" not in cols["children"][0]["need"][0]
