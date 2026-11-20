"""A null reading on a track that also carries marks must not break the text fallback."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
blocks = importlib.import_module("hermes_genui.blocks")
check = importlib.import_module("hermes_genui.core.check")


def text_of(block: dict) -> str:
    return blocks.TYPES["progress"][1](block)


def test_unknown_value_with_marks_and_percent_stays_no_data():
    block = {"type": "progress", "title": "Level 5", "value": None, "goal": 120, "unit": "XP",
             "show_percent": True, "thresholds": [{"at": 60, "tone": "good"}, {"at": 85, "tone": "warn"}]}
    assert check.check_blocks([block]) == []
    assert text_of(block) == "Level 5: no data / 120 XP"


def test_unknown_goal_with_marks_stays_no_data():
    block = {"type": "progress", "title": "Level 5", "value": 95, "goal": None, "unit": "XP",
             "thresholds": [{"at": 60, "tone": "good"}]}
    assert check.check_blocks([block]) == []
    assert text_of(block) == "Level 5: 95 XP / no data"
