"""progress: a track toward a goal, with checkpoints, threshold bands, a shape and coloured parts.

A null value or goal is a reading nobody took: it is never read as a 0. The checker lets it through and the
text the model gets back names the gap, while a written zero stays a zero.
"""

import importlib

import pytest

from conftest import load_plugin_package

load_plugin_package()
blocks = importlib.import_module("hermes_genui.blocks")
check = importlib.import_module("hermes_genui.core.check")
tf = importlib.import_module("hermes_genui.hooks.text_fallback")
check_blocks = check.check_blocks


def text_of(kind: str, block: dict) -> str:
    return blocks.TYPES[kind][1](block)


LOAD = {"type": "progress", "title": "Server load", "value": 88, "goal": 100, "unit": "%", "shape": "dashboard",
        "thresholds": [{"at": 60, "tone": "good"}, {"at": 85, "tone": "warn"}, {"at": 100, "tone": "bad"}]}
HALF = {"type": "progress", "title": "Half marathon", "value": 14, "goal": 21.1, "unit": "km",
        "thresholds": [{"at": 10, "label": "10K"}, {"at": 21.1, "label": "Finish"}]}
SPRINT = {"type": "progress", "title": "Sprint work", "value": 60, "goal": 100,
          "segments": [{"value": 40, "label": "Done", "tone": "good"},
                       {"value": 20, "label": "In review", "tone": "warn"}]}


def render(*blocks: dict) -> str:
    return tf.blocks_as_text(list(blocks))


def test_a_plain_track_is_unchanged():
    assert check_blocks([{"type": "progress", "title": "Trip fund", "value": 5, "goal": 10}]) == []
    plain = {"type": "progress", "title": "Level 4", "value": 95, "goal": 120, "unit": "XP"}
    assert render(plain) == "Level 4: 95 / 120 XP"


def test_every_new_field_passes_and_reads_as_text():
    for block in (LOAD, HALF, SPRINT, {**LOAD, "shape": "circle", "show_percent": True}):
        assert check_blocks([block]) == [], block
    assert render(LOAD) == "Server load: 88 / 100% (bad)"
    assert render(HALF) == "Half marathon: 14 / 21.1 km. Marks: 10K, Finish."
    assert render(SPRINT) == "Sprint work: 60 / 100. Done 40, In review 20."


def test_a_good_value_gains_no_tone_word_and_the_amount_keeps_full_numbers():
    assert render({**LOAD, "value": 50}) == "Server load: 50 / 100%"
    assert render({**LOAD, "value": 130}) == "Server load: 130 / 100% (bad)"


def test_the_percent_is_written_when_asked_for_and_not_when_the_unit_is_a_percent():
    assert render({**LOAD, "show_percent": True, "unit": "ops"}) == "Server load: 88 / 100 ops (88%) (bad)"
    assert render({"type": "progress", "title": "Savings", "value": 7200, "goal": 10000, "unit": "₹",
                   "shape": "circle", "show_percent": True}) == "Savings: 7,200 / 10,000 ₹ (72%)"


def test_a_mark_number_is_written_in_the_unit_and_a_tone_alone_colours_the_fill():
    fees = {"type": "progress", "title": "Fees", "value": 90, "goal": 100, "tone": "warn"}
    assert render(fees) == "Fees: 90 / 100 (warn)"
    marked = {**HALF, "thresholds": [{"at": 10, "label": 10000}]}
    assert render(marked) == "Half marathon: 14 / 21.1 km. Marks: 10,000 km."


def test_a_part_without_a_name_still_reads_its_amount():
    assert render({"type": "progress", "title": "Queue", "value": 30, "goal": 100,
                   "segments": [{"value": 30}]}) == "Queue: 30 / 100. 30."


@pytest.mark.parametrize("bad, why", [
    ({"shape": "pie"}, "shape is line, circle or dashboard"),
    ({"tone": "red"}, "tone is good, warn or bad"),
    ({"show_percent": "yes"}, "show_percent is true or false"),
])
def test_the_drawing_words_are_checked(bad, why):
    assert check_blocks([{"type": "progress", "title": "x", "value": 5, "goal": 10, **bad}]) == [f"0: {why}"]


@pytest.mark.parametrize("bad, path, why", [
    ({"thresholds": [{"label": "half"}]}, "0.thresholds.0", "threshold needs a number `at`"),
    ({"thresholds": [{"at": 5, "tone": "red"}]}, "0.thresholds.0", "tone is good, warn or bad"),
    ({"thresholds": [{"at": 5, "label": ["a"]}]}, "0.thresholds.0", "label is a number or text"),
    ({"thresholds": [42]}, "0.thresholds.0", "threshold is not an object"),
    ({"segments": [{"value": -1}]}, "0.segments.0", "segment needs a number `value` of 0 or more"),
    ({"segments": [{"value": 1, "tone": "red"}]}, "0.segments.0", "tone is good, warn or bad"),
    ({"segments": "left"}, "0", "segments is a list of parts"),
])
def test_one_broken_mark_or_part_is_named_where_it_sits(bad, path, why):
    assert check_blocks([{"type": "progress", "title": "x", "value": 5, "goal": 10, **bad}]) == [f"{path}: {why}"]


def test_the_checker_says_what_it_would_have_cut_or_mixed():
    marks = [{"at": i} for i in range(7)]
    parts = [{"value": 1} for _ in range(6)]
    assert check_blocks([{"type": "progress", "title": "x", "value": 5, "goal": 100, "thresholds": marks}]) == []
    assert check_blocks([{"type": "progress", "title": "x", "value": 5, "goal": 100, "segments": parts}]) == []
    assert check_blocks([{"type": "progress", "title": "x", "value": 5, "goal": 10,
                          "steps": [{"label": "half", "at": 5}], "thresholds": [{"at": 8}]}]) == []
    assert check_blocks([{"type": "progress", "title": "x", "value": 5, "goal": 100,
                          "segments": [{"value": 60}, {"value": 50}]}]) == []
    assert check_blocks([{"type": "progress", "title": "x", "value": 5, "goal": 100,
                          "segments": [{"value": 60}, {"value": 40}]}]) == []
    # What the reader keeps and how it writes it: the first six marks by position, the first five parts, and a long
    # label cut to 28 characters.
    long_label = {"type": "progress", "title": "x", "value": 5, "goal": 100,
                  "thresholds": [{"at": 10, "label": "x" * 29}]}
    assert check_blocks([long_label]) == []
    assert render(long_label) == f"x: 5 / 100. Marks: {'x' * 27}…."
    assert render({"type": "progress", "title": "Queue", "value": 30, "goal": 100,
                   "segments": [{"value": 20} for _ in range(6)]}) == (
        "Queue: 30 / 100. 20, 20, 20, 20, 20.")


def test_the_drawing_words_are_read_the_way_the_card_reads_them():
    words = [{"shape": "ring"}, {"shape": "gauge"}, {"shape": "bar"}, {"shape": "Circle"},
             {"tone": "warning"}, {"tone": "Good"}, {"tone": "danger"}]
    for word in words:
        assert check_blocks([{"type": "progress", "title": "x", "value": 5, "goal": 10, **word}]) == [], word
    assert render({"type": "progress", "title": "Load", "value": 88, "goal": 100, "tone": "warning"}) == (
        "Load: 88 / 100 (warn)")
    alias_marks = {**LOAD, "thresholds": [{"at": 60, "tone": "Good"}, {"at": 85, "tone": "warning"},
                                          {"at": 100, "tone": "danger"}]}
    assert render(alias_marks) == "Server load: 88 / 100% (bad)"


def test_a_mark_past_the_goal_colours_nothing_beyond_the_goal():
    over = {**LOAD, "value": 120,
            "thresholds": [{"at": 60, "tone": "good"}, {"at": 100, "tone": "warn"}, {"at": 150, "tone": "bad"}]}
    assert check_blocks([over]) == []
    assert render(over) == "Server load: 120 / 100% (warn)"

def test_no_data_over_the_goal_when_the_value_is_unknown():
    unknown = {"type": "progress", "title": "Level 5", "value": None, "goal": 120, "unit": "XP"}
    assert check.check_blocks([unknown]) == []
    assert text_of("progress", unknown) == "Level 5: no data / 120 XP"


def test_no_data_in_the_goal_s_place_when_the_goal_is_unknown():
    unknown = {"type": "progress", "title": "Level 5", "value": 95, "goal": None, "unit": "XP"}
    assert check.check_blocks([unknown]) == []
    # the goal wrote the unit, so with no goal the value keeps it: "95" alone would be a bare number
    assert text_of("progress", unknown) == "Level 5: 95 XP / no data"
    money = {"type": "progress", "title": "Level 5", "value": 95, "goal": None, "unit": "₹"}
    assert text_of("progress", money) == "Level 5: 95 ₹ / no data"


def test_a_written_zero_stays_a_zero():
    zero = {"type": "progress", "title": "Level 4", "value": 0, "goal": 120, "unit": "XP"}
    assert check.check_blocks([zero]) == []
    assert text_of("progress", zero) == "Level 4: 0 / 120 XP"


def test_a_value_that_is_text_or_missing_is_still_a_mistake():
    assert check.check_blocks([{"type": "progress", "title": "x", "value": "5", "goal": 120}]) == \
        ["0: progress needs a numeric value"]
    assert check.check_blocks([{"type": "progress", "title": "x", "goal": 120}]) == \
        ["0: progress needs a numeric value"]
    assert check.check_blocks([{"type": "progress", "title": "x", "value": 5}]) == \
        ["0: progress needs a goal above 0"]
