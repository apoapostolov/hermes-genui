"""A null in a list is a value nobody measured: it is never read as a 0. The checker lets it through and the text the
model gets back names the gap, while a written zero stays a zero.
"""

import importlib

from conftest import load_plugin_package

load_plugin_package()
blocks = importlib.import_module("hermes_genui.blocks")
check = importlib.import_module("hermes_genui.core.check")


def text_of(kind: str, block: dict) -> str:
    return blocks.TYPES[kind][1](block)


def test_a_row_with_no_value_shows_a_dash_not_an_empty_slot():
    items = [{"title": "Shop A", "value": None}, {"title": "Shop B", "value": 0}, {"title": "Shop C"}]
    block = {"type": "list", "items": items}
    assert check.check_blocks([block]) == []
    assert text_of("list", block) == "- Shop A · –\n- Shop B · 0\n- Shop C"


def test_a_null_in_any_of_the_value_fields_is_the_dash_the_web_reader_draws():
    block = {"type": "list", "items": [
        {"title": "Shop A", "price": None}, {"title": "Shop B", "value": "", "badge": "Iconic"}]}
    assert text_of("list", block) == "- Shop A · –\n- Shop B · Iconic"
