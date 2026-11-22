"""A null in a chart is a value nobody measured: it is never read as a 0. The checker lets it through and the text the
model gets back names the gap, while a written zero stays a zero.
"""

import importlib

from conftest import load_plugin_package

load_plugin_package()
blocks = importlib.import_module("hermes_genui.blocks")
check = importlib.import_module("hermes_genui.core.check")


def text_of(kind: str, block: dict) -> str:
    return blocks.TYPES[kind][1](block)


def test_chart_names_the_labels_it_has_no_value_for():
    block = {"type": "chart", "kind": "line", "title": "Orders", "x": ["Mon", "Tue", "Wed"],
             "series": [{"name": "Orders", "data": [3, None, 5]}]}
    assert check.check_blocks([block]) == []
    assert text_of("chart", block) == "**Orders**: Orders 3 → 5 (▲ 66.7%), 1 gap (Tue)"


def test_chart_keeps_a_written_zero_a_number_and_a_gap_a_gap():
    zero = {"type": "chart", "kind": "bar", "title": "Returns", "x": ["Mon", "Tue"], "series": [{"data": [0, None]}]}
    assert check.check_blocks([zero]) == []
    assert text_of("chart", zero) == "**Returns**: 0 → 0, 1 gap (Tue)"
    # A chart of nothing but gaps is still refused: there is nothing to draw.
    gaps = {"type": "chart", "kind": "line", "x": ["Mon"], "series": [{"data": [None]}]}
    assert check.check_blocks([gaps]) == ["0: chart needs at least one number"]


def test_chart_counts_the_gaps_and_names_three_labels_at_most():
    block = {"type": "chart", "kind": "line", "title": "Orders", "x": ["Mon", "Tue", "Wed", "Thu", "Fri"],
             "series": [{"name": "Shop A", "data": [12, None, None, None, 14]}]}
    assert text_of("chart", block) == "**Orders**: Shop A 12 → 14 (▲ 16.7%), 3 gaps (Tue, Wed, Thu)"
    block["series"][0]["data"] = [12, None, None, None, None]
    assert text_of("chart", block) == "**Orders**: Shop A 12 → 12 (▲ 0%), 4 gaps (Tue, Wed, Thu and 1 more)"
