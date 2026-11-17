"""upnext: a row of cards for what's coming (date, illustration by kind, title, time or amount). A list off Desktop."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
tf = importlib.import_module("hermes_genui.hooks.text_fallback")

ROW = {"type": "upnext", "items": [
    {"date": "2026-11-17", "title": "Emma's birthday", "kind": "birthday", "time": "08:00", "source": "mail"},
    {"date": "2026-11-18", "title": "Xfinity bill", "kind": "bill", "amount": "$89.98", "source": "mail"},
    {"date": "2026-11-24", "title": "Flight to Austin", "kind": "travel", "time": "07:15"}]}


def test_a_good_row_passes():
    assert check_blocks([ROW]) == []


def test_it_needs_1_to_12_items_with_a_date_and_a_title():
    assert check_blocks([{"type": "upnext", "items": []}]) == ["0: upnext needs 1-12 items"]
    many = {"type": "upnext", "items": [{"title": "x", "date": "x"}] * 13}
    assert check_blocks([many]) == ["0: upnext needs 1-12 items"]
    assert check_blocks([{"type": "upnext", "items": [{"title": "No date"}]}]) == [
        "0.items.0: item needs a date (YYYY-MM-DD) and a title"]


def test_ask_cant_be_a_command():
    assert check_blocks([{"type": "upnext", "items": [{**ROW["items"][0], "ask": "/reset"}]}]) != []


def test_text_fallback_lists_them():
    assert tf.blocks_as_text([ROW]) == (
        "**Up next**\n- Tue 17 Nov · Emma's birthday · 08:00\n- Wed 18 Nov · Xfinity bill · $89.98\n"
        "- Tue 24 Nov · Flight to Austin · 07:15")


def test_state_must_be_known():
    item = {**ROW["items"][1], "state": "overdue", "stateText": "Overdue · 1 day"}
    assert check_blocks([{"type": "upnext", "items": [item]}]) == []
    assert check_blocks([{"type": "upnext", "items": [{**item, "state": "panic"}]}]) == [
        "0.items.0.state: overdue, today or soon"]


def test_text_fallback_says_the_state():
    item = {**ROW["items"][1], "state": "overdue", "stateText": "Overdue · 1 day"}
    assert tf.blocks_as_text([{"type": "upnext", "items": [item]}]) == (
        "**Up next**\n- Wed 18 Nov · Xfinity bill · $89.98 · Overdue · 1 day")
