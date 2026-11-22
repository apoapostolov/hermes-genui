"""A null in a kpis item or a stat is a value nobody measured: it is never read as a 0.

The checker lets it through and the text the model gets back names the gap, while a written zero stays a zero.
"""

import importlib

from conftest import load_plugin_package

load_plugin_package()
blocks = importlib.import_module("hermes_genui.blocks")
check = importlib.import_module("hermes_genui.core.check")


def text_of(kind: str, block: dict) -> str:
    return blocks.TYPES[kind][1](block)


def test_kpis_write_no_data_for_an_unknown_value():
    block = {"type": "kpis", "items": [{"label": "Chargebacks", "value": None}, {"label": "Returns", "value": 0}]}
    assert check.check_blocks([block]) == []
    assert text_of("kpis", block) == "Chargebacks: no data\nReturns: 0"


def test_kpis_need_a_value_field_and_allow_gaps_in_a_trend():
    assert check.check_blocks([{"type": "kpis", "items": [{"label": "Chargebacks"}]}]) == \
        ["0.items.0: item needs label and value"]
    assert check.check_blocks([{"type": "kpis", "items": [{"label": "Revenue", "value": ""}]}]) == \
        ["0.items.0: item needs label and value"]
    ok = {"type": "kpis", "items": [{"label": "Close", "value": 80, "trend": [100, None, 80]}]}
    assert check.check_blocks([ok]) == []
    empty = {"type": "kpis", "items": [{"label": "Close", "value": 80, "trend": [None, None]}]}
    assert check.check_blocks([empty]) == ["0.items.0: trend must be a list of 2-60 numbers"]


def test_stat_reads_an_unknown_value_as_no_data():
    assert check.check_blocks([{"type": "stat", "label": "Saved", "value": None}]) == []
    assert text_of("stat", {"type": "stat", "label": "Saved", "value": None}) == "Saved: no data"
    assert text_of("stat", {"type": "stat", "label": "Saved", "value": 0, "unit": "₹"}) == "Saved: 0 ₹"


def test_a_value_the_text_side_cannot_write_is_no_data_not_a_refusal():
    """The card draws these as "no data", so the checker must not refuse the board for them."""
    for value in (True, [1, 2], float("nan"), "   ", False):
        block = {"type": "stat", "label": "Saved", "value": value, "unit": "₹"}
        assert check.check_blocks([block]) == [], value
        assert text_of("stat", block) == "Saved: no data", value
