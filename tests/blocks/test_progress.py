"""A null value on a progress track is a reading nobody took: it is never read as a 0.

The checker lets it through and the text the model gets back names the gap, while a written zero stays a zero.
"""

import importlib

from conftest import load_plugin_package

load_plugin_package()
blocks = importlib.import_module("hermes_genui.blocks")
check = importlib.import_module("hermes_genui.core.check")


def text_of(kind: str, block: dict) -> str:
    return blocks.TYPES[kind][1](block)


def test_no_data_over_the_goal_when_the_value_is_unknown():
    unknown = {"type": "progress", "title": "Level 5", "value": None, "goal": 120, "unit": "XP"}
    assert check.check_blocks([unknown]) == []
    assert text_of("progress", unknown) == "Level 5: no data / 120 XP"


def test_no_data_in_the_goal_s_place_when_the_goal_is_unknown():
    unknown = {"type": "progress", "title": "Level 5", "value": 95, "goal": None, "unit": "XP"}
    assert check.check_blocks([unknown]) == []
    assert text_of("progress", unknown) == "Level 5: 95 / no data"


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
