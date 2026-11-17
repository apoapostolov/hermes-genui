import importlib
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from conftest import load_plugin_package

load_plugin_package()
demo = importlib.import_module("hermes_genui.core.assistant.demo")

IST = ZoneInfo("Asia/Kolkata")
FRI_0900 = datetime(2026, 11, 13, 9, 0, tzinfo=IST)  # Friday 13 Nov 2026


ANCHOR = FRI_0900.date()
NEXT_AT = FRI_0900.replace(hour=10)


def test_the_seed_is_well_formed():
    seed = demo.load_seed()
    keys = [m["key"] for m in seed["mail"]] + [e["key"] for e in seed["events"] + seed["story"]]
    assert len(keys) == len(set(keys))
    for m in seed["mail"]:
        assert m["act"] in (1, 2) and m["from"] and m["subject"] and m["text"]
        if m["act"] == 1:
            datetime.strptime(m["time"], "%H:%M")
            assert -7 <= m["day"] <= 0
        else:
            assert m["after"] > 0
    for e in seed["events"]:
        assert 0 <= e["weekday"] <= 6 and e["title"]
        assert datetime.strptime(e["start"], "%H:%M") < datetime.strptime(e["end"], "%H:%M")


def test_act_one_then_two():
    first = demo.inbox(FRI_0900, None, ANCHOR, 1)
    ids = [m["id"] for m in first]
    assert "xfinity-bill" in ids and "xfinity-paid" not in ids
    assert all(datetime.fromisoformat(m["received"]) <= FRI_0900 for m in first)
    assert [m["received"] for m in first] == sorted(m["received"] for m in first)
    assert set(first[0]) == {"id", "from", "subject", "received", "text"}
    later = NEXT_AT + timedelta(seconds=20)
    second = demo.inbox(later, FRI_0900, ANCHOR, 2, NEXT_AT)
    assert [m["id"] for m in second] == ["xfinity-paid", "dol-renewed", "amazon-delivered", "citylight-late",
                                         "xfinity-offer"]
    assert second[0]["received"] == (NEXT_AT + timedelta(seconds=2)).isoformat()  # in the inbox at once


def test_ids_stable_across_days():
    a = {m["id"] for m in demo.inbox(FRI_0900, None, ANCHOR, 1)}
    b = {m["id"] for m in demo.inbox(FRI_0900 + timedelta(days=1), None, ANCHOR, 1)}
    assert a == b and all(not i[-8:].isdigit() for i in a)


def test_tokens_relative_to_the_mail_day_and_anchor():
    mails = {m["id"]: m for m in demo.inbox(FRI_0900, None, ANCHOR, 1)}
    assert "Thu 12 Nov" in mails["citylight-bill"]["text"]  # 5 days before Friday, due 4 days after: yesterday
    assert "Mon 16 Nov" in mails["xfinity-bill"]["text"]
    assert demo.render("Due {d+3}, paid {d-1}", ANCHOR) == "Due Mon 16 Nov, paid Thu 12 Nov"


def test_since_is_exclusive_so_a_mail_is_never_read_twice():
    first = demo.inbox(FRI_0900, None, ANCHOR, 1)
    again = demo.inbox(FRI_0900, datetime.fromisoformat(first[-1]["received"]), ANCHOR, 1)
    assert all(m["id"] != first[-1]["id"] for m in again)


def test_calendar_has_routine_and_story_events():
    events = demo.calendar(FRI_0900, 14, ANCHOR)
    starts = [datetime.fromisoformat(e["start"]) for e in events]
    assert starts == sorted(starts) and starts[0].date() == ANCHOR
    titles = {e["title"] for e in events}
    assert {"Anna's birthday", "Thanksgiving dinner, Olivia home", "Delta 1287 SEA → AUS"} <= titles
    anna = next(e for e in events if e["title"] == "Anna's birthday")
    assert anna["start"][:10] == (ANCHOR + timedelta(days=9)).isoformat() and anna["id"] == "annas-birthday"
    assert set(events[0]) == {"id", "title", "start", "end", "place"}


def test_calendar_defaults_to_a_week():
    assert max(datetime.fromisoformat(e["start"]).date() for e in demo.calendar(FRI_0900)) <= \
        ANCHOR + timedelta(days=6)


def test_no_glibc_only_date_directive_is_used():
    assert "%-" not in (demo.SEED.parent / "demo.py").read_text(encoding="utf-8")


def test_every_day_of_the_week_is_busy():
    events = demo.load_seed()["events"]
    for weekday in range(7):
        assert sum(1 for e in events if e["weekday"] == weekday) >= 3, weekday


def test_the_demo_is_american():
    text = demo.SEED.read_text(encoding="utf-8")
    assert "₹" not in text and "$" in text
    assert "Xfinity" in text and "citylight.example" in text
