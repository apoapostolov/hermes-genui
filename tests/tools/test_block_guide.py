"""The menu design (#42): show_blocks carries a short menu, and block_guide returns the fields and example of the blocks
the model is about to use. Switched on with HERMES_GENUI_GUIDE=menu while it is measured against the full guide."""

import importlib
import json
import re

from conftest import ROOT, load_plugin_package

load_plugin_package()
catalog_text = importlib.import_module("hermes_genui.core.catalog_text")
block_guide = importlib.import_module("hermes_genui.tools.block_guide")
show_blocks = importlib.import_module("hermes_genui.tools.show_blocks")

CATALOG = json.loads((ROOT / "core" / "catalog.json").read_text(encoding="utf-8"))


def test_the_menu_names_every_block_in_the_catalog():
    menu = catalog_text.menu()
    missing = [b["kind"] for b in CATALOG["blocks"] if not re.search(rf"\b{b['kind']}\b", menu)]
    assert missing == []


def test_each_blocks_spec_stays_readable():
    # A spec is sent only when its block is drawn, so a field costs only its own block; this keeps each one short
    # enough to read in one go (the calculator, the longest, is about 1,150).
    long = [(b["kind"], len(catalog_text.spec(b["kind"]))) for b in CATALOG["blocks"]
            if len(catalog_text.spec(b["kind"])) > 1500]
    assert long == []


def test_the_menu_is_a_fraction_of_the_full_guide():
    assert len(catalog_text.menu()) <= 3000
    assert len(catalog_text.menu()) * 4 < len(catalog_text.describe())


NEXT = "\n\nNow call show_blocks once, with all your blocks in order."


def test_block_guide_returns_each_blocks_spec_in_order_then_the_next_step():
    out = block_guide.block_guide({"blocks": ["table", "chart"]})
    assert out == catalog_text.spec("table") + "\n\n" + catalog_text.spec("chart") + NEXT


def test_a_spec_starts_with_the_blocks_exact_shape():
    # Models that read only "Fields: ..." left "type" out; the spec says how a block starts.
    assert catalog_text.spec("chart").startswith('chart: write {"type": "chart", ...}. Fields: kind')


def test_block_guide_lists_the_icons_once_when_a_block_takes_one():
    out = block_guide.block_guide({"blocks": ["timeline", "flow"]})
    assert out.count("\nIcons (only these): mail, rupee, ") == 1
    assert "Icons (only these)" not in block_guide.block_guide({"blocks": ["table"]})


def test_block_guide_takes_a_single_name_and_skips_repeats():
    assert block_guide.block_guide({"blocks": "chart"}) == catalog_text.spec("chart") + NEXT
    assert block_guide.block_guide({"blocks": ["chart", "chart"]}) == catalog_text.spec("chart") + NEXT


def test_block_guide_names_what_it_doesnt_know():
    out = block_guide.block_guide({"blocks": ["chart", "sundial"]})
    assert out.startswith(catalog_text.spec("chart"))
    assert 'No block named "sundial". Pick names from the show_blocks menu.' in out
    assert block_guide.block_guide({}) == "Give the block names from the show_blocks menu, e.g. [\"chart\", \"table\"]."


def test_the_menu_schema_carries_the_menu_and_the_full_one_the_guide():
    menu = show_blocks.schema("menu")["description"]
    full = show_blocks.schema("full")["description"]
    assert catalog_text.menu() in menu and catalog_text.describe() not in menu
    assert catalog_text.describe() in full
    assert show_blocks.schema("menu") == show_blocks.SHOW_BLOCKS_SCHEMA  # the menu is the default


def test_the_menu_guide_adds_one_hint_to_the_system_section_within_its_cap():
    prompt = importlib.import_module("hermes_genui.hooks.prompt_section")
    recipes = importlib.import_module("hermes_genui.core.recipes").shipped()
    menu_rule = prompt.draw_rule(recipes, guide="menu")
    assert "block_guide" in menu_rule and len(menu_rule) <= prompt.MAX_CHARS
    assert "block_guide" not in prompt.draw_rule(recipes, guide="full")  # the full guide is unchanged


def test_the_menu_guide_reminder_asks_for_fields_first():
    nudge = importlib.import_module("hermes_genui.hooks.visual_nudge")
    assert "block_guide" in nudge.MENU_REMINDER and "block_guide" not in nudge.REMINDER


def test_block_guide_is_registered_only_with_the_menu_guide():
    tools = importlib.import_module("hermes_genui.tools")
    assert [t.name for t in tools.tools_for("menu")][:2] == ["show_blocks", "block_guide"]
    assert "block_guide" not in [t.name for t in tools.tools_for("full")]
    assert tools.tools_for("full") == tools.TOOLS


def test_the_widget_spec_carries_the_shapes_a_widget_needs():
    """A widget nests its own elements, so its spec is the only place the model reads the caps, the three actions and
    the binding shape (#62)."""
    spec = catalog_text.spec("widget")
    for words in ('"type": "widget"', "version 1", "state ≤16", "computed ≤32", "view ≤200", "{op: set",
                  "{op: reset}", "{op: fill", "bindings"):
        assert words in spec, words
    assert '"bindings":{"/value":{"get":"computed.planned"}}' in spec  # the example binds an embedded block


def test_the_widget_menu_line_says_what_the_reader_can_try():
    line = next(one for one in catalog_text.menu().splitlines() if one.startswith("- widget: "))
    for words in ("controls change numbers", "reset restores", "fill hands state back",
                  "Not static"):
        assert words in line, words


def test_the_menu_leads_with_three_judgment_lines():
    """The recipe the model opens can't carry cross-cutting judgment (it may not open it at all), so the strongest
    tips live at the top of the menu, which show_blocks carries into every draw (PR #53 feedback)."""
    menu = catalog_text.menu()
    head, _, blocks = menu.partition("\nData\n")
    assert blocks, "the menu still lists the blocks after the head"
    for tip in ("Lead with the answer", "A plain board is a fine answer", "Never decorate just to decorate"):
        assert tip in head, f"the menu head is missing: {tip}"


# --- topics (#62): the widget's longer references -------------------------------------------------------------

TOPIC_NAMES = ("widget.layout", "widget.state", "widget.collections", "widget.blocks")


def test_each_widget_topic_is_a_bounded_reference_file():
    for name in TOPIC_NAMES:
        path = ROOT / "core" / "widget_guide" / f"{name}.md"
        assert path.is_file(), f"missing {path}"
        body = path.read_text(encoding="utf-8")
        assert 200 <= len(body) <= block_guide.MAX_TOPIC_CHARS, name


def test_topics_alone_return_the_reference_then_the_next_step():
    body = (ROOT / "core" / "widget_guide" / "widget.state.md").read_text(encoding="utf-8").strip()
    assert block_guide.block_guide({"topics": ["widget.state"]}) == f"widget.state:\n{body}" + NEXT


def test_a_topic_can_be_asked_for_by_its_bare_name():
    assert block_guide.block_guide({"topics": ["state"]}) == block_guide.block_guide({"topics": ["widget.state"]})


def test_topics_follow_the_block_specs_and_come_each_once():
    out = block_guide.block_guide({"blocks": ["table"], "topics": ["widget.blocks", "widget.blocks"]})
    assert out.startswith(catalog_text.spec("table") + "\n\nwidget.blocks:\n")
    assert out.count("widget.blocks:\n") == 1
    assert out.endswith(NEXT)


def test_all_four_topics_can_be_read_at_once():
    out = block_guide.block_guide({"topics": list(TOPIC_NAMES)})
    for name in TOPIC_NAMES:
        assert out.count(f"{name}:\n") == 1
    assert out.endswith(NEXT)


def test_an_unknown_topic_is_named_with_the_ones_there_are():
    out = block_guide.block_guide({"topics": ["widget.colours"]})
    assert out.startswith('No topic named "widget.colours". Topics are widget.layout, widget.state, '
                          'widget.collections, widget.blocks.')
    assert out.endswith(NEXT)


def test_the_schema_offers_topics_without_making_blocks_required():
    parameters = block_guide.BLOCK_GUIDE_SCHEMA["parameters"]
    assert parameters["properties"]["topics"]["items"]["type"] == "string"
    assert "blocks" not in parameters.get("required", [])


def test_the_guide_tool_still_takes_the_models_argument_object():
    assert block_guide.block_guide({"topics": "widget.layout"}).startswith("widget.layout:\n")
    assert block_guide.block_guide({}) == 'Give the block names from the show_blocks menu, e.g. ["chart", "table"].'
