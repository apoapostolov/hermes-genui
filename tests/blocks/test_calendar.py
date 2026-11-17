"""calendar: a day at a glance (a big date, its events, the week). Checked strictly; a dated list off Desktop."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
tf = importlib.import_module("hermes_genui.hooks.text_fallback")

DAY = {"type": "calendar", "date": "2026-11-14", "events": [
    {"title": "Ballard farmers market", "start": "09:00", "end": "10:00", "place": "Ballard Ave NW"},
    {"title": "Dinner with Emma", "start": "19:30", "place": "Canlis"}],
    "week": [{"date": "2026-11-14", "count": 2}, {"date": "2026-11-15", "count": 4}],
    "ask": "What's on my calendar today?"}


def test_a_good_day_passes():
    assert check_blocks([DAY]) == []
    assert check_blocks([{"type": "calendar", "date": "2026-11-14"}]) == []


def test_the_date_must_be_a_real_day():
    assert check_blocks([{"type": "calendar", "date": "14 Nov"}]) == ["0: calendar needs date as YYYY-MM-DD"]
    assert check_blocks([{"type": "calendar", "date": "2026-02-30"}]) == ["0: calendar needs date as YYYY-MM-DD"]


def test_events_need_a_title_and_a_start_and_are_capped():
    bad = {**DAY, "events": [{"title": "No start"}, {"start": "10:00"}]}
    assert check_blocks([bad]) == ["0.events.0: event needs a title and a start",
                                   "0.events.1: event needs a title and a start"]
    many = {**DAY, "events": [{"title": "E", "start": "09:00"}] * 13}
    assert check_blocks([many]) == ["0: calendar takes at most 12 events"]


def test_the_week_has_at_most_seven_real_days():
    assert check_blocks([{**DAY, "week": [{"date": "x", "count": 1}]}]) == ["0.week.0: day needs date as YYYY-MM-DD"]
    assert check_blocks([{**DAY, "week": [{"date": "2026-11-14"}] * 8}]) == ["0: week takes at most 7 days"]


def test_ask_cant_be_a_command():
    assert check_blocks([{**DAY, "ask": "/reset"}]) != []


def test_text_fallback_is_a_dated_list():
    assert tf.blocks_as_text([DAY]) == (
        "**Sat 14 Nov**\n- 09:00–10:00 Ballard farmers market · Ballard Ave NW\n- 19:30 Dinner with Emma · Canlis")
    assert tf.blocks_as_text([{"type": "calendar", "date": "2026-11-14"}]) == "**Sat 14 Nov**\n- Nothing planned"
