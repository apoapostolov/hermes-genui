"""A null in a table is a value nobody measured: it is never read as a 0. The checker lets it through and the text the
model gets back names the gap, while a written zero stays a zero.
"""

import importlib

from conftest import load_plugin_package

load_plugin_package()
blocks = importlib.import_module("hermes_genui.blocks")
check = importlib.import_module("hermes_genui.core.check")


def text_of(kind: str, block: dict) -> str:
    return blocks.TYPES[kind][1](block)


def test_a_null_cell_prints_a_dash_and_a_column_left_out_stays_blank():
    block = {"type": "table", "columns": ["Shop", "Price", "Change"],
             "rows": [["Shop A", 12, None], {"Shop": "Shop B", "Price": 0}]}
    assert check.check_blocks([block]) == []
    assert text_of("table", block) == "\n".join([
        "| Shop | Price | Change |",
        "| --- | --- | --- |",
        "| Shop A | 12 | – |",
        "| Shop B | 0 |  |",
    ])
