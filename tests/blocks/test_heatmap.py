"""A null in a heatmap is a value nobody measured: it is never read as a 0. The checker lets it through and the text the
model gets back names the gap, while a written zero stays a zero.
"""

import importlib

from conftest import load_plugin_package

load_plugin_package()
blocks = importlib.import_module("hermes_genui.blocks")
check = importlib.import_module("hermes_genui.core.check")


def text_of(kind: str, block: dict) -> str:
    return blocks.TYPES[kind][1](block)


def test_a_cell_with_no_number_prints_a_dash():
    block = {"type": "heatmap", "title": "Banks", "rows": ["JPM"], "cols": ["Q1", "Q2"],
             "values": [[4.1, None]], "unit": "%"}
    assert check.check_blocks([block]) == []
    assert text_of("heatmap", block) == "\n".join([
        "**Banks** (%)",
        "|  | Q1 | Q2 |",
        "| --- | --- | --- |",
        "| JPM | 4.1 | – |",
    ])


def test_a_cell_holding_a_word_is_unknown_too():
    block = {"type": "heatmap", "rows": ["JPM"], "cols": ["Q1"], "values": [["n/a"]]}
    assert text_of("heatmap", block) == "|  | Q1 |\n| --- | --- |\n| JPM | – |"
