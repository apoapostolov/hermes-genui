"""Today's page-only blocks: briefing (the sky band), tracker (Needs you / Handled) and prepared (ideas). Drawn on the
Today page only: the model's catalog doesn't offer them, so a reply that uses one is refused."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
blocks = importlib.import_module("hermes_genui.blocks")
tf = importlib.import_module("hermes_genui.hooks.text_fallback")

BRIEFING = {"type": "briefing", "greeting": "Good morning, Sam.", "date": "Monday 16 November", "place": "Seattle",
            "temp": 9, "condition": "Light rain", "high": 11, "low": 6, "sky": "rain",
            "counts": {"overdue": 1, "need": 9, "handled": 4}}
CARD = {"id": "cl", "title": "Seattle City Light", "amount": "$142.36", "state": "overdue",
        "stateText": "Overdue · 1 day", "help": "Help me pay City Light",
        "link": {"label": "Pay on citylight.example", "url": "https://citylight.example/pay"},
        "details": {"from": "Seattle City Light <billing@citylight.example>", "received": "Wed 11 Nov, 8:15 AM",
                    "about": ["Amount $142.36", "Due Sun 15 Nov"], "trail": ["Noticed Wed 11 Nov", "Overdue"]}}
ROW = {"id": "xf", "title": "Xfinity", "amount": "$89.98", "kind": "closed", "verb": "Paid",
       "why": "confirmation mail 16 Nov", "reopen": True}
TRACKER = {"type": "tracker", "need": [CARD], "handled": [ROW]}
PREPARED = {"type": "prepared", "groups": [{"title": "Anna's birthday", "date": "Wed 25 Nov", "ideas": [
    {"title": "Chocolate layer cake", "note": "Fremont bakery", "photo": "https://upload.wikimedia.org/a.jpg"},
    {"title": "Peonies", "photo": "https://upload.wikimedia.org/b.jpg"}],
    "ask": {"label": "Help me pick a gift", "text": "Help me pick a gift for Anna's birthday"}}]}


def test_page_blocks_pass_on_a_page_and_are_refused_in_a_reply():
    assert check_blocks([BRIEFING, TRACKER, PREPARED], page=True) == []
    assert check_blocks([BRIEFING]) == ['0: unknown type "briefing"']
    assert set(blocks.PAGE_TYPES) == {"briefing", "tracker", "prepared"}
    assert not set(blocks.PAGE_TYPES) & set(blocks.TYPES)


def test_page_blocks_inside_columns_on_a_page():
    columns = {"type": "columns", "children": [TRACKER, PREPARED]}
    assert check_blocks([columns], page=True) == []


def test_briefing_rules():
    assert check_blocks([{**BRIEFING, "sky": "lava"}], page=True) == ["0.sky: one of clear, cloud, rain, snow, storm, "
                                                                      "fog, night"]
    assert check_blocks([{**BRIEFING, "counts": {"overdue": -1}}], page=True) == [
        "0.counts: overdue, need and handled are whole numbers, 0 or more"]
    assert check_blocks([{**BRIEFING, "greeting": ""}], page=True) == ["0: briefing needs a greeting"]
    no_weather = {k: v for k, v in BRIEFING.items() if k not in ("temp", "condition", "high", "low", "place")}
    assert check_blocks([no_weather], page=True) == []


def test_tracker_rules():
    assert check_blocks([{**TRACKER, "need": [{**CARD, "state": "panic"}]}], page=True) == [
        "0.need.0.state: overdue, today, soon or open"]
    assert check_blocks([{**TRACKER, "need": [{**CARD, "link": {"label": "Pay", "url": "http://x.example"}}]}],
                        page=True) == ["0.need.0.link: an https url and a label"]
    assert check_blocks([{**TRACKER, "need": [{**CARD, "help": "/reset"}]}], page=True) != []
    assert check_blocks([{**TRACKER, "handled": [{**ROW, "kind": "magic"}]}], page=True) == [
        "0.handled.0.kind: closed, tracking or protected"]
    assert check_blocks([{**TRACKER, "handled": [ROW] * 7}], page=True) == ["0: at most 20 need and 6 handled"]
    assert check_blocks([{"type": "tracker", "need": [], "handled": []}], page=True) == []


def test_prepared_rules():
    group = PREPARED["groups"][0]
    assert check_blocks([{**PREPARED, "groups": [group] * 3}], page=True) == ["0: prepared needs 1-2 groups"]
    one = {**group, "ideas": group["ideas"][:1]}
    assert check_blocks([{**PREPARED, "groups": [one]}], page=True) == ["0.groups.0: 2-4 ideas, each a title and an "
                                                                        "https photo"]
    bad_photo = {**group, "ideas": [{**group["ideas"][0], "photo": "http://x"}, group["ideas"][1]]}
    assert check_blocks([{**PREPARED, "groups": [bad_photo]}], page=True) != []


def test_text_fallbacks():
    assert tf.blocks_as_text([BRIEFING]) == ("Good morning, Sam. 9° Light rain in Seattle. "
                                             "1 overdue, 9 need you, ✓ 4 handled.")
    assert tf.blocks_as_text([TRACKER]) == ("**Needs you**\n- Seattle City Light · $142.36 · Overdue · 1 day\n\n"
                                            "**Handled**\n- ✓ Xfinity · Paid · confirmation mail 16 Nov")
    assert tf.blocks_as_text([PREPARED]) == ("**For Anna's birthday** · Wed 25 Nov\n- Chocolate layer cake: Fremont "
                                             "bakery\n- Peonies")
